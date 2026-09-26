import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { askMediaMax, type ChatMessage } from "@/lib/chat";
import { attachRatings } from "@/lib/ratings";
import { allowRequest, clientIp } from "@/lib/rateLimit";

export const maxDuration = 60;

const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 500;
const MAX_TOTAL_CHARS = 3000;
const KEY_PATTERN = /^(movie|tv):\d+$/;

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;
  const messages = raw
    .map((m) => ({
      role: m?.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: typeof m?.content === "string" ? m.content.trim().slice(0, MAX_MESSAGE_CHARS) : "",
    }))
    .filter((m) => m.content);
  const total = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (
    messages.length === 0 ||
    messages[messages.length - 1].role !== "user" ||
    total > MAX_TOTAL_CHARS
  ) {
    return null;
  }
  return messages;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    messages?: unknown;
    seen?: unknown;
  } | null;
  const messages = parseMessages(body?.messages);
  if (!messages) return jsonError("Send a short question to get started", 400);

  const seen = (Array.isArray(body?.seen) ? body.seen : [])
    .filter((k): k is string => typeof k === "string" && KEY_PATTERN.test(k))
    .slice(0, 100);

  if (!(await allowRequest("chat", clientIp(request), 40, 3600))) {
    return jsonError("You're asking a lot. Give it a few minutes and try again.", 429);
  }

  try {
    const reply = await askMediaMax(messages, seen, (await auth())?.user?.id);
    return NextResponse.json({ ...reply, results: await attachRatings(reply.results) });
  } catch (error) {
    console.error("Chat request failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't answer that right now. Try again in a moment.", 502);
  }
}
