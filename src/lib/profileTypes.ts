// Client-safe: no server-only imports (mongodb etc.), so client components can use these too.
import type { MediaType } from "@/types/media";

export const MAX_FAVORITES = 3;

export interface ProfileFavorite {
  mediaType: MediaType;
  id: number;
  title: string;
  posterPath: string | null;
}
