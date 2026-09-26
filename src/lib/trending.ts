import { cached } from "@/lib/cache";
import { attachRatings } from "@/lib/ratings";
import { getTiger } from "@/lib/tiger";
import { getTitleCard } from "@/lib/tmdb";
import { DEMO_MIN_EVENTS, seedDemoActivity } from "@/lib/demoActivity";
import type { MediaType, Recommendation } from "@/types/media";

export interface TrendingTitle extends Recommendation {
  searches: number;
  saves: number;
  /** Hourly activity for the last 24 hours, oldest first. */
  series: number[];
}

export interface TrendingData {
  titles: TrendingTitle[];
  queries: { query: string; count: number }[];
  /** Total events per hour for the last 24 hours, oldest first. */
  activity: { hour: string; events: number }[];
  /** True when the window includes sample activity seeded for demos (source = 'demo'). */
  includesDemo: boolean;
  generatedAt: string;
}

const EMPTY: TrendingData = { titles: [], queries: [], activity: [], includesDemo: false, generatedAt: "" };
const HOURS = 24;

// Recent activity counts more: weights decay with a 6-hour time constant, and a save is worth 3 searches.
const TOP_TITLES_SQL = `
  SELECT media_type, tmdb_id, max(title) AS title,
         sum(searches)::int AS searches, sum(saves)::int AS saves,
         sum((searches + 3 * saves) * exp(-extract(epoch FROM (now() - bucket)) / 21600.0)) AS score
  FROM title_activity_hourly
  WHERE bucket > now() - INTERVAL '24 hours' AND (source <> 'demo' OR $1::boolean)
  GROUP BY media_type, tmdb_id
  ORDER BY score DESC
  LIMIT 8`;

// Gap-filled hourly series so quiet hours show as zero instead of disappearing.
const SERIES_SQL = `
  SELECT media_type, tmdb_id,
         time_bucket_gapfill(INTERVAL '1 hour', bucket,
           now() - INTERVAL '24 hours', now()) AS hour,
         coalesce(sum(searches + saves), 0)::int AS n
  FROM title_activity_hourly
  WHERE bucket >= now() - INTERVAL '24 hours' AND bucket <= now()
    AND (source <> 'demo' OR $1::boolean)
    AND tmdb_id = ANY($2::int[])
  GROUP BY media_type, tmdb_id, hour
  ORDER BY media_type, tmdb_id, hour`;

const TOP_QUERIES_SQL = `
  SELECT query, sum(searches)::int AS count
  FROM query_activity_hourly
  WHERE bucket > now() - INTERVAL '24 hours' AND (source <> 'demo' OR $1::boolean)
  GROUP BY query
  ORDER BY count DESC, max(bucket) DESC
  LIMIT 8`;

const DEMO_SQL = `
  SELECT count(*)::int AS n
  FROM events
  WHERE source = 'demo' AND time > now() - INTERVAL '24 hours'`;

const ACTIVITY_SQL = `
  SELECT time_bucket_gapfill(INTERVAL '1 hour', bucket,
           now() - INTERVAL '24 hours', now()) AS hour,
         coalesce(sum(events), 0)::int AS events
  FROM total_activity_hourly
  WHERE bucket >= now() - INTERVAL '24 hours' AND bucket <= now()
    AND (source <> 'demo' OR $1::boolean)
  GROUP BY hour
  ORDER BY hour`;

async function compute(includeDemo: boolean): Promise<TrendingData> {
  const pool = getTiger();
  if (!pool) return EMPTY;

  // The showcase is for demo accounts only. If its sample activity has aged out, regenerate it first.
  if (includeDemo) {
    const { rows } = await pool.query<{ n: number }>(DEMO_SQL);
    if ((rows[0]?.n ?? 0) < DEMO_MIN_EVENTS) await seedDemoActivity();
  }

  const [top, queries, activity, demo] = await Promise.all([
    pool.query<{ media_type: MediaType; tmdb_id: number; searches: number; saves: number }>(
      TOP_TITLES_SQL,
      [includeDemo]
    ),
    pool.query<{ query: string; count: number }>(TOP_QUERIES_SQL, [includeDemo]),
    pool.query<{ hour: Date; events: number }>(ACTIVITY_SQL, [includeDemo]),
    pool.query<{ n: number }>(DEMO_SQL),
  ]);

  const ids = top.rows.map((r) => r.tmdb_id);
  const seriesRows = ids.length
    ? (await pool.query<{ media_type: MediaType; tmdb_id: number; n: number }>(SERIES_SQL, [includeDemo, ids])).rows
    : [];

  const seriesByKey = new Map<string, number[]>();
  for (const row of seriesRows) {
    const key = `${row.media_type}:${row.tmdb_id}`;
    seriesByKey.set(key, [...(seriesByKey.get(key) ?? []), row.n]);
  }

  const cards = await Promise.all(top.rows.map((r) => getTitleCard(r.media_type, r.tmdb_id)));
  const withCards = top.rows.flatMap((r, i) => {
    const card = cards[i];
    if (!card) return [];
    const series = (seriesByKey.get(`${r.media_type}:${r.tmdb_id}`) ?? []).slice(-HOURS);
    return [{ ...card, searches: r.searches, saves: r.saves, series }];
  });

  return {
    titles: await attachRatings(withCards),
    queries: queries.rows,
    activity: activity.rows.slice(-HOURS).map((r) => ({
      hour: new Date(r.hour).toISOString(),
      events: r.events,
    })),
    includesDemo: includeDemo && (demo.rows[0]?.n ?? 0) > 0,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Trending snapshot from Tiger Data, cached briefly so page views don't hammer the database.
 * Demo accounts get the showcase view (real + sample activity); everyone else sees real activity only.
 */
export async function getTrending(includeDemo = false): Promise<TrendingData> {
  try {
    return await cached(`trending:v3:${includeDemo ? "demo" : "public"}`, 60, () => compute(includeDemo));
  } catch (error) {
    console.error("Trending query failed:", error instanceof Error ? error.message : error);
    return EMPTY;
  }
}
