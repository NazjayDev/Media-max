import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@google/genai";
import { suggestByVibe } from "@/lib/vibe";
import { vibeRecommendations } from "@/lib/recommend";
import { attachRatings } from "@/lib/ratings";
import { lookupRecommendation } from "@/lib/tmdb";
import type { Recommendation } from "@/types/media";

export const maxDuration = 30;

const MAX_VIBE_LENGTH = 300;

export async function GET(request: NextRequest) {
  const vibe = request.nextUrl.searchParams.get("vibe")?.trim();

  if (!vibe) {
    return NextResponse.json({ error: "Missing vibe parameter" }, { status: 400 });
  }
  if (vibe.length > MAX_VIBE_LENGTH) {
    return NextResponse.json(
      { error: `Vibe must be ${MAX_VIBE_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Vibe search is not configured" }, { status: 503 });
  }

  try {
    try {
      const results = await vibeRecommendations(vibe);
      return NextResponse.json({ results: await attachRatings(results) });
    } catch (error) {
      console.error("Catalog vibe search failed, using generative fallback:", error);
    }

    const suggestions = await suggestByVibe(vibe);

    const looked = await Promise.all(
      suggestions.map(async (s): Promise<Recommendation | null> => {
        try {
          const rec = await lookupRecommendation(s.title, s.mediaType, s.year);
          return rec ? { ...rec, why: s.why } : null;
        } catch {
          return null;
        }
      })
    );

    const results = looked.filter((r): r is Recommendation => r !== null);
    return NextResponse.json({ results: await attachRatings(results) });
  } catch (error) {
    console.error("Vibe search failed:", error);
    if (error instanceof ApiError && (error.status === 429 || error.status === 503)) {
      return NextResponse.json({ error: "Vibe search is busy, try again shortly" }, { status: 429 });
    }
    return NextResponse.json({ error: "Failed to run vibe search" }, { status: 502 });
  }
}
