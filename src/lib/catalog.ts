import { getDb } from "@/lib/mongodb";
import type { MediaType } from "@/types/media";

export interface CatalogTitle {
  _id: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  genres: string[];
  overview: string;
  posterPath: string | null;
  anime: boolean;
  score?: number;
}

const VECTOR_INDEX = "titles_vector";
const PROJECTION = { embedding: 0, popularity: 0, voteAverage: 0, voteCount: 0 } as const;

export const catalogKey = (mediaType: MediaType, id: number) => `${mediaType}:${id}`;

/** Nearest catalog titles to a query vector. Returns [] if the catalog isn't available. */
export async function nearestTitles(
  vector: number[],
  options: { limit?: number; excludeKey?: string; excludeKeys?: string[] } = {}
): Promise<CatalogTitle[]> {
  const db = await getDb();
  if (!db) return [];

  const limit = options.limit ?? 40;
  try {
    const docs = await db
      .collection<CatalogTitle>("titles")
      .aggregate<CatalogTitle>([
        {
          $vectorSearch: {
            index: VECTOR_INDEX,
            path: "embedding",
            queryVector: vector,
            numCandidates: Math.max(150, limit * 5),
            limit: limit + (options.excludeKeys?.length ?? 0) + 1,
          },
        },
        { $addFields: { score: { $meta: "vectorSearchScore" } } },
        { $project: PROJECTION },
      ])
      .toArray();
    const excluded = new Set([...(options.excludeKeys ?? []), options.excludeKey]);
    return docs.filter((d) => !excluded.has(d._id)).slice(0, limit);
  } catch (error) {
    console.error("Vector search failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

/** A catalog title together with its stored embedding, if it is in the catalog. */
export async function getCatalogEntry(
  key: string
): Promise<(CatalogTitle & { embedding?: number[] }) | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    return await db
      .collection<CatalogTitle & { embedding?: number[] }>("titles")
      .findOne({ _id: key }, { projection: { popularity: 0, voteAverage: 0, voteCount: 0 } });
  } catch {
    return null;
  }
}
