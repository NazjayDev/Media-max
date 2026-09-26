import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { attachRatings } from "@/lib/ratings";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import { ROULETTE_KINDS, spinRoulette } from "@/lib/roulette";

export const maxDuration = 30;

const KEY_PATTERN = /^(movie|tv):\d+$/;
const MAX_EXCLUDE = 200;

/** One spin of Media Roulette: a reel of random posters and the title it lands on. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    exclude?: unknown;
  } | null;

  const kind = ROULETTE_KINDS.find((k) => k === body?.kind) ?? "all";
  const exclude = (Array.isArray(body?.exclude) ? body.exclude : [])
    .filter((k): k is string => typeof k === "string" && KEY_PATTERN.test(k))
    .slice(-MAX_EXCLUDE);

  if (!(await allowRequest("roulette", clientIp(request), 120, 3600))) {
    return jsonError("That's a lot of spins. Give it a few minutes.", 429);
  }

  try {
    const spin = await spinRoulette(kind, exclude);
    if (!spin) {
      return jsonError("You've seen everything in this category. Try another one.", 404);
    }
    const [winner] = await attachRatings([spin.winner]);
    return NextResponse.json({ ...spin, winner });
  } catch (error) {
    console.error("Roulette failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't spin the reel. Try again.", 502);
  }
}
