import { createHash } from "node:crypto";
import { cached } from "@/lib/cache";
import { DAY_SECONDS, WATCH_REGION } from "@/lib/config";
import {
  catalogKey,
  getCatalogEntry,
  nearestTitles,
  type CatalogTitle,
} from "@/lib/catalog";
import { embedQuery } from "@/lib/embeddings";
import { refineCandidates, type Candidate } from "@/lib/refine";
import {
  TMDB_IMAGE_BASE_URL,
  fetchRawRecommendations,
  getWatchProviders,
  tmdbFetch,
} from "@/lib/tmdb";
import type { MediaType, Recommendation } from "@/types/media";


function poster(path: string | null): string | null {
  return path ? `${TMDB_IMAGE_BASE_URL}/w342${path}` : null;
}

function fromCatalog(t: CatalogTitle): Candidate {
  return {
    key: t._id,
    id: t.tmdbId,
    mediaType: t.mediaType,
    title: t.title,
    year: t.year,
    genres: t.genres,
    overview: t.overview,
    posterPath: poster(t.posterPath),
  };
}

/** Carries vector-ranked results out of a cache loader without caching them. */
class DegradedResults extends Error {
  constructor(readonly results: Recommendation[]) {
    super("Returning vector-ranked results without LLM refinement");
  }
}

function shortBlurb(overview: string): string {
  const firstSentence = overview.split(/(?<=[.!?])\s/)[0] ?? overview;
  const text = firstSentence.length > 20 ? firstSentence : overview;
  return text.length > 150 ? `${text.slice(0, 147).trimEnd()}...` : text;
}

async function hydrateUnrefined(
  candidates: Candidate[],
  count: number,
): Promise<Recommendation[]> {
  return hydrate(
    candidates,
    candidates
      .slice(0, count)
      .map((c) => ({ key: c.key, blurb: shortBlurb(c.overview), why: "" })),
  );
}

async function hydrate(
  candidates: Candidate[],
  refined: { key: string; blurb: string; why: string }[],
): Promise<Recommendation[]> {
  const byKey = new Map(candidates.map((c) => [c.key, c]));
  return Promise.all(
    refined.map(async (r): Promise<Recommendation> => {
      const c = byKey.get(r.key)!;
      return {
        id: c.id,
        mediaType: c.mediaType,
        title: c.title,
        posterPath: c.posterPath,
        synopsis: c.overview,
        blurb: r.blurb,
        why: r.why || undefined,
        streamingProviders: await getWatchProviders(
          c.mediaType,
          c.id,
          WATCH_REGION,
        ),
      };
    }),
  );
}

/** Vibe search: embed the description, pull nearest catalog titles, let Gemini pick and explain. */
export async function vibeRecommendations(
  vibe: string,
): Promise<Recommendation[]> {
  const normalized = vibe.toLowerCase().replace(/\s+/g, " ").trim();
  return cached(`vibe3:${normalized}`, 7 * DAY_SECONDS, async () => {
    const vector = await embedQuery(vibe);
    const nearest = await nearestTitles(vector, { limit: 30 });
    if (nearest.length < 8) {
      throw new Error("Catalog unavailable or too small");
    }

    const candidates = nearest.map(fromCatalog);
    try {
      const refined = await refineCandidates(
        `The user wants: "${vibe}"`,
        candidates,
        {
          max: 8,
          min: 5,
        },
      );
      return await hydrate(candidates, refined);
    } catch (error) {
      console.error(
        "Vibe refinement unavailable:",
        error instanceof Error ? error.message.slice(0, 120) : error,
      );
      throw new DegradedResults(await hydrateUnrefined(candidates, 8));
    }
  }).catch((error) => {
    if (error instanceof DegradedResults) return error.results;
    throw error;
  });
}

interface TmdbDetails {
  title?: string;
  name?: string;
  overview: string;
  genres: { name: string }[];
  release_date?: string;
  first_air_date?: string;
}

