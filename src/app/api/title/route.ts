import { NextRequest, NextResponse } from "next/server";
import { attachRatings } from "@/lib/ratings";
import { getTitleCard } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const mediaType = request.nextUrl.searchParams.get("mediaType");
  const id = Number(request.nextUrl.searchParams.get("id"));
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }

  const card = await getTitleCard(mediaType, id);
  if (!card) {
    return NextResponse.json({ error: "Title not found" }, { status: 404 });
  }

  const [withRatings] = await attachRatings([card]);
  return NextResponse.json(withRatings, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
