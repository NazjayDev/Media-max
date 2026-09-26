import { NextRequest, NextResponse } from "next/server";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import { suggestTitles } from "@/lib/tmdb";

const MAX_QUERY = 80;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim().slice(0, MAX_QUERY) ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  if (!(await allowRequest("suggest", clientIp(request), 300, 600))) {
    return NextResponse.json({ results: [] }, { status: 429 });
  }

  try {
    return NextResponse.json(
      { results: await suggestTitles(query) },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    console.error("Title suggestions failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ results: [] });
  }
}
