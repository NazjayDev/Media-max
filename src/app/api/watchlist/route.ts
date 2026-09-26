import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/mongodb";
import { attachRatings } from "@/lib/ratings";
import { logEvent } from "@/lib/events";
import type { Recommendation, StreamingProvider, WatchStatus, WatchlistEntry } from "@/types/media";

interface WatchlistDoc {
  userId: string;
  key: string;
  item: Recommendation;
  addedAt: Date;
  status?: WatchStatus;
  userRating?: number | null;
  favorite?: boolean;
  statusUpdatedAt?: Date;
}

const STATUSES: WatchStatus[] = ["want", "watching", "watched"];

const MAX_ITEMS_PER_USER = 500;
const TMDB_IMAGE_PREFIX = "https://image.tmdb.org/";

function itemKey(mediaType: string, id: number) {
  return `${mediaType}:${id}`;
}

function sanitizeProviders(value: unknown): StreamingProvider[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((p) => {
    if (!p || typeof p.id !== "number" || typeof p.name !== "string") return [];
    const logoPath =
      typeof p.logoPath === "string" && p.logoPath.startsWith(TMDB_IMAGE_PREFIX)
        ? p.logoPath
        : null;
    return [{ id: p.id, name: p.name.slice(0, 80), logoPath }];
  });
}

function sanitizeItem(body: unknown): Recommendation | null {
  const b = body as Partial<Recommendation> | null;
  if (
    !b ||
    typeof b.id !== "number" ||
    (b.mediaType !== "movie" && b.mediaType !== "tv") ||
    typeof b.title !== "string"
  ) {
    return null;
  }
  return {
    id: b.id,
    mediaType: b.mediaType,
    title: b.title.slice(0, 200),
    posterPath:
      typeof b.posterPath === "string" && b.posterPath.startsWith(TMDB_IMAGE_PREFIX)
        ? b.posterPath
        : null,
    synopsis: typeof b.synopsis === "string" ? b.synopsis.slice(0, 2000) : "",
    streamingProviders: sanitizeProviders(b.streamingProviders),
  };
}

async function requireUserAndDb() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  }
  const db = await getDb();
  if (!db) {
    return {
      error: NextResponse.json({ error: "Watchlist is unavailable" }, { status: 503 }),
    };
  }
  const collection = db.collection<WatchlistDoc>("watchlist");
  await collection
    .createIndex({ userId: 1, key: 1 }, { unique: true })
    .catch(() => undefined);
  return { userId, collection };
}

export async function GET() {
  const ctx = await requireUserAndDb();
  if ("error" in ctx) return ctx.error;

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
  const ctx = await requireUserAndDb();
  if ("error" in ctx) return ctx.error;

  const item = sanitizeItem(await request.json().catch(() => null));
  if (!item) {
    return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  }

  const count = await ctx.collection.countDocuments({ userId: ctx.userId });
  if (count >= MAX_ITEMS_PER_USER) {
    return NextResponse.json({ error: "Watchlist is full" }, { status: 400 });
  }

  const saved = await ctx.collection.updateOne(
    { userId: ctx.userId, key: itemKey(item.mediaType, item.id) },
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
  const ctx = await requireUserAndDb();
  if ("error" in ctx) return ctx.error;

  const mediaType = request.nextUrl.searchParams.get("mediaType");
  const id = Number(request.nextUrl.searchParams.get("id"));
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  }

  await ctx.collection.deleteOne({ userId: ctx.userId, key: itemKey(mediaType, id) });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const ctx = await requireUserAndDb();
  if ("error" in ctx) return ctx.error;

  const body = (await request.json().catch(() => null)) as {
    mediaType?: string;
    id?: number;
    status?: string;
    userRating?: number | null;
    favorite?: unknown;
  } | null;

  if (
    !body ||
    (body.mediaType !== "movie" && body.mediaType !== "tv") ||
    !Number.isInteger(body.id)
  ) {
    return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  }

  const update: Partial<Pick<WatchlistDoc, "status" | "userRating" | "favorite" | "statusUpdatedAt">> = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as WatchStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = body.status as WatchStatus;
    update.statusUpdatedAt = new Date();
  }
  if (body.userRating !== undefined) {
    const r = body.userRating;
    if (r !== null && !(typeof r === "number" && r >= 0.5 && r <= 5 && (r * 2) % 1 === 0)) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }
    update.userRating = r;
  }
  if (body.favorite !== undefined) {
    if (typeof body.favorite !== "boolean") {
      return NextResponse.json({ error: "Invalid favorite" }, { status: 400 });
    }
    update.favorite = body.favorite;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await ctx.collection.updateOne(
    { userId: ctx.userId, key: itemKey(body.mediaType, body.id as number) },
    { $set: update }
  );
  if (result.matchedCount === 0) {
    return NextResponse.json({ error: "Not in watchlist" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
