# Media Max

**Select your next watch.** Media Max is a discovery-first companion for movies, TV and anime.
Search a title or describe a vibe, get recommendations that genuinely match with a written reason
for each, and see exactly where to stream them. Live at [mediamax.select](https://mediamax.select).

Built for ShellHacks. Letterboxd is where you log what you watched; Media Max is where you decide
what to watch next.

## Features

- **Title search and vibe search.** Type "Interstellar" or "cozy rainy-day sci-fi with heart".
- **Recommendations that match.** An embedded catalog (Atlas Vector Search) supplies candidates and
  Gemini keeps only the true matches, with a spoiler-free blurb and a one-line "why it matches".
- **Where to stream**, from TMDB and JustWatch data, plus TMDB and optional IMDb / Rotten Tomatoes scores.
- **Dashboard.** Watching / Want / Watched rows, favorites, half-star ratings, an automatic "top rated"
  row, "Because you watched ..." rows, taste-based picks, and a continue-watching highlight.
- **Discussion on every title.** Threaded comments with usernames (aliases, so real names stay
  private), spoiler covers, and reasoned reports with community auto-moderation.
- **Voice.** Search by speaking (ElevenLabs Scribe) and optionally hear the picks read aloud (ElevenLabs TTS).
- **Trending.** Anonymous activity is stored in a Tiger Data (TimescaleDB) hypertable and rolled up
  hourly by continuous aggregates.
- **Demo mode.** Allowlisted demo accounts get a preloaded dashboard and a showcase trending view.
  Sample data is always labeled and never shown to regular visitors.

## Architecture

```
Browser (Next.js App Router, React 19, Tailwind 4)
   |
Next.js route handlers (src/app/api/*)
   |-- TMDB API ............ search, details, recommendations, watch providers
   |-- MongoDB Atlas ....... catalog + vector index, watchlists, comments, profiles, cache, rate limits
   |-- Gemini API .......... query/catalog embeddings, reranking, blurbs (model chain with fallbacks)
   |-- Tiger Data .......... trending events (hypertable + continuous aggregates)
   |-- ElevenLabs .......... speech-to-text and text-to-speech
   |-- Auth.js (Google) .... sign-in with JWT sessions
```

Key modules in `src/lib`:

| Module | Purpose |
| --- | --- |
| `recommend.ts` | Vibe, title and personal recommendations (retrieve, refine, hydrate) |
| `catalog.ts`, `embeddings.ts` | Atlas Vector Search queries and Gemini embeddings |
| `refine.ts` | Reranks candidates with a hedged chain of models |
| `tmdb.ts`, `ratings.ts` | TMDB client and rating lookups |
| `cache.ts` | Read-through cache in MongoDB with TTL |
| `trending.ts`, `events.ts`, `tiger.ts` | Anonymous event log and trending queries |
| `comments.ts`, `profile.ts` | Discussion and usernames |

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in the values below
npm run dev
```

Required: `TMDB_API_READ_ACCESS_TOKEN`, `MONGODB_URI`, `GEMINI_API_KEY`, `AUTH_SECRET`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. Optional: `ELEVENLABS_API_KEY` (voice),
`TIGER_DATABASE_URL` (trending), `OMDB_API_KEY` (IMDb / Rotten Tomatoes scores),
`DO_INFERENCE_KEY` (extra model in the refinement chain), `DEMO_ACCOUNT_EMAILS` (demo accounts).
Every optional feature degrades gracefully when its key is missing.

### One-time data setup

```bash
node --env-file=.env.local scripts/ingest-catalog.mjs   # embed titles into Atlas (resumable, rate-limit aware)
node --env-file=.env.local scripts/setup-tiger.mjs      # create the trending schema (idempotent)
node --env-file=.env.local scripts/prewarm.mjs          # optional: precompute popular title recommendations
```

Atlas Search needs a vector index named `titles_vector` on `titles.embedding` (768 dimensions,
cosine); the ingest script creates it.

### Scripts

`npm run dev`, `build`, `lint`, `typecheck`, `format`, `format:check`.

## Data and attribution

This product uses the TMDB API but is not endorsed or certified by TMDB. Streaming availability
data is provided by JustWatch via TMDB. Free-tier limits apply to several providers; see the code
comments in `refine.ts` and the ingest script for how quotas are handled.

## License

MIT
