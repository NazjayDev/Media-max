import { ensureIndex, getDb } from "@/lib/mongodb";
import type { Recommendation, WatchStatus } from "@/types/media";

/** One saved title for one user. Older records may lack the optional fields. */
export interface WatchlistDoc {
  userId: string;
  key: string;
  item: Recommendation;
  addedAt: Date;
  status?: WatchStatus;
  userRating?: number | null;
  favorite?: boolean;
  statusUpdatedAt?: Date;
}

export async function watchlistCollection() {
  const db = await getDb();
  if (!db) return null;
  const collection = db.collection<WatchlistDoc>("watchlist");
  await ensureIndex(collection, { userId: 1, key: 1 }, { unique: true });
  return collection;
}
