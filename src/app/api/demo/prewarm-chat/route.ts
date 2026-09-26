import { NextResponse } from "next/server";
import { jsonError, requireDemoUser } from "@/lib/api";
import { askMediaMax } from "@/lib/chat";
import { ASK_SUGGESTIONS } from "@/lib/demoPrompts";
import { allowRequest } from "@/lib/rateLimit";

export const maxDuration = 60;

/** Runs the starter questions as the demo account so their answers are cached before a presentation. */
export async function POST() {
  const guard = await requireDemoUser();
  if ("response" in guard) return guard.response;

  if (!(await allowRequest("demo-prewarm-chat", guard.userId, 6, 3600))) {
    return jsonError("Too many attempts. Try again later.", 429);
  }

  let cached = 0;
  for (const question of ASK_SUGGESTIONS) {
    try {
      const reply = await askMediaMax([{ role: "user", content: question }], [], guard.userId);
      if (!reply.degraded) cached++;
    } catch (error) {
      console.error("Chat prewarm failed:", error instanceof Error ? error.message : error);
    }
  }
  return NextResponse.json({ ok: true, cached, total: ASK_SUGGESTIONS.length });
}
