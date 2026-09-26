// Builds the searchable title catalog in MongoDB Atlas.
// Usage: node --env-file=.env.local scripts/ingest-catalog.mjs
import { GoogleGenAI } from "@google/genai";
import { MongoClient } from "mongodb";

const TMDB = "https://api.themoviedb.org/3";
const EMBED_MODEL = "gemini-embedding-001";
const DIMENSIONS = 768;
const INDEX_NAME = "titles_vector";

const SOURCES = [
  { mediaType: "movie", pages: 60, anime: false, params: { "vote_count.gte": "500" } },
  { mediaType: "tv", pages: 60, anime: false, params: { "vote_count.gte": "300" } },
  {
    mediaType: "tv",
    pages: 25,
    anime: true,
    params: { with_genres: "16", with_original_language: "ja", "vote_count.gte": "100" },
  },
  {
    mediaType: "movie",
    pages: 10,
    anime: true,
    params: { with_genres: "16", with_original_language: "ja", "vote_count.gte": "150" },
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(path, params = {}) {
  const url = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_API_READ_ACCESS_TOKEN}`,
        accept: "application/json",
      },
    });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) await sleep(1000 * (attempt + 1));
    else throw new Error(`TMDB ${res.status} ${path}`);
  }
  throw new Error(`TMDB gave up on ${path}`);
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return results;
}

async function main() {
  for (const v of ["TMDB_API_READ_ACCESS_TOKEN", "GEMINI_API_KEY", "MONGODB_URI"]) {
    if (!process.env[v]) throw new Error(`${v} is not set`);
  }

  const client = await new MongoClient(process.env.MONGODB_URI).connect();
  const col = client.db("mediamax").collection("titles");
  const ai = new GoogleGenAI({});

  const genreMaps = {};
  for (const type of ["movie", "tv"]) {
    const g = await tmdb(`/genre/${type}/list`);
    genreMaps[type] = Object.fromEntries(g.genres.map((x) => [x.id, x.name]));
  }

  const found = new Map();
  for (const src of SOURCES) {
    const pages = Array.from({ length: src.pages }, (_, i) => i + 1);
    const label = `${src.mediaType}${src.anime ? " (anime)" : ""}`;
    const results = await mapLimit(pages, 8, (page) =>
      tmdb(`/discover/${src.mediaType}`, {
        ...src.params,
        sort_by: "vote_count.desc",
        include_adult: "false",
        page: String(page),
      }).catch(() => ({ results: [] })),
    );
    let added = 0;
    for (const page of results) {
      for (const r of page.results) {
        const key = `${src.mediaType}:${r.id}`;
        if (found.has(key) && !src.anime) continue;
        if (!r.overview || r.overview.length < 20) continue;
        const date = r.release_date || r.first_air_date || "";
        found.set(key, {
          _id: key,
          tmdbId: r.id,
          mediaType: src.mediaType,
          title: r.title || r.name,
          year: date ? Number(date.slice(0, 4)) : null,
          genres: (r.genre_ids || []).map((id) => genreMaps[src.mediaType][id]).filter(Boolean),
          overview: r.overview,
          posterPath: r.poster_path || null,
          popularity: r.popularity,
          voteAverage: r.vote_average,
          voteCount: r.vote_count,
          anime: src.anime || found.get(key)?.anime || false,
        });
        added++;
      }
    }
    console.log(`TMDB ${label}: +${added} (total ${found.size})`);
  }

  const existing = new Set(
    (await col.find({ embedding: { $exists: true } }, { projection: { _id: 1 } }).toArray()).map(
      (d) => d._id,
    ),
  );
  // INGEST_LIMIT caps texts embedded per run, leaving daily quota for live searches.
  const limit = Number(process.env.INGEST_LIMIT || Infinity);
  const todo = [...found.values()]
    .filter((d) => !existing.has(d._id))
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, limit);
  console.log(`Already embedded: ${existing.size}. To embed now: ${todo.length}`);

  const BATCH = 50; // free tier allows 100 embed requests/min, one per text
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const texts = batch.map(
      (d) => `${d.title} (${d.year ?? "n/a"}). Genres: ${d.genres.join(", ")}. ${d.overview}`,
    );

    let embeddings;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const res = await ai.models.embedContent({
          model: EMBED_MODEL,
          contents: texts,
          config: { taskType: "RETRIEVAL_DOCUMENT", outputDimensionality: DIMENSIONS },
        });
        embeddings = res.embeddings.map((e) => e.values);
        break;
      } catch (e) {
        const hinted = /retry in ([\d.]+)s/.exec(String(e.message));
        const wait = hinted ? Math.ceil(Number(hinted[1]) * 1000) + 2000 : 8000 * (attempt + 1);
        console.log(
          `  embed retry ${attempt + 1} in ${wait / 1000}s: ${String(e.message).slice(0, 90)}`,
        );
        await sleep(wait);
      }
    }
    if (!embeddings) throw new Error("Embedding failed repeatedly; rerun to resume");

    await col.bulkWrite(
      batch.map((d, idx) => ({
        replaceOne: {
          filter: { _id: d._id },
          replacement: { ...d, embedding: embeddings[idx] },
          upsert: true,
        },
      })),
    );
    console.log(`Embedded ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    await sleep(32000);
  }

  const indexes = await col.listSearchIndexes().toArray();
  if (!indexes.some((ix) => ix.name === INDEX_NAME)) {
    await col.createSearchIndex({
      name: INDEX_NAME,
      type: "vectorSearch",
      definition: {
        fields: [
          { type: "vector", path: "embedding", numDimensions: DIMENSIONS, similarity: "cosine" },
          { type: "filter", path: "mediaType" },
          { type: "filter", path: "anime" },
        ],
      },
    });
    console.log("Created vector index; waiting for it to become queryable...");
  }
  for (let i = 0; i < 40; i++) {
    const ix = (await col.listSearchIndexes().toArray()).find((x) => x.name === INDEX_NAME);
    if (ix?.queryable) {
      console.log(`Vector index ready. Catalog size: ${await col.countDocuments()}`);
      break;
    }
    await sleep(5000);
  }

  await client.close();
}

main().catch((e) => {
  console.error("INGEST FAILED:", e.message);
  process.exit(1);
});
