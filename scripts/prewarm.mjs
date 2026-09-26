// Pre-computes refined recommendations for the most popular catalog titles so
// their first search is instant. Results land in the shared Atlas cache.
// Usage: node --env-file=.env.local scripts/prewarm.mjs [baseUrl] [count]
import { MongoClient } from "mongodb";

const base = process.argv[2] || "http://localhost:3000";
const count = Number(process.argv[3] || 120);
const CONCURRENCY = 2;

const client = await new MongoClient(process.env.MONGODB_URI).connect();
const titles = await client
  .db("mediamax")
  .collection("titles")
  .find({}, { projection: { mediaType: 1, tmdbId: 1, title: 1 } })
  .sort({ voteCount: -1 })
  .limit(count)
  .toArray();
await client.close();

let done = 0;
let refined = 0;
const failed = [];
let next = 0;

async function worker() {
  while (next < titles.length) {
    const t = titles[next++];
    const started = Date.now();
    try {
      const res = await fetch(
        `${base}/api/recommendations?mediaType=${t.mediaType}&id=${t.tmdbId}`,
        {
          signal: AbortSignal.timeout(60000),
        },
      );
      const data = await res.json();
      if (data.results?.[0]?.blurb) refined++;
      else failed.push(t.title);
    } catch {
      failed.push(t.title);
    }
    done++;
    console.log(`${done}/${titles.length} ${t.title} (${Date.now() - started}ms)`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`Done. Refined and cached: ${refined}. Not refined: ${failed.length}`);
if (failed.length) console.log("Rerun to retry:", failed.slice(0, 20).join(", "));
