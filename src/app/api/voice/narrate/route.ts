import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { ElevenLabsError, elevenLabsConfigured, synthesize, voiceId } from "@/lib/elevenlabs";
import { allowRequest, clientIp } from "@/lib/rateLimit";

export const maxDuration = 30;

const MAX_TEXT_CHARS = 700;
const AUDIO_TTL_SECONDS = 30 * 24 * 60 * 60;

class RateLimited extends Error {}

export async function POST(request: NextRequest) {
  if (!elevenLabsConfigured()) {
    return NextResponse.json({ error: "Narration is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_TEXT_CHARS) {
    return NextResponse.json(
      { error: `Text must be 1-${MAX_TEXT_CHARS} characters` },
      { status: 400 },
    );
  }

  const ip = clientIp(request);
  const key = `tts:${voiceId()}:${createHash("sha1").update(text).digest("hex")}`;

  try {
    // Identical scripts are served from the cache and cost no ElevenLabs credits.
    const audioBase64 = await cached(key, AUDIO_TTL_SECONDS, async () => {
      if (!(await allowRequest("tts", ip, 12, 3600))) throw new RateLimited();
      return (await synthesize(text)).toString("base64");
    });

    return new Response(Buffer.from(audioBase64, "base64"), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    if (error instanceof RateLimited) {
      return NextResponse.json({ error: "Too many narrations. Try again later." }, { status: 429 });
    }
    console.error("Narration failed:", error instanceof Error ? error.message : error);
    const unavailable = error instanceof ElevenLabsError && [401, 402, 429].includes(error.status);
    return NextResponse.json(
      { error: unavailable ? "Narration is unavailable right now" : "Couldn't generate narration" },
      { status: unavailable ? 503 : 502 },
    );
  }
}
