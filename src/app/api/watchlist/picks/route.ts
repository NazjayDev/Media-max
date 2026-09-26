import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/mongodb";
import { personalRecommendations } from "@/lib/recommend";
import { attachRatings } from "@/lib/ratings";

export const maxDuration = 30;

interface WatchlistDoc {
  userId: string;
  key: string;
  addedAt: Date;
  status?: string;
  userRating?: number | null;
}

const MAX_SEEDS = 8;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const db = await getDb();
  if (!db) {
    return NextResponse.json({ error: "Picks are unavailable" }, { status: 503 });
  }

  const docs = await db
    .collection<WatchlistDoc>("watchlist")
    .find({ userId }, { projection: { key: 1, status: 1, userRating: 1, addedAt: 1 } })
    .sort({ addedAt: -1 })
    .limit(500)
    .toArray();

  if (docs.length === 0) {
    return NextResponse.json({ results: [], basedOn: 0 });
  }

  // Best signal first: titles rated 4-5 stars, then anything watched, then anything saved.
  const loved = docs.filter((d) => (d.userRating ?? 0) >= 4);
  const watched = docs.filter((d) => d.status === "watched" && !loved.includes(d));
  const rest = docs.filter((d) => !loved.includes(d) && !watched.includes(d));
  const seeds = [...loved, ...watched, ...rest].slice(0, MAX_SEEDS).map((d) => d.key);

  try {
    const results = await personalRecommendations(
      seeds,
      docs.map((d) => d.key)
    );
    return NextResponse.json({ results: await attachRatings(results), basedOn: seeds.length });
  } catch (error) {
    console.error("Personal picks failed:", error);
    return NextResponse.json({ error: "Couldn't build picks" }, { status: 502 });
  }
}
