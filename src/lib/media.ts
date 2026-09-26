import type { MediaType } from "@/types/media";

export const isMediaType = (value: unknown): value is MediaType =>
  value === "movie" || value === "tv";

export const mediaKey = (mediaType: MediaType, id: number) => `${mediaType}:${id}`;

/** Validates a `mediaType` + `id` pair from a request. Returns null when either is invalid. */
export function parseMedia(
  mediaType: unknown,
  id: unknown
): { mediaType: MediaType; id: number } | null {
  const numeric = Number(id);
  if (!isMediaType(mediaType) || !Number.isInteger(numeric) || numeric <= 0) return null;
  return { mediaType, id: numeric };
}
