import { getDb } from "@/lib/mongodb";
import { getWatchProviders, TMDB_IMAGE_BASE_URL } from "@/lib/tmdb";
import type { MediaType, Recommendation } from "@/types/media";

interface CatalogRow {
  _id: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  genres: string[];
  overview: string;
  posterPath: string | null;
  anime: boolean;
  voteAverage: number;
  voteCount: number;
}

// Deterministic PRNG so every reset produces the same, presentable history.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const has = (t: CatalogRow, ...genres: string[]) => genres.some((g) => t.genres.includes(g));

const REGION = process.env.TMDB_WATCH_REGION || "US";
const WATCHED_TARGET = 54;
const DAY = 86_400_000;

/** Fills a user's dashboard with a coherent sci-fi / crime / anime viewing history. */
export async function seedDemoAccount(userId: string): Promise<{ watched: number; watching: number; want: number; favorites: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const catalog = await db
    .collection<CatalogRow>("titles")
    .find({ voteCount: { $gte: 1500 } }, { projection: { embedding: 0, popularity: 0 } })
    .sort({ voteCount: -1 })
    .limit(700)
    .toArray();

  const rand = mulberry32(2026);
  const used = new Set<string>();
  const take = (predicate: (t: CatalogRow) => boolean, count: number): CatalogRow[] => {
    const picked: CatalogRow[] = [];
    for (const t of catalog) {
      if (picked.length >= count) break;
      if (!used.has(t._id) && predicate(t) && t.overview) {
        used.add(t._id);
        picked.push(t);
      }
    }
    return picked;
  };

  // The person's taste: sci-fi first, then crime and thrillers, anime, drama, some comedy.
  // Non-sci-fi picks avoid Action/Adventure tags so science fiction stays the clear headline genre.
  const plain = (t: CatalogRow) => !t.anime && !has(t, "Action", "Adventure", "Action & Adventure");
  const watched = [
    ...take((t) => has(t, "Science Fiction", "Sci-Fi & Fantasy") && !t.anime, 24),
    ...take((t) => has(t, "Crime", "Thriller", "Mystery") && plain(t), 11),
    ...take((t) => t.anime, 8),
    ...take((t) => has(t, "Drama") && plain(t), 7),
    ...take((t) => has(t, "Comedy") && plain(t), 4),
  ].slice(0, WATCHED_TARGET);
  const watching = take((t) => t.mediaType === "tv" && has(t, "Science Fiction", "Sci-Fi & Fantasy", "Crime", "Drama"), 3);
  const want = [...take((t) => has(t, "Science Fiction", "Sci-Fi & Fantasy"), 5), ...take((t) => t.mediaType === "tv", 4)];

  // Most-recently watched are well-known titles, so their "Because you watched" rows are strong.
  const byFame = [...watched].sort((a, b) => b.voteCount - a.voteCount);
  const recent = byFame.slice(0, 6);
  const older = watched.filter((t) => !recent.includes(t)).sort(() => rand() - 0.5);
  const timeline = [...recent, ...older]; // index 0 = most recent

  // A believable spread: mostly 3.5-5 with a handful of clear misses, centred slightly under TMDB's score.
  const rating = (t: CatalogRow): number => {
    const tasteBonus = has(t, "Science Fiction", "Sci-Fi & Fantasy") ? 0.35 : t.anime ? 0.2 : 0;
    const raw = t.voteAverage / 2 - 0.2 + tasteBonus + (rand() - 0.5) * 1.5;
    return Math.min(5, Math.max(2, Math.round(raw * 2) / 2));
  };

  const ratings = new Map(watched.map((t) => [t._id, rating(t)]));
  // Five-star favorites: the best-regarded sci-fi (this viewer's headline genre) plus a few standouts elsewhere.
  const isSciFi = (t: CatalogRow) => has(t, "Science Fiction", "Sci-Fi & Fantasy") && !t.anime;
  const byScore = [...watched].sort((a, b) => b.voteAverage - a.voteAverage);
  [...byScore.filter(isSciFi).slice(0, 6), ...byScore.filter((t) => !isSciFi(t)).slice(0, 3)].forEach((t) =>
    ratings.set(t._id, 5)
  );
  // Lowest-scored titles become the ones this viewer didn't love.
  const misses = [...watched].sort((a, b) => a.voteAverage - b.voteAverage).slice(0, 6);
  misses.forEach((t, i) => ratings.set(t._id, [2, 2.5, 3, 2.5, 3, 3.5][i]));

  const favoriteKeys = new Set(
    [...watched].sort((a, b) => (ratings.get(b._id) ?? 0) - (ratings.get(a._id) ?? 0)).slice(0, 9).map((t) => t._id)
  );

  const everything = [...watched, ...watching, ...want];
  const providers = new Map<string, Awaited<ReturnType<typeof getWatchProviders>>>();
  for (let i = 0; i < everything.length; i += 8) {
    await Promise.all(
      everything.slice(i, i + 8).map(async (t) => {
        providers.set(t._id, await getWatchProviders(t.mediaType, t.tmdbId, REGION).catch(() => []));
      })
    );
  }

  const snapshot = (t: CatalogRow): Recommendation => ({
    id: t.tmdbId,
    mediaType: t.mediaType,
    title: t.title,
    posterPath: t.posterPath ? `${TMDB_IMAGE_BASE_URL}/w342${t.posterPath}` : null,
    synopsis: t.overview,
    streamingProviders: providers.get(t._id) ?? [],
  });

  const now = Date.now();
  const docs = [
    ...watched.map((t) => {
      const idx = timeline.indexOf(t);
      const watchedAt = new Date(now - (idx * 2.1 + rand() * 1.2 + 0.6) * DAY);
      return {
        userId,
        key: t._id,
        item: snapshot(t),
        addedAt: new Date(watchedAt.getTime() - (2 + rand() * 20) * DAY),
        status: "watched",
        statusUpdatedAt: watchedAt,
        userRating: ratings.get(t._id) ?? null,
        favorite: favoriteKeys.has(t._id),
      };
    }),
    ...watching.map((t, i) => ({
      userId,
      key: t._id,
      item: snapshot(t),
      addedAt: new Date(now - (6 + i) * DAY),
      status: "watching",
      statusUpdatedAt: new Date(now - (i * 1.5 + 0.3) * 3_600_000 * 8),
      userRating: null,
      favorite: false,
    })),
    ...want.map((t, i) => ({
      userId,
      key: t._id,
      item: snapshot(t),
      addedAt: new Date(now - (i + 1) * 0.7 * DAY),
      status: "want",
      statusUpdatedAt: new Date(now - (i + 1) * 0.7 * DAY),
      userRating: null,
      favorite: false,
    })),
  ];

  const collection = db.collection("watchlist");
  await collection.createIndex({ userId: 1, key: 1 }, { unique: true }).catch(() => undefined);
  await collection.deleteMany({ userId });
  await collection.insertMany(docs);

  // A friendly default alias for the discussion, only if the account has none yet.
  await db
    .collection<{ _id: string; username: string; usernameLower: string; updatedAt: Date }>("profiles")
    .insertOne({ _id: userId, username: "demo_viewer", usernameLower: "demo_viewer", updatedAt: new Date() })
    .catch(() => undefined);

  return { watched: watched.length, watching: watching.length, want: want.length, favorites: favoriteKeys.size };
}
