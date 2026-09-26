import { cached } from "@/lib/cache";
import { GENRES } from "@/lib/genres";
import { getDb } from "@/lib/mongodb";
import { fromCatalog, hydrateUnrefined } from "@/lib/recommend";
import type { CatalogTitle } from "@/lib/catalog";
import type { Recommendation } from "@/types/media";

export const BROWSE_TYPES = ["all", "movie", "tv", "anime"] as const;
export type BrowseType = (typeof BROWSE_TYPES)[number];
export const BROWSE_SORTS = ["popular", "rating"] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

const PAGE_SIZE = 12;
const BROWSE_TTL_SECONDS = 6 * 3600;
/** Rating sort ignores titles with very few votes so obscure ones don't top the list. */
const MIN_VOTES_FOR_RATING = 800;

export interface BrowsePage {
  results: Recommendation[];
  hasMore: boolean;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function typeFilter(type: BrowseType): Record<string, unknown> {
  if (type === "anime") return { anime: true };
  if (type === "movie") return { mediaType: "movie", anime: { $ne: true } };
  if (type === "tv") return { mediaType: "tv", anime: { $ne: true } };
  return {};
}

/** One page of catalog titles, optionally narrowed by genre and type, most popular or best rated first. */
export async function browseTitles(
  genre: string | null,
  type: BrowseType,
  sort: BrowseSort,
  page: number,
  search = "",
): Promise<BrowsePage> {
  const names = GENRES.find((g) => g.label === genre)?.names;
  const text = search.trim().toLowerCase();
  return cached(
    `browse2:${genre ?? "all"}:${type}:${sort}:${page}:${text}`,
    BROWSE_TTL_SECONDS,
    async () => {
      const db = await getDb();
      if (!db) throw new Error("Catalog unavailable");

      const filter = {
        ...typeFilter(type),
        ...(names ? { genres: { $in: names } } : {}),
        ...(sort === "rating" ? { voteCount: { $gte: MIN_VOTES_FOR_RATING } } : {}),
        posterPath: { $ne: null },
        // The typed name is matched as plain text, never as a pattern, so it can't change the query.
        ...(text.length >= 2 ? { title: { $regex: escapeRegex(text), $options: "i" } } : {}),
      };
      const docs = await db
        .collection<CatalogTitle & { voteAverage: number; voteCount: number }>("titles")
        .find(filter, { projection: { embedding: 0, popularity: 0 } })
        .sort(sort === "rating" ? { voteAverage: -1, voteCount: -1 } : { voteCount: -1 })
        .skip(page * PAGE_SIZE)
        .limit(PAGE_SIZE + 1)
        .toArray();

      const candidates = docs.slice(0, PAGE_SIZE).map(fromCatalog);
      return {
        results: await hydrateUnrefined(candidates, candidates.length),
        hasMore: docs.length > PAGE_SIZE,
      };
    },
  );
}
