import { NextRequest, NextResponse, after } from "next/server";
import { searchTitle } from "@/lib/tmdb";
import { logEvent } from "@/lib/events";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    const result = await searchTitle(query);

    if (!result) {
      return NextResponse.json({ error: "No results found" }, { status: 404 });
    }

    after(() =>
      logEvent({ kind: "search", mediaType: result.mediaType, tmdbId: result.id, title: result.title })
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("TMDB search failed:", error);
    return NextResponse.json({ error: "Failed to search TMDB" }, { status: 502 });
  }
}
