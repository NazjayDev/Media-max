import { NextRequest, NextResponse } from "next/server";
import { getRecommendationsWithProviders } from "@/lib/tmdb";
import type { MediaType } from "@/types/media";

function isMediaType(value: string | null): value is MediaType {
  return value === "movie" || value === "tv";
}

export async function GET(request: NextRequest) {
  const mediaType = request.nextUrl.searchParams.get("mediaType");
  const id = request.nextUrl.searchParams.get("id");

  if (!isMediaType(mediaType) || !id) {
    return NextResponse.json(
      { error: "mediaType must be 'movie' or 'tv', and id is required" },
      { status: 400 }
    );
  }

  try {
    const recommendations = await getRecommendationsWithProviders(mediaType, Number(id));
    return NextResponse.json({ results: recommendations });
  } catch (error) {
    console.error("TMDB recommendations failed:", error);
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 502 });
  }
}
