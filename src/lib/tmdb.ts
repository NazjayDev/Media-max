import type { MediaType, Recommendation, SearchResult, StreamingProvider } from "@/types/media";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

const DEFAULT_REGION = process.env.TMDB_WATCH_REGION || "US";

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

async function tmdbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${TMDB_API_BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, { headers: getAuthHeaders(), cache: "no-store" });

  if (!res.ok) {
    throw new Error(`TMDB request failed (${res.status}) for ${path}`);
  }

  return res.json() as Promise<T>;
}

interface TmdbMultiSearchResult {
  id: number;
  media_type: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  poster_path: string | null;
  popularity: number;
}

interface TmdbMultiSearchResponse {
  results: TmdbMultiSearchResult[];
}

/**
 * Searches TMDB for a movie/TV title and returns the single best match.
 * TMDB's /search/multi also returns "person" hits, which we filter out.
 */
export async function searchTitle(query: string): Promise<SearchResult | null> {
  const data = await tmdbFetch<TmdbMultiSearchResponse>("/search/multi", {
    query,
    include_adult: "false",
  });

  const candidates = data.results.filter(
    (r): r is TmdbMultiSearchResult & { media_type: "movie" | "tv" } =>
      r.media_type === "movie" || r.media_type === "tv"
  );

  if (candidates.length === 0) {
    return null;
  }

  const best = candidates.sort((a, b) => b.popularity - a.popularity)[0];

  return {
    id: best.id,
    mediaType: best.media_type,
    title: best.title ?? best.name ?? "Untitled",
    posterPath: best.poster_path ? `${TMDB_IMAGE_BASE_URL}/w342${best.poster_path}` : null,
  };
}

interface TmdbRecommendationResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
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

async function fetchRawRecommendations(
  mediaType: MediaType,
  id: number
): Promise<TmdbRecommendationResult[]> {
  const recommendations = await tmdbFetch<TmdbRecommendationResponse>(
    `/${mediaType}/${id}/recommendations`
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
  region: string = DEFAULT_REGION
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

async function getWatchProviders(
  mediaType: MediaType,
  id: number,
  region: string
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
  region: string = DEFAULT_REGION
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
    })
  );

  return enriched;
}
