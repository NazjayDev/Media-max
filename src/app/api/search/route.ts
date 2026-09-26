import { NextRequest, NextResponse, after } from "next/server";
import { parseMedia } from "@/lib/media";
import { getTitleCard, searchTitle } from "@/lib/tmdb";
import { logEvent } from "@/lib/events";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("query");
  // A title picked from the suggestions dropdown arrives as an exact id instead of free text.
  const exact = parseMedia(params.get("mediaType"), params.get("id"));

  if (!query && !exact) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    const result = exact
      ? await getTitleCard(exact.mediaType, exact.id).then(
          (card) =>
            card && {
              id: card.id,
              mediaType: card.mediaType,
              title: card.title,
              posterPath: card.posterPath,
            },
        )
      : await searchTitle(query!);

    if (!result) {
      return NextResponse.json({ error: "No results found" }, { status: 404 });
    }

    after(() =>
      logEvent({
        kind: "search",
        mediaType: result.mediaType,
        tmdbId: result.id,
        title: result.title,
      }),
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("TMDB search failed:", error);
    return NextResponse.json({ error: "Failed to search TMDB" }, { status: 502 });
  }
}
