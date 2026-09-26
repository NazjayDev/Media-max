import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { attachRatings } from "@/lib/ratings";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import { lookupTitles } from "@/lib/tmdb";

export const maxDuration = 30;

/** Finds movies, shows and anime by name, with details and where they stream. No recommendations. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim().slice(0, 100) ?? "";
  if (query.length < 2) return jsonError("Type at least two letters", 400);

  if (!(await allowRequest("lookup", clientIp(request), 120, 3600))) {
    return jsonError("That's a lot of searching. Try again in a few minutes.", 429);
  }

  try {
    return NextResponse.json({ results: await attachRatings(await lookupTitles(query)) });
  } catch (error) {
    console.error("Lookup failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't search right now. Try again in a moment.", 502);
  }
}
