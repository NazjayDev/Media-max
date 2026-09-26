import type { CatalogTitle } from "@/lib/catalog";
import { getDb } from "@/lib/mongodb";
import { fromCatalog, hydrateUnrefined } from "@/lib/recommend";
import { TMDB_IMAGE_BASE_URL } from "@/lib/tmdb";
import type { MediaType, Recommendation } from "@/types/media";

export const ROULETTE_KINDS = ["all", "movie", "tv", "anime"] as const;
export type RouletteKind = (typeof ROULETTE_KINDS)[number];

/** How many posters go on the reel for one spin. */
const REEL_SIZE = 24;

export interface ReelPoster {
  mediaType: MediaType;
  id: number;
  title: string;
  posterPath: string;
}

export interface Spin {
  reel: ReelPoster[];
  /** Position on the reel where the spin lands. */
  winnerIndex: number;
  winner: Recommendation;
}

function typeFilter(kind: RouletteKind): Record<string, unknown> {
  if (kind === "anime") return { anime: true };
  if (kind === "movie") return { mediaType: "movie", anime: { $ne: true } };
  if (kind === "tv") return { mediaType: "tv", anime: { $ne: true } };
  return {};
}

/**
 * Picks a fresh reel of random catalog titles and one winner among them. Titles in `exclude`
 * (the ones the person has already watched) never appear. Returns null if nothing is left.
 */
export async function spinRoulette(kind: RouletteKind, exclude: string[]): Promise<Spin | null> {
  const db = await getDb();
  if (!db) throw new Error("Catalog unavailable");

  const docs = await db
    .collection<CatalogTitle>("titles")
    .aggregate<CatalogTitle>([
      {
        $match: {
          ...typeFilter(kind),
          posterPath: { $ne: null },
          ...(exclude.length ? { _id: { $nin: exclude } } : {}),
        },
      },
      { $sample: { size: REEL_SIZE } },
      { $project: { embedding: 0, popularity: 0, voteAverage: 0, voteCount: 0 } },
    ])
    .toArray();
  if (docs.length === 0) return null;

  // The order is already random, so the winner can sit at a fixed spot near the end of the reel.
  // Leaving a few posters after it keeps the reel looking full when it stops.
  const winnerIndex = Math.max(0, docs.length - 4);
  const [winner] = await hydrateUnrefined([fromCatalog(docs[winnerIndex])], 1);

  return {
    reel: docs.map((d) => ({
      mediaType: d.mediaType,
      id: d.tmdbId,
      title: d.title,
      posterPath: `${TMDB_IMAGE_BASE_URL}/w342${d.posterPath}`,
    })),
    winnerIndex,
    winner,
  };
}
