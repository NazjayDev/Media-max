import { NextRequest, NextResponse, after } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { logEvent } from "@/lib/events";
import { getDb } from "@/lib/mongodb";
import { isMediaType, mediaKey, parseMedia } from "@/lib/media";
import { attachRatings } from "@/lib/ratings";
import { watchlistCollection, type WatchlistDoc } from "@/lib/watchlist";
import type { Recommendation, StreamingProvider, WatchStatus, WatchlistEntry } from "@/types/media";

const STATUSES: WatchStatus[] = ["want", "watching", "watched"];
const MAX_ITEMS_PER_USER = 500;
const TMDB_IMAGE_PREFIX = "https://image.tmdb.org/";

const safeImage = (value: unknown) =>
  typeof value === "string" && value.startsWith(TMDB_IMAGE_PREFIX) ? value : null;

function sanitizeProviders(value: unknown): StreamingProvider[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((p) => {
    if (!p || typeof p.id !== "number" || typeof p.name !== "string") return [];
    return [{ id: p.id, name: p.name.slice(0, 80), logoPath: safeImage(p.logoPath) }];
  });
}

/** Whitelists the fields we store from a client-provided title so arbitrary data can't be saved. */
function sanitizeItem(body: unknown): Recommendation | null {
  const b = body as Partial<Recommendation> | null;
  if (!b || typeof b.id !== "number" || !isMediaType(b.mediaType) || typeof b.title !== "string") {
    return null;
  }
  return {
    id: b.id,
    mediaType: b.mediaType,
    title: b.title.slice(0, 200),
    posterPath: safeImage(b.posterPath),
    synopsis: typeof b.synopsis === "string" ? b.synopsis.slice(0, 2000) : "",
    streamingProviders: sanitizeProviders(b.streamingProviders),
  };
}

async function requireUserAndCollection() {
  const guard = await requireUser();
  if ("response" in guard) return guard;
  const collection = await watchlistCollection();
  if (!collection) return { response: jsonError("Watchlist is unavailable", 503) };
  return { userId: guard.userId, collection };
}

export async function GET() {
  const ctx = await requireUserAndCollection();
  if ("response" in ctx) return ctx.response;

  const docs = await ctx.collection
    .find({ userId: ctx.userId })
    .sort({ addedAt: -1 })
    .limit(MAX_ITEMS_PER_USER)
    .toArray();

  const db = await getDb();
  const catalog = db
    ? await db
        .collection<{ _id: string; genres: string[] }>("titles")
        .find({ _id: { $in: docs.map((d) => d.key) } }, { projection: { genres: 1 } })
        .toArray()
    : [];
  const genresByKey = new Map(catalog.map((c) => [c._id, c.genres]));

  const entries: WatchlistEntry[] = docs.map((d) => ({
    ...d.item,
    status: d.status ?? "want",
    userRating: d.userRating ?? null,
    favorite: d.favorite ?? false,
    genres: genresByKey.get(d.key) ?? [],
    addedAt: d.addedAt.toISOString(),
    statusUpdatedAt: (d.statusUpdatedAt ?? d.addedAt).toISOString(),
  }));
  return NextResponse.json({ results: await attachRatings(entries) });
}

export async function POST(request: NextRequest) {
  const ctx = await requireUserAndCollection();
  if ("response" in ctx) return ctx.response;

  const item = sanitizeItem(await request.json().catch(() => null));
  if (!item) return jsonError("Invalid item", 400);

  if ((await ctx.collection.countDocuments({ userId: ctx.userId })) >= MAX_ITEMS_PER_USER) {
    return jsonError("Watchlist is full", 400);
  }

  const saved = await ctx.collection.updateOne(
    { userId: ctx.userId, key: mediaKey(item.mediaType, item.id) },
    {
      $set: { item },
      $setOnInsert: { addedAt: new Date(), status: "want", userRating: null, favorite: false },
    },
    { upsert: true }
  );

  if (saved.upsertedCount > 0) {
    after(() =>
      logEvent({ kind: "save", mediaType: item.mediaType, tmdbId: item.id, title: item.title })
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireUserAndCollection();
  if ("response" in ctx) return ctx.response;

  const params = request.nextUrl.searchParams;
  const media = parseMedia(params.get("mediaType"), params.get("id"));
  if (!media) return jsonError("Invalid item", 400);

  await ctx.collection.deleteOne({ userId: ctx.userId, key: mediaKey(media.mediaType, media.id) });
  return NextResponse.json({ ok: true });
}

type WatchlistPatch = Partial<
  Pick<WatchlistDoc, "status" | "userRating" | "favorite" | "statusUpdatedAt">
>;

export async function PATCH(request: NextRequest) {
  const ctx = await requireUserAndCollection();
  if ("response" in ctx) return ctx.response;

  const body = (await request.json().catch(() => null)) as {
    mediaType?: string;
    id?: number;
    status?: string;
    userRating?: number | null;
    favorite?: unknown;
  } | null;

  const media = parseMedia(body?.mediaType, body?.id);
  if (!body || !media) return jsonError("Invalid item", 400);

  const update: WatchlistPatch = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as WatchStatus)) return jsonError("Invalid status", 400);
    update.status = body.status as WatchStatus;
    update.statusUpdatedAt = new Date();
  }
  if (body.userRating !== undefined) {
    const r = body.userRating;
    // Half-star steps between 0.5 and 5, or null to clear.
    if (r !== null && !(typeof r === "number" && r >= 0.5 && r <= 5 && (r * 2) % 1 === 0)) {
      return jsonError("Invalid rating", 400);
    }
    update.userRating = r;
  }
  if (body.favorite !== undefined) {
    if (typeof body.favorite !== "boolean") return jsonError("Invalid favorite", 400);
    update.favorite = body.favorite;
  }
  if (Object.keys(update).length === 0) return jsonError("Nothing to update", 400);

  const result = await ctx.collection.updateOne(
    { userId: ctx.userId, key: mediaKey(media.mediaType, media.id) },
    { $set: update }
  );
  if (result.matchedCount === 0) return jsonError("Not in watchlist", 404);
  return NextResponse.json({ ok: true });
}
