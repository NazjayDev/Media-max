import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/mongodb";
import { titleRecommendations } from "@/lib/recommend";
import { attachRatings } from "@/lib/ratings";
import type { MediaType, Recommendation } from "@/types/media";

export const maxDuration = 30;

interface WatchlistDoc {
  userId: string;
  key: string;
  item: Recommendation;
  addedAt: Date;
  status?: string;
  statusUpdatedAt?: Date;
}

const ROWS = 3;
const PER_ROW = 8;

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const db = await getDb();
  if (!db) {
    return NextResponse.json({ error: "Recommendations are unavailable" }, { status: 503 });
  }

  const docs = await db.collection<WatchlistDoc>("watchlist").find({ userId }).limit(500).toArray();
  const saved = new Set(docs.map((d) => d.key));

  // Most recently watched first; older records without a timestamp fall back to when they were saved.
  const lastWatched = docs
    .filter((d) => d.status === "watched")
    .sort(
      (a, b) =>
        (b.statusUpdatedAt ?? b.addedAt).getTime() - (a.statusUpdatedAt ?? a.addedAt).getTime()
    )
    .slice(0, ROWS);

  const rows = await Promise.all(
    lastWatched.map(async (doc) => {
      const [mediaType, rawId] = doc.key.split(":") as [MediaType, string];
      try {
        const recs = await titleRecommendations(mediaType, Number(rawId));
        const fresh = recs
          .filter((r) => !saved.has(`${r.mediaType}:${r.id}`))
          .slice(0, PER_ROW);
        return {
          basedOn: { mediaType, id: doc.item.id, title: doc.item.title },
          results: await attachRatings(fresh),
        };
      } catch (error) {
        console.error("Because-you-watched failed:", error instanceof Error ? error.message : error);
        return { basedOn: { mediaType, id: doc.item.id, title: doc.item.title }, results: [] };
      }
    })
  );

  return NextResponse.json({ rows: rows.filter((r) => r.results.length > 0) });
}
