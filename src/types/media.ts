export type MediaType = "movie" | "tv";

export interface StreamingProvider {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface SearchResult {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
}

export interface Ratings {
  tmdb?: number;
  imdb?: string;
  rottenTomatoes?: string;
  metacritic?: string;
}

export type WatchStatus = "want" | "watching" | "watched";

export interface Recommendation {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  synopsis: string;
  streamingProviders: StreamingProvider[];
  why?: string;
  blurb?: string;
  ratings?: Ratings;
}

export interface WatchlistEntry extends Recommendation {
  status: WatchStatus;
  userRating: number | null;
}
