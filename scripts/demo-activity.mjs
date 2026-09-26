// Seeds (or clears) sample trending activity for demos. Every row is tagged source = 'demo',
// and the trending UI discloses when demo rows are included.
//
// Usage:
//   node --env-file=.env.local scripts/demo-activity.mjs seed [hours=24] [events=320]
//   node --env-file=.env.local scripts/demo-activity.mjs clear
import pg from "pg";
import { MongoClient } from "mongodb";

const [command = "seed", hoursArg, countArg] = process.argv.slice(2);
if (!["seed", "clear"].includes(command)) throw new Error("Use: seed [hours] [events] | clear");
if (!process.env.TIGER_DATABASE_URL) throw new Error("TIGER_DATABASE_URL is not set");

const url = new URL(process.env.TIGER_DATABASE_URL);
url.searchParams.set("sslmode", "require");
url.searchParams.set("uselibpqcompat", "true");
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();

async function refreshAggregates() {
  for (const view of ["title_activity_hourly", "query_activity_hourly", "total_activity_hourly"]) {
    await client.query(`CALL refresh_continuous_aggregate('${view}', NULL, NULL)`);
  }
}

if (command === "clear") {
  const removed = await client.query("DELETE FROM events WHERE source = 'demo'");
  await refreshAggregates();
  console.log(`Removed ${removed.rowCount} demo events.`);
  await client.end();
  process.exit(0);
}

const hours = Number(hoursArg || 24);
const total = Number(countArg || 320);

// Start from a clean demo slate so reruns don't stack up.
await client.query("DELETE FROM events WHERE source = 'demo'");

const mongo = await new MongoClient(process.env.MONGODB_URI).connect();
const catalog = await mongo
  .db("mediamax")
  .collection("titles")
  .find({}, { projection: { mediaType: 1, tmdbId: 1, title: 1 } })
  .sort({ voteCount: -1 })
  .limit(60)
  .toArray();
await mongo.close();

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

// Popularity follows a rough power law so a handful of titles clearly lead the board.
const weights = catalog.map((_, i) => 1 / Math.pow(i + 1, 0.9));
const weightSum = weights.reduce((a, b) => a + b, 0);
function pickTitle() {
  let r = Math.random() * weightSum;
  for (let i = 0; i < catalog.length; i++) {
    r -= weights[i];
    if (r <= 0) return catalog[i];
  }
  return catalog[0];
}

// More activity in recent hours, with a natural evening bump.
function pickTime() {
  const ageHours = Math.pow(Math.random(), 1.6) * hours;
  const t = new Date(Date.now() - ageHours * 3600_000);
  const hour = t.getHours();
  if (hour >= 1 && hour <= 6 && Math.random() < 0.6) return pickTime();
  return t;
}

const rows = [];
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

for (let i = 0; i < rows.length; i += 100) {
  const chunk = rows.slice(i, i + 100);
  const values = chunk
    .map((_, j) => `($${j * 6 + 1}, $${j * 6 + 2}, $${j * 6 + 3}, $${j * 6 + 4}, $${j * 6 + 5}, $${j * 6 + 6}, 'demo')`)
    .join(", ");
  await client.query(
    `INSERT INTO events (time, kind, media_type, tmdb_id, title, query, source) VALUES ${values}`,
    chunk.flat()
  );
}

await refreshAggregates();
console.log(`Seeded ${rows.length} demo events across the last ${hours} hours (tagged source='demo').`);
await client.end();
