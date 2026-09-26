import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { parseMedia } from "@/lib/media";
import { attachRatings } from "@/lib/ratings";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import { moreTitleRecommendations, moreVibeRecommendations } from "@/lib/recommend";

export const maxDuration = 60;

const KEY_PATTERN = /^(movie|tv):\d+$/;
const MAX_EXCLUDE = 150;
const MAX_VIBE = 300;

/** Another batch of suggestions that leaves out what was already shown or watched. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    mediaType?: string;
    id?: number | string;
    vibe?: unknown;
    exclude?: unknown;
  } | null;

  // Keep the most recent keys; the client sends everything shown so far, oldest first.
  const exclude = (Array.isArray(body?.exclude) ? body.exclude : [])
    .filter((k): k is string => typeof k === "string" && KEY_PATTERN.test(k))
    .slice(-MAX_EXCLUDE);

  const vibe = typeof body?.vibe === "string" ? body.vibe.trim().slice(0, MAX_VIBE) : "";
  const media = parseMedia(body?.mediaType, body?.id);
  if (!vibe && !media) return jsonError("Say which search you want more suggestions for", 400);

  if (!(await allowRequest("more", clientIp(request), 40, 3600))) {
    return jsonError("That's a lot of searching. Try again in a few minutes.", 429);
  }

  try {
    const found = vibe
      ? await moreVibeRecommendations(vibe, exclude)
      : await moreTitleRecommendations(media!.mediaType, media!.id, exclude);
    const skip = new Set(exclude);
    const fresh = found.filter((r) => !skip.has(`${r.mediaType}:${r.id}`));
    return NextResponse.json({ results: await attachRatings(fresh) });
  } catch (error) {
    console.error("More suggestions failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't find more right now. Try again in a moment.", 502);
  }
}
