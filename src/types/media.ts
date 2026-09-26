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
  year?: number | null;
}

export interface SearchSuggestion extends SearchResult {
  year: number | null;
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
  /** Release year, when known, so same-named titles can be told apart. */
  year?: number | null;
  why?: string;
  blurb?: string;
  ratings?: Ratings;
}

export interface WatchlistEntry extends Recommendation {
  status: WatchStatus;
  /** 0.5 to 5 in half-star steps, or null when unrated. */
  userRating: number | null;
  favorite: boolean;
  genres?: string[];
  addedAt?: string;
  /** When the status last changed; used to find what you watched or started most recently. */
  statusUpdatedAt?: string;
}
