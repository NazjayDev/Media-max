import type { NextRequest } from "next/server";
import { ensureIndex, getDb } from "@/lib/mongodb";

interface RateDoc {
  _id: string;
  count: number;
  expiresAt: Date;
}

export function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Fixed-window limiter backed by MongoDB so it works across serverless instances.
 * Returns true when the request is allowed. If MongoDB is down it allows the request.
 */
export async function allowRequest(
  bucket: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;

  const collection = db.collection<RateDoc>("ratelimits");
  await ensureIndex(collection, { expiresAt: 1 }, { expireAfterSeconds: 0 });

  const window = Math.floor(Date.now() / (windowSeconds * 1000));
  try {
    const doc = await collection.findOneAndUpdate(
      { _id: `${bucket}:${identity}:${window}` },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((window + 2) * windowSeconds * 1000) },
      },
      { upsert: true, returnDocument: "after" },
    );
    return (doc?.count ?? 1) <= limit;
  } catch {
    return true;
  }
}
