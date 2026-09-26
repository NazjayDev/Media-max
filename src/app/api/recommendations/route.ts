import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { parseMedia } from "@/lib/media";
import { attachRatings } from "@/lib/ratings";
import { titleRecommendations } from "@/lib/recommend";
import { getRecommendationsWithProviders } from "@/lib/tmdb";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const media = parseMedia(params.get("mediaType"), params.get("id"));
  if (!media) return jsonError("mediaType must be 'movie' or 'tv', and id is required", 400);

  try {
    try {
      const refined = await titleRecommendations(media.mediaType, media.id);
      return NextResponse.json({ results: await attachRatings(refined) });
    } catch (error) {
      console.error("Refined recommendations failed, using TMDB fallback:", error);
    }

    const fallback = await getRecommendationsWithProviders(media.mediaType, media.id);
    return NextResponse.json({ results: await attachRatings(fallback) });
  } catch (error) {
    console.error("TMDB recommendations failed:", error);
    return jsonError("Failed to fetch recommendations", 502);
  }
}
