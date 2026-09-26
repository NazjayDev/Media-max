import { getDb } from "@/lib/mongodb";

interface CacheEntry {
  _id: string;
  value: unknown;
  expiresAt: Date;
}

let indexReady: Promise<unknown> | null = null;

/**
 * Read-through cache backed by MongoDB Atlas. If MongoDB is missing or failing,
 * the loader runs directly so the app keeps working.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const db = await getDb();
  if (!db) {
    return loader();
  }

  const collection = db.collection<CacheEntry>("cache");
  indexReady ??= collection
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    .catch(() => undefined);

  try {
    const hit = await collection.findOne({ _id: key });
    if (hit && hit.expiresAt > new Date()) {
      return hit.value as T;
    }
  } catch {
    // Fall through to the loader on any cache read failure.
  }

  const value = await loader();

  try {
    await collection.updateOne(
      { _id: key },
      { $set: { value, expiresAt: new Date(Date.now() + ttlSeconds * 1000) } },
      { upsert: true }
    );
  } catch {
    // A failed cache write must never fail the request.
  }

  return value;
}
