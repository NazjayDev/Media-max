import { ensureIndex, getDb } from "@/lib/mongodb";

interface ProfileDoc {
  _id: string; // userId
  username: string;
  usernameLower: string;
  updatedAt: Date;
}

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

const RESERVED = new Set([
  "admin",
  "administrator",
  "moderator",
  "mod",
  "staff",
  "support",
  "official",
  "system",
  "root",
  "null",
  "undefined",
  "anonymous",
  "mediamax",
  "media-max",
  "media_max",
]);

type UsernameCheck = { ok: true; username: string } | { ok: false; error: string };

export function validateUsername(raw: unknown): UsernameCheck {
  const username = typeof raw === "string" ? raw.trim() : "";
  if (!USERNAME_PATTERN.test(username)) {
    return { ok: false, error: "Use 3-20 letters, numbers, underscores or hyphens." };
  }
  const lower = username.toLowerCase();
  if (RESERVED.has(lower) || lower.startsWith("mediamax")) {
    return { ok: false, error: "That username is reserved." };
  }
  return { ok: true, username };
}

export async function profilesCollection() {
  const db = await getDb();
  if (!db) return null;
  const collection = db.collection<ProfileDoc>("profiles");
  await ensureIndex(collection, { usernameLower: 1 }, { unique: true });
  return collection;
}

/** Maps user ids to their chosen usernames. Users without a profile are omitted. */
export async function usernamesFor(userIds: string[]): Promise<Map<string, string>> {
  const collection = await profilesCollection();
  if (!collection || userIds.length === 0) return new Map();
  const docs = await collection.find({ _id: { $in: [...new Set(userIds)] } }).toArray();
  return new Map(docs.map((d) => [d._id, d.username]));
}
