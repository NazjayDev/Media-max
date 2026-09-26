import { NextRequest, NextResponse } from "next/server";
import { searchTitle } from "@/lib/tmdb";

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

    return NextResponse.json(result);
  } catch (error) {
    console.error("TMDB search failed:", error);
    return NextResponse.json({ error: "Failed to search TMDB" }, { status: 502 });
  }
}
