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

export interface Recommendation {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  synopsis: string;
  streamingProviders: StreamingProvider[];
  why?: string;
  blurb?: string;
}
