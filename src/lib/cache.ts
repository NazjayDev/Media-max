import { ensureIndex, getDb } from "@/lib/mongodb";

interface CacheEntry {
  _id: string;
  value: unknown;
  expiresAt: Date;
}

const LOADER_CONCURRENCY = 20;

/** Runs `fn` over items with at most `limit` calls in flight, keeping input order. */
export async function mapLimit<I, O>(
  items: I[],
  limit: number,
  fn: (item: I) => Promise<O>,
): Promise<O[]> {
  const results: O[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

async function cacheCollection() {
  const db = await getDb();
  if (!db) return null;
  const collection = db.collection<CacheEntry>("cache");
  await ensureIndex(collection, { expiresAt: 1 }, { expireAfterSeconds: 0 });
  return collection;
}

/**
 * Read-through cache backed by MongoDB Atlas. If MongoDB is missing or failing,
 * the loader runs directly so the app keeps working.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const collection = await cacheCollection();
  if (!collection) return loader();

  try {
    const hit = await collection.findOne({ _id: key });
    if (hit && hit.expiresAt > new Date()) return hit.value as T;
  } catch {
    // Fall through to the loader on any cache read failure.
  }

  const value = await loader();

  try {
    await collection.updateOne(
      { _id: key },
      { $set: { value, expiresAt: new Date(Date.now() + ttlSeconds * 1000) } },
      { upsert: true },
    );
  } catch {
    // A failed cache write must never fail the request.
  }
  return value;
}

/**
 * Batch version of `cached`: one read for every key, then only the misses run their loader
 * (concurrently) and are written back in a single bulk write. Results keep the input order.
 * A loader may return undefined to report a failure without caching anything for that key.
 */
export async function cachedMany<T>(
  keys: string[],
  ttlSeconds: number,
  loader: (key: string) => Promise<T | undefined>,
): Promise<(T | undefined)[]> {
  const collection = await cacheCollection();
  if (!collection) return Promise.all(keys.map(loader));

  const hits = new Map<string, T>();
  try {
    const now = new Date();
    for (const doc of await collection.find({ _id: { $in: keys } }).toArray()) {
      if (doc.expiresAt > now) hits.set(doc._id, doc.value as T);
    }
  } catch {
    // Treat a failed read as all misses.
  }

  const misses = keys.filter((k) => !hits.has(k));
  const loaded = await mapLimit(misses, LOADER_CONCURRENCY, loader);
  const writes: { key: string; value: T }[] = [];
  misses.forEach((k, i) => {
    const value = loaded[i];
    if (value !== undefined) {
      hits.set(k, value);
      writes.push({ key: k, value });
    }
  });

  if (writes.length > 0) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await collection
      .bulkWrite(
        writes.map(({ key, value }) => ({
          updateOne: { filter: { _id: key }, update: { $set: { value, expiresAt } }, upsert: true },
        })),
        { ordered: false },
      )
      .catch(() => undefined);
  }
  return keys.map((k) => hits.get(k));
}