/** Title search: merge catalog neighbours with TMDB's own suggestions, then keep only true matches. */
export async function titleRecommendations(
  mediaType: MediaType,
  id: number,
): Promise<Recommendation[]> {
  return cached(`rec3:${mediaType}:${id}`, 7 * DAY_SECONDS, async () => {
    const seedKey = catalogKey(mediaType, id);
    const details = await tmdbFetch<TmdbDetails>(`/${mediaType}/${id}`);
    const seedTitle = details.title ?? details.name ?? "this title";
    const seedYear = (
      details.release_date ??
      details.first_air_date ??
      ""
    ).slice(0, 4);
    const seedGenres = details.genres.map((g) => g.name);
    const seedText = `${seedTitle} (${seedYear}). Genres: ${seedGenres.join(", ")}. ${details.overview}`;

    const catalogSeed = await getCatalogEntry(seedKey);
    const vector = catalogSeed?.embedding ?? (await embedQuery(seedText));

    const [neighbours, tmdbRecs] = await Promise.all([
      nearestTitles(vector, { limit: 30, excludeKey: seedKey }),
      fetchRawRecommendations(mediaType, id).catch(() => []),
    ]);

    const candidates: Candidate[] = neighbours.map(fromCatalog);
    const seen = new Set(candidates.map((c) => c.key));
    seen.add(seedKey);
    for (const r of tmdbRecs.slice(0, 15)) {
      const key = catalogKey(mediaType, r.id);
      if (seen.has(key) || !r.overview) continue;
      seen.add(key);
      const date = r.release_date ?? r.first_air_date ?? "";
      candidates.push({
        key,
        id: r.id,
        mediaType,
        title: r.title ?? r.name ?? "Untitled",
        year: date ? Number(date.slice(0, 4)) : null,
        genres: [],
        overview: r.overview,
        posterPath: poster(r.poster_path),
      });
    }

    if (candidates.length < 6) {
      throw new Error("Not enough candidates to refine");
    }

    try {
      const refined = await refineCandidates(
        `The user loved: ${seedTitle} (${seedYear}), ${mediaType === "tv" ? "TV" : "Movie"}. Genres: ${seedGenres.join(", ")}. ${details.overview.slice(0, 400)}
They want titles a fan of this would love next.`,
        candidates.slice(0, 32),
        { max: 10, min: 6 },
      );
      return await hydrate(candidates, refined);
    } catch (error) {
      console.error(
        "Title refinement unavailable:",
        error instanceof Error ? error.message.slice(0, 120) : error,
      );
      throw new DegradedResults(await hydrateUnrefined(candidates, 10));
    }
  }).catch((error) => {
    if (error instanceof DegradedResults) return error.results;
    throw error;
  });
}

/** Personalised picks: average the embeddings of titles the user liked, then refine the neighbours. */
export async function personalRecommendations(
  likedKeys: string[],
  excludeKeys: string[]
): Promise<Recommendation[]> {
  const cacheKey = `picks:${createHash("sha1").update([...likedKeys].sort().join("|")).digest("hex")}`;
  return cached(cacheKey, DAY_SECONDS, async () => {
    const entries = (await Promise.all(likedKeys.map((k) => getCatalogEntry(k)))).filter(
      (e): e is NonNullable<typeof e> & { embedding: number[] } => !!e?.embedding
    );
    if (entries.length === 0) return [];

    const dims = entries[0].embedding.length;
    const mean = new Array<number>(dims).fill(0);
    for (const e of entries) {
      for (let i = 0; i < dims; i++) mean[i] += e.embedding[i] / entries.length;
    }

    const nearest = await nearestTitles(mean, { limit: 30, excludeKeys });
    if (nearest.length < 6) return [];

    const candidates = nearest.map(fromCatalog);
    try {
      const refined = await refineCandidates(
        `The user enjoyed these titles: ${entries
          .map((e) => `${e.title} (${e.genres.join("/")})`)
          .join("; ")}.
Recommend titles that fit their overall taste, weighing what these have in common.`,
        candidates,
        { max: 8, min: 5 }
      );
      return await hydrate(candidates, refined);
    } catch (error) {
      console.error("Picks refinement unavailable:", error instanceof Error ? error.message.slice(0, 120) : error);
      throw new DegradedResults(await hydrateUnrefined(candidates, 8));
    }
  }).catch((error) => {
    if (error instanceof DegradedResults) return error.results;
    throw error;
  });
}
