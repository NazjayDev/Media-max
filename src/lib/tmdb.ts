import { cached, cachedMany } from "@/lib/cache";
import { WATCH_REGION } from "@/lib/config";
import type {
  MediaType,
  Recommendation,
  SearchResult,
  SearchSuggestion,
  StreamingProvider,
} from "@/types/media";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

function getAuthHeaders(): HeadersInit {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) {
    throw new Error("TMDB_API_READ_ACCESS_TOKEN is not set in the environment");
  }
  return {
    Authorization: `Bearer ${token}`,
    accept: "application/json",
  };
}

const CACHE_TTL_SECONDS = 12 * 60 * 60;

function tmdbUrl(path: string, params?: Record<string, string>): URL {
  const url = new URL(`${TMDB_API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
  return url;
}

const cacheKey = (url: URL) => `tmdb:${url.pathname}${url.search}`;

async function requestTmdb<T>(url: URL): Promise<T> {
  const res = await fetch(url, { headers: getAuthHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`TMDB request failed (${res.status}) for ${url.pathname}`);
  return res.json() as Promise<T>;
}

export async function tmdbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = tmdbUrl(path, params);
  return cached(cacheKey(url), CACHE_TTL_SECONDS, () => requestTmdb<T>(url));
}

/**
 * Fetches many TMDB paths with a single cache read. Shares cache entries with `tmdbFetch`, and a
 * failed lookup yields undefined for that path instead of failing the whole batch.
 */
export async function tmdbFetchMany<T>(paths: string[]): Promise<(T | undefined)[]> {
  const urls = new Map(paths.map((p) => [cacheKey(tmdbUrl(p)), tmdbUrl(p)]));
  return cachedMany<T>(
    paths.map((p) => cacheKey(tmdbUrl(p))),
    CACHE_TTL_SECONDS,
    (key) => requestTmdb<T>(urls.get(key)!).catch(() => undefined),
  );
}

interface TmdbMultiSearchResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path: string | null;
  popularity: number;
}

const yearOf = (r: { release_date?: string; first_air_date?: string }) =>
  Number((r.release_date ?? r.first_air_date ?? "").slice(0, 4)) || null;

const normalizeTitle = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Movie and TV hits for a query, best first. A title that matches what was typed exactly beats a
 * more popular longer title ("Tron" over "Tron: Ares"), then titles starting with the query, then
 * popularity. TMDB's /search/multi also returns "person" hits, which are filtered out.
 */
async function searchTitles(query: string) {
  const data = await tmdbFetch<{ results: TmdbMultiSearchResult[] }>("/search/multi", {
    query,
    include_adult: "false",
  });
  const wanted = normalizeTitle(query);
  const rank = (name: string) => {
    const t = normalizeTitle(name);
    return t === wanted ? 0 : t.startsWith(wanted) ? 1 : 2;
  };

  return data.results
    .filter(
      (r): r is TmdbMultiSearchResult & { media_type: "movie" | "tv" } =>
        r.media_type === "movie" || r.media_type === "tv",
    )
    .map((r) => ({ ...r, name: r.title ?? r.name ?? "Untitled" }))
    .sort((a, b) => rank(a.name) - rank(b.name) || b.popularity - a.popularity);
}

const posterUrl = (path: string | null, size: string) =>
  path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null;

/** Searches TMDB for a movie/TV title and returns the single best match. */
export async function searchTitle(query: string): Promise<SearchResult | null> {
  const best = (await searchTitles(query))[0];
  if (!best) return null;
  return {
    id: best.id,
    mediaType: best.media_type,
    title: best.name,
    posterPath: posterUrl(best.poster_path, "w342"),
    year: yearOf(best),
  };
}

/** Plain title lookup: the best matches with details and where they stream, no recommendations. */
export async function lookupTitles(query: string, limit = 12): Promise<Recommendation[]> {
  const hits = (await searchTitles(query)).slice(0, limit);
  return Promise.all(
    hits.map(async (r): Promise<Recommendation> => ({
      id: r.id,
      mediaType: r.media_type,
      title: r.name,
      posterPath: posterUrl(r.poster_path, "w342"),
      synopsis: r.overview ?? "",
      year: yearOf(r),
      streamingProviders: await getWatchProviders(r.media_type, r.id, WATCH_REGION),
    })),
  );
}

/** Up to `limit` suggestions for a search-as-you-type dropdown. */
export async function suggestTitles(query: string, limit = 6): Promise<SearchSuggestion[]> {
  return (await searchTitles(query)).slice(0, limit).map((r) => ({
    id: r.id,
    mediaType: r.media_type,
    title: r.name,
    posterPath: posterUrl(r.poster_path, "w92"),
    year: yearOf(r),
  }));
}

interface TmdbRecommendationResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
  genre_ids?: number[];
  release_date?: string;
  first_air_date?: string;
}

interface TmdbRecommendationResponse {
  results: TmdbRecommendationResult[];
}

interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
}

interface TmdbWatchProvidersResponse {
  results: Record<string, { flatrate?: TmdbWatchProvider[] }>;
}

export async function fetchRawRecommendations(
  mediaType: MediaType,
  id: number,
): Promise<TmdbRecommendationResult[]> {
  const recommendations = await tmdbFetch<TmdbRecommendationResponse>(
    `/${mediaType}/${id}/recommendations`,
  );

  if (recommendations.results.length > 0) {
    return recommendations.results;
  }

  // Fall back to /similar when TMDB has no direct recommendations for this title.
  const similar = await tmdbFetch<TmdbRecommendationResponse>(`/${mediaType}/${id}/similar`);
  return similar.results;
}

interface TmdbTitleSearchResponse {
  results: (TmdbRecommendationResult & {
    release_date?: string;
    first_air_date?: string;
  })[];
}

/** Looks up one specific title by name (and optional year) and returns it with providers. */
export async function lookupRecommendation(
  title: string,
  mediaType: MediaType,
  year?: number,
  region: string = WATCH_REGION,
): Promise<Recommendation | null> {
  const params: Record<string, string> = { query: title, include_adult: "false" };
  if (year) {
    params[mediaType === "movie" ? "year" : "first_air_date_year"] = String(year);
  }

  const data = await tmdbFetch<TmdbTitleSearchResponse>(`/search/${mediaType}`, params);
  const hit = data.results[0];
  if (!hit) {
    return null;
  }

  return {
    id: hit.id,
    mediaType,
    title: hit.title ?? hit.name ?? title,
    posterPath: hit.poster_path ? `${TMDB_IMAGE_BASE_URL}/w342${hit.poster_path}` : null,
    synopsis: hit.overview,
    streamingProviders: await getWatchProviders(mediaType, hit.id, region),
  };
}

export async function getWatchProviders(
  mediaType: MediaType,
  id: number,
  region: string,
): Promise<StreamingProvider[]> {
  try {
    const data = await tmdbFetch<TmdbWatchProvidersResponse>(`/${mediaType}/${id}/watch/providers`);
    const flatrate = data.results[region]?.flatrate ?? [];
    return flatrate.map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
      logoPath: p.logo_path ? `${TMDB_IMAGE_BASE_URL}/w92${p.logo_path}` : null,
    }));
  } catch {
    // No streaming data for this title/region — treat as "not available", not an error.
    return [];
  }
}

/**
 * Fetches 5-10 recommendations for a title and enriches each with its
 * subscription ("flatrate") streaming providers for the given region.
 */
export async function getRecommendationsWithProviders(
  mediaType: MediaType,
  id: number,
  region: string = WATCH_REGION,
): Promise<Recommendation[]> {
  const raw = (await fetchRawRecommendations(mediaType, id)).slice(0, 10);

  const enriched = await Promise.all(
    raw.map(async (item): Promise<Recommendation> => {
      const streamingProviders = await getWatchProviders(mediaType, item.id, region);
      return {
        id: item.id,
        mediaType,
        title: item.title ?? item.name ?? "Untitled",
        posterPath: item.poster_path ? `${TMDB_IMAGE_BASE_URL}/w342${item.poster_path}` : null,
        synopsis: item.overview,
        streamingProviders,
      };
    }),
  );

  return enriched;
}

interface TmdbTitleDetails {
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  poster_path: string | null;
}

/** Card data (poster, synopsis, streaming providers) for a specific TMDB id. */
export async function getTitleCard(
  mediaType: MediaType,
  id: number,
  region: string = WATCH_REGION,
): Promise<Recommendation | null> {
  try {
    const d = await tmdbFetch<TmdbTitleDetails>(`/${mediaType}/${id}`);
    return {
      id,
      mediaType,
      title: d.title ?? d.name ?? "Untitled",
      posterPath: d.poster_path ? `${TMDB_IMAGE_BASE_URL}/w342${d.poster_path}` : null,
      synopsis: d.overview,
      year: yearOf(d),
      streamingProviders: await getWatchProviders(mediaType, id, region),
    };
  } catch {
    return null;
  }
}
