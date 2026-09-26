import { getDb } from "@/lib/mongodb";

export interface TasteStats {
  saved: number;
  watched: number;
  watching: number;
  avgRating: number | null;
  anime: number;
  topGenres: { name: string; count: number }[];
  archetype: string;
}

export interface PassportRecord {
  _id: string; // asset address
  userId: string;
  wallet: string;
  snapshot: TasteStats;
  signature?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ARCHETYPES: Record<string, string> = {
  "Science Fiction": "Cosmic Explorer",
  "Sci-Fi & Fantasy": "Worldbuilder",
  Fantasy: "Realm Wanderer",
  Crime: "Noir Detective",
  Drama: "Storyteller",
  Comedy: "Laugh Seeker",
  Animation: "Animation Aficionado",
  Action: "Adrenaline Chaser",
  "Action & Adventure": "Adrenaline Chaser",
  Adventure: "Trailblazer",
  Thriller: "Edge-of-Seat Fan",
  Horror: "Fright Night Regular",
  Romance: "Hopeless Romantic",
  Mystery: "Puzzle Solver",
  Documentary: "Truth Seeker",
  Family: "Cozy Watcher",
  War: "History Buff",
};

export const MIN_TITLES_FOR_PASSPORT = 3;

interface SavedDoc {
  key: string;
  status?: string;
  userRating?: number | null;
}

/** Summarises a user's watchlist into passport stats. Only aggregates are ever stored on-chain. */
export async function computeTaste(userId: string): Promise<TasteStats | null> {
  const db = await getDb();
  if (!db) return null;

  const saved = await db
    .collection<SavedDoc>("watchlist")
    .find({ userId }, { projection: { key: 1, status: 1, userRating: 1 } })
    .limit(500)
    .toArray();

  const catalog = saved.length
    ? await db
        .collection<{ _id: string; genres: string[]; anime: boolean }>("titles")
        .find({ _id: { $in: saved.map((s) => s.key) } }, { projection: { genres: 1, anime: 1 } })
        .toArray()
    : [];

  const genreCounts = new Map<string, number>();
  let anime = 0;
  for (const t of catalog) {
    for (const g of t.genres ?? []) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    if (t.anime) anime++;
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  const ratings = saved.map((s) => s.userRating).filter((r): r is number => typeof r === "number");
  const animeShare = catalog.length ? anime / catalog.length : 0;
  const base = (topGenres[0] && ARCHETYPES[topGenres[0].name]) || "Genre Hopper";

  return {
    saved: saved.length,
    watched: saved.filter((s) => s.status === "watched").length,
    watching: saved.filter((s) => s.status === "watching").length,
    avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    anime,
    topGenres,
    archetype: animeShare >= 0.4 ? `Anime ${base}` : base,
  };
}

/** On-chain attribute list for a snapshot. */
export function attributesFor(stats: TasteStats): { key: string; value: string }[] {
  return [
    { key: "Archetype", value: stats.archetype },
    { key: "Titles Saved", value: String(stats.saved) },
    { key: "Watched", value: String(stats.watched) },
    { key: "Avg Rating Given", value: stats.avgRating === null ? "n/a" : `${stats.avgRating}/5` },
    ...stats.topGenres.map((g, i) => ({ key: `Top Genre ${i + 1}`, value: g.name })),
    { key: "Anime Titles", value: String(stats.anime) },
  ];
}

export async function passportsCollection() {
  const db = await getDb();
  if (!db) return null;
  const collection = db.collection<PassportRecord>("passports");
  await collection.createIndex({ userId: 1 }, { unique: true }).catch(() => undefined);
  return collection;
}
