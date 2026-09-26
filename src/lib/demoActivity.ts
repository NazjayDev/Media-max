import { getDb } from "@/lib/mongodb";
import { getTiger } from "@/lib/tiger";

const VIBES = [
  "cozy rainy-day sci-fi with heart",
  "gritty neon heist with a killer soundtrack",
  "feel-good sports underdog anime",
  "slow-burn mystery in a small town",
  "mind-bending thriller with a twist ending",
  "wholesome comfort show to fall asleep to",
  "epic fantasy with found family",
  "dark comedy about awful people",
  "beautiful animated film that will make me cry",
  "space survival movie, hard sci-fi",
];

/** Below this many sample events in the last 24 hours, the showcase counts as stale. */
export const DEMO_MIN_EVENTS = 120;

/**
 * Replaces the sample activity (source = 'demo') with a fresh, natural-looking day of searches and saves.
 * Sample rows are only ever shown to demo accounts, never mixed into what regular visitors see.
 */
export async function seedDemoActivity(hours = 24, total = 320): Promise<number> {
  const pool = getTiger();
  const db = await getDb();
  if (!pool || !db) throw new Error("Trending storage is unavailable");

  const catalog = await db
    .collection<{ mediaType: string; tmdbId: number; title: string }>("titles")
    .find({}, { projection: { mediaType: 1, tmdbId: 1, title: 1 } })
    .sort({ voteCount: -1 })
    .limit(60)
    .toArray();
  if (catalog.length === 0) throw new Error("Catalog is empty");

  // Popularity follows a rough power law so a handful of titles clearly lead the board.
  const weights = catalog.map((_, i) => 1 / Math.pow(i + 1, 0.9));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const pickTitle = () => {
    let r = Math.random() * weightSum;
    for (let i = 0; i < catalog.length; i++) {
      r -= weights[i];
      if (r <= 0) return catalog[i];
    }
    return catalog[0];
  };

  // More activity in recent hours, with quieter small hours overnight.
  const pickTime = (): Date => {
    const t = new Date(Date.now() - Math.pow(Math.random(), 1.6) * hours * 3_600_000);
    const hour = t.getHours();
    return hour >= 1 && hour <= 6 && Math.random() < 0.6 ? pickTime() : t;
  };

  type Row = [Date, string, string | null, number | null, string | null, string | null];
  const rows: Row[] = [];
  for (let i = 0; i < total; i++) {
    const time = pickTime();
    const roll = Math.random();
    if (roll < 0.18) {
      const query = VIBES[Math.floor(Math.pow(Math.random(), 1.4) * VIBES.length)];
      rows.push([time, "vibe", null, null, null, query]);
    } else {
      const t = pickTitle();
      rows.push([time, roll < 0.82 ? "search" : "save", t.mediaType, t.tmdbId, t.title, null]);
    }
  }

  await pool.query("DELETE FROM events WHERE source = 'demo'");
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const values = chunk
      .map((_, j) => `($${j * 6 + 1}, $${j * 6 + 2}, $${j * 6 + 3}, $${j * 6 + 4}, $${j * 6 + 5}, $${j * 6 + 6}, 'demo')`)
      .join(", ");
    await pool.query(
      `INSERT INTO events (time, kind, media_type, tmdb_id, title, query, source) VALUES ${values}`,
      chunk.flat()
    );
  }

  for (const view of ["title_activity_hourly", "query_activity_hourly", "total_activity_hourly"]) {
    await pool.query(`CALL refresh_continuous_aggregate('${view}', NULL, NULL)`);
  }
  // Drop the cached snapshot so the new activity shows immediately.
  await db.collection<{ _id: string }>("cache").deleteMany({ _id: { $regex: "^trending:" } });
  return rows.length;
}
