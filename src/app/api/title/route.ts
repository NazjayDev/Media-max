import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { parseMedia } from "@/lib/media";
import { attachRatings } from "@/lib/ratings";
import { getTitleCard } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const media = parseMedia(params.get("mediaType"), params.get("id"));
  if (!media) return jsonError("Invalid title", 400);

  const card = await getTitleCard(media.mediaType, media.id);
  if (!card) return jsonError("Title not found", 404);

  const [withRatings] = await attachRatings([card]);
  return NextResponse.json(withRatings, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
