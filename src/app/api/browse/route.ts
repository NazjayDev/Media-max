import { NextRequest, NextResponse } from "next/server";
import { BROWSE_SORTS, BROWSE_TYPES, browseTitles } from "@/lib/browse";
import { GENRES } from "@/lib/genres";
import { attachRatings } from "@/lib/ratings";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const genreParam = p.get("genre");
  const genre = GENRES.some((g) => g.label === genreParam) ? genreParam : null;
  const type = BROWSE_TYPES.find((t) => t === p.get("type")) ?? "all";
  const sort = BROWSE_SORTS.find((s) => s === p.get("sort")) ?? "popular";
  const page = Math.min(Math.max(Number(p.get("page")) || 0, 0), 40);

  try {
    const { results, hasMore } = await browseTitles(genre, type, sort, page);
    return NextResponse.json({ results: await attachRatings(results), hasMore });
  } catch (error) {
    console.error("Browse failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ results: [], hasMore: false }, { status: 502 });
  }
}
