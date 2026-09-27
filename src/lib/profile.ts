import { isMediaType } from "@/lib/media";
import { ensureIndex, getDb } from "@/lib/mongodb";
import { MAX_FAVORITES, type ProfileFavorite } from "@/lib/profileTypes";

export { MAX_FAVORITES, type ProfileFavorite } from "@/lib/profileTypes";

const TMDB_IMAGE_PREFIX = "https://image.tmdb.org/";

interface ProfileDoc {
  _id: string; // userId
  username: string;
  usernameLower: string;
  favorites?: ProfileFavorite[];
  createdAt: Date;
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

/** Whitelists a client-provided favorites list: at most 3, each a real-looking title. */
export function validateFavorites(raw: unknown): ProfileFavorite[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_FAVORITES) return null;
  const favorites: ProfileFavorite[] = [];
  for (const item of raw) {
    const f = item as Partial<ProfileFavorite> | null;
    if (
      !f ||
      !isMediaType(f.mediaType) ||
      typeof f.id !== "number" ||
      !Number.isInteger(f.id) ||
      f.id <= 0
    ) {
      return null;
    }
    if (typeof f.title !== "string" || !f.title.trim()) return null;
    const posterPath =
      typeof f.posterPath === "string" && f.posterPath.startsWith(TMDB_IMAGE_PREFIX)
        ? f.posterPath
        : null;
    favorites.push({
      mediaType: f.mediaType,
      id: f.id,
      title: f.title.trim().slice(0, 200),
      posterPath,
    });
  }
  return favorites;
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

export interface PublicProfile {
  userId: string;
  username: string;
  favorites: ProfileFavorite[];
  memberSince: string;
}

/** The public-facing side of a profile, looked up by username (case-insensitive). */
export async function getProfileByUsername(username: string): Promise<PublicProfile | null> {
  const collection = await profilesCollection();
  if (!collection) return null;
  const doc = await collection.findOne({ usernameLower: username.trim().toLowerCase() });
  if (!doc) return null;
  return {
    userId: doc._id,
    username: doc.username,
    favorites: doc.favorites ?? [],
    memberSince: (doc.createdAt ?? new Date()).toISOString(),
  };
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface UserSearchHit {
  username: string;
  favorites: ProfileFavorite[];
}

/** Finds usernames containing `query`, for the people-search page. */
export async function searchUsernames(
  query: string,
  excludeUserId?: string,
): Promise<UserSearchHit[]> {
  const collection = await profilesCollection();
  const text = query.trim();
  if (!collection || text.length < 2) return [];
  const docs = await collection
    .find(
      {
        usernameLower: { $regex: escapeRegex(text.toLowerCase()) },
        ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
      },
      { projection: { username: 1, favorites: 1 }, limit: 20 },
    )
    .sort({ usernameLower: 1 })
    .toArray();
  return docs.map((d) => ({ username: d.username, favorites: d.favorites ?? [] }));
}
