import { cached } from "@/lib/cache";
import { tmdbFetch } from "@/lib/tmdb";
import type { MediaType, Ratings, Recommendation } from "@/types/media";

const RATINGS_TTL_SECONDS = 30 * 24 * 60 * 60;

interface OmdbResponse {
  Response: string;
  imdbRating?: string;
  Metascore?: string;
  Ratings?: { Source: string; Value: string }[];
}

const clean = (value?: string) => (value && value !== "N/A" ? value : undefined);

/** IMDb / Rotten Tomatoes / Metacritic scores via OMDb. Returns {} when no key is configured. */
async function fetchOmdbRatings(mediaType: MediaType, id: number): Promise<Ratings> {
  const key = process.env.OMDB_API_KEY;
  if (!key) return {};

  return cached(`omdb:${mediaType}:${id}`, RATINGS_TTL_SECONDS, async () => {
    const ids = await tmdbFetch<{ imdb_id?: string | null }>(`/${mediaType}/${id}/external_ids`);
    if (!ids.imdb_id) return {};

    const url = new URL("https://www.omdbapi.com/");
    url.searchParams.set("i", ids.imdb_id);
    url.searchParams.set("apikey", key);
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) throw new Error(`OMDb request failed (${res.status})`);

    const data = (await res.json()) as OmdbResponse;
    if (data.Response !== "True") return {};

    return {
      imdb: clean(data.imdbRating),
      rottenTomatoes: clean(data.Ratings?.find((r) => r.Source === "Rotten Tomatoes")?.Value),
      metacritic: clean(data.Metascore),
    } satisfies Ratings;
  });
}

/** TMDB's community score (always available) plus OMDb scores when configured. */
export async function getRatings(mediaType: MediaType, id: number): Promise<Ratings> {
  const [details, external] = await Promise.all([
    tmdbFetch<{ vote_average?: number }>(`/${mediaType}/${id}`).catch(() => ({}) as { vote_average?: number }),
    fetchOmdbRatings(mediaType, id).catch(() => ({}) as Ratings),
  ]);
  const average = details.vote_average;
  return {
    tmdb: average && average > 0 ? Math.round(average * 10) / 10 : undefined,
    ...external,
  };
}

export async function attachRatings<T extends Recommendation>(items: T[]): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => ({ ...item, ratings: await getRatings(item.mediaType, item.id) }))
  );
}
