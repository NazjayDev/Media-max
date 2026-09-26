// Creates the Tiger Data (TimescaleDB) schema used for trending. Safe to rerun.
// Usage: node --env-file=.env.local scripts/setup-tiger.mjs
import pg from "pg";

if (!process.env.TIGER_DATABASE_URL) throw new Error("TIGER_DATABASE_URL is not set");

// Tiger Cloud uses its own CA; libpq `sslmode=require` semantics (encrypted, CA not verified) match Tiger's docs.
const url = new URL(process.env.TIGER_DATABASE_URL);
url.searchParams.set("sslmode", "require");
url.searchParams.set("uselibpqcompat", "true");
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();

async function step(label, sql, { optional = false } = {}) {
  try {
    await client.query(sql);
    console.log(`ok   ${label}`);
  } catch (error) {
    console.log(`${optional ? "skip" : "FAIL"} ${label}: ${error.message}`);
    if (!optional) throw error;
  }
}

const version = await client.query(
  "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'",
);
console.log("timescaledb:", version.rows[0]?.extversion ?? "NOT INSTALLED");

await step(
  "events table",
  `CREATE TABLE IF NOT EXISTS events (
     time       timestamptz NOT NULL DEFAULT now(),
     kind       text        NOT NULL,
     media_type text,
     tmdb_id    integer,
     title      text,
     query      text,
     source     text        NOT NULL DEFAULT 'app'
   )`,
);

await step(
  "events hypertable (1-day chunks)",
  `SELECT create_hypertable('events', 'time', chunk_time_interval => INTERVAL '1 day', if_not_exists => TRUE)`,
);

await step(
  "events index",
  `CREATE INDEX IF NOT EXISTS events_title_time ON events (media_type, tmdb_id, time DESC)`,
);

// Continuous aggregates: hourly rollups that Timescale keeps up to date incrementally.
await step(
  "title_activity_hourly (continuous aggregate)",
  `CREATE MATERIALIZED VIEW IF NOT EXISTS title_activity_hourly
   WITH (timescaledb.continuous) AS
   SELECT time_bucket(INTERVAL '1 hour', time) AS bucket,
          source,
          media_type,
          tmdb_id,
          max(title)                                   AS title,
          count(*) FILTER (WHERE kind = 'search')      AS searches,
          count(*) FILTER (WHERE kind = 'save')        AS saves
   FROM events
   WHERE tmdb_id IS NOT NULL
   GROUP BY bucket, source, media_type, tmdb_id
   WITH NO DATA`,
);

await step(
  "query_activity_hourly (continuous aggregate)",
  `CREATE MATERIALIZED VIEW IF NOT EXISTS query_activity_hourly
   WITH (timescaledb.continuous) AS
   SELECT time_bucket(INTERVAL '1 hour', time) AS bucket,
          source,
          query,
          count(*) AS searches
   FROM events
   WHERE kind = 'vibe' AND query IS NOT NULL
   GROUP BY bucket, source, query
   WITH NO DATA`,
);

await step(
  "total_activity_hourly (continuous aggregate)",
  `CREATE MATERIALIZED VIEW IF NOT EXISTS total_activity_hourly
   WITH (timescaledb.continuous) AS
   SELECT time_bucket(INTERVAL '1 hour', time) AS bucket,
          source,
          count(*) AS events
   FROM events
   GROUP BY bucket, source
   WITH NO DATA`,
);

// Real-time aggregation: recent, not-yet-materialized rows are included in reads.
for (const view of ["title_activity_hourly", "query_activity_hourly", "total_activity_hourly"]) {
  await step(
    `${view} real-time`,
    `ALTER MATERIALIZED VIEW ${view} SET (timescaledb.materialized_only = false)`,
    { optional: true },
  );
  await step(
    `${view} refresh policy`,
    `SELECT add_continuous_aggregate_policy('${view}',
       start_offset => INTERVAL '3 days',
       end_offset => INTERVAL '1 hour',
       schedule_interval => INTERVAL '15 minutes',
       if_not_exists => TRUE)`,
    { optional: true },
  );
}

await step(
  "raw events retention (90 days)",
  `SELECT add_retention_policy('events', INTERVAL '90 days', if_not_exists => TRUE)`,
  { optional: true },
);

await step(
  "compression settings",
  `ALTER TABLE events SET (timescaledb.compress, timescaledb.compress_orderby = 'time DESC')`,
  {
    optional: true,
  },
);
await step(
  "compress chunks older than 7 days",
  `SELECT add_compression_policy('events', INTERVAL '7 days', if_not_exists => TRUE)`,
  { optional: true },
);

await client.end();
console.log("Done.");
