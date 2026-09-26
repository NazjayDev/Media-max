import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { parseMedia } from "@/lib/media";
import { attachRatings } from "@/lib/ratings";
import { titleRecommendations } from "@/lib/recommend";
import { watchlistCollection } from "@/lib/watchlist";

export const maxDuration = 30;

const ROWS = 3;
const CANDIDATES = 6; // look a little further back if a recent title has too few fresh matches
const MIN_RESULTS = 4;
const PER_ROW = 8;

export async function GET() {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const collection = await watchlistCollection();
  if (!collection) return jsonError("Recommendations are unavailable", 503);

  const docs = await collection.find({ userId: guard.userId }).limit(500).toArray();
  const saved = new Set(docs.map((d) => d.key));

  // Most recently watched first; older records without a timestamp fall back to when they were saved.
  const lastWatched = docs
    .filter((d) => d.status === "watched")
    .sort(
      (a, b) => (b.statusUpdatedAt ?? b.addedAt).getTime() - (a.statusUpdatedAt ?? a.addedAt).getTime()
    )
    .slice(0, CANDIDATES);

  const rows = await Promise.all(
    lastWatched.map(async ({ key, item }) => {
      const basedOn = { mediaType: item.mediaType, id: item.id, title: item.title };
      const media = parseMedia(item.mediaType, item.id);
      if (!media) return { basedOn, results: [] };
      try {
        const recs = await titleRecommendations(media.mediaType, media.id);
        const fresh = recs.filter((r) => !saved.has(`${r.mediaType}:${r.id}`)).slice(0, PER_ROW);
        return { basedOn, results: await attachRatings(fresh) };
      } catch (error) {
        console.error(`Because-you-watched failed for ${key}:`, error instanceof Error ? error.message : error);
        return { basedOn, results: [] };
      }
    })
  );

  return NextResponse.json({ rows: rows.filter((r) => r.results.length >= MIN_RESULTS).slice(0, ROWS) });
}
