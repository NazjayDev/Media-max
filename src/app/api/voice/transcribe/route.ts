import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsError, elevenLabsConfigured, transcribe } from "@/lib/elevenlabs";
import { allowRequest, clientIp } from "@/lib/rateLimit";

export const maxDuration = 30;

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 300;

export async function POST(request: NextRequest) {
  if (!elevenLabsConfigured()) {
    return NextResponse.json({ error: "Voice search is not configured" }, { status: 503 });
  }

  if (!(await allowRequest("stt", clientIp(request), 20, 3600))) {
    return NextResponse.json(
      { error: "Too many voice searches. Try again later." },
      { status: 429 },
    );
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Missing audio" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Recording is too long" }, { status: 413 });
  }
  if (!audio.type.startsWith("audio/") && !audio.type.startsWith("video/")) {
    return NextResponse.json({ error: "Unsupported audio type" }, { status: 400 });
  }

  try {
    const extension = audio.type.includes("mp4")
      ? "mp4"
      : audio.type.includes("ogg")
        ? "ogg"
        : "webm";
    const text = (await transcribe(audio, `speech.${extension}`)).slice(0, MAX_TRANSCRIPT_CHARS);
    if (!text) {
      return NextResponse.json({ error: "I didn't catch that. Try again." }, { status: 422 });
    }
    return NextResponse.json({ text });
  } catch (error) {
    console.error("Transcription failed:", error instanceof Error ? error.message : error);
    const quota =
      error instanceof ElevenLabsError && (error.status === 401 || error.status === 429);
    return NextResponse.json(
      { error: quota ? "Voice search is unavailable right now" : "Couldn't transcribe that" },
      { status: quota ? 503 : 502 },
    );
  }
}
