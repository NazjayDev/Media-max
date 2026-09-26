import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { attachRatings } from "@/lib/ratings";
import { personalRecommendations } from "@/lib/recommend";
import { watchlistCollection } from "@/lib/watchlist";

export const maxDuration = 30;

const MAX_SEEDS = 8;

export async function GET() {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const collection = await watchlistCollection();
  if (!collection) return jsonError("Picks are unavailable", 503);

  const docs = await collection
    .find({ userId: guard.userId }, { projection: { key: 1, status: 1, userRating: 1, addedAt: 1 } })
    .sort({ addedAt: -1 })
    .limit(500)
    .toArray();

  if (docs.length === 0) return NextResponse.json({ results: [], basedOn: 0 });

  // Best signal first: titles rated 4+ stars, then anything watched, then anything saved.
  const loved = docs.filter((d) => (d.userRating ?? 0) >= 4);
  const watched = docs.filter((d) => d.status === "watched" && !loved.includes(d));
  const rest = docs.filter((d) => !loved.includes(d) && !watched.includes(d));
  const seeds = [...loved, ...watched, ...rest].slice(0, MAX_SEEDS).map((d) => d.key);

  try {
    const results = await personalRecommendations(seeds, docs.map((d) => d.key));
    return NextResponse.json({ results: await attachRatings(results), basedOn: seeds.length });
  } catch (error) {
    console.error("Personal picks failed:", error);
    return jsonError("Couldn't build picks", 502);
  }
}
