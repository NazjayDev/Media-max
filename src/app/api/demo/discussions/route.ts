import { NextResponse } from "next/server";
import { jsonError, requireDemoUser } from "@/lib/api";
import { seedDemoDiscussions } from "@/lib/demoDiscussions";
import { allowRequest } from "@/lib/rateLimit";

export const maxDuration = 30;

export async function POST() {
  const guard = await requireDemoUser();
  if ("response" in guard) return guard.response;

  if (!(await allowRequest("demo-discussions", guard.userId, 10, 3600))) {
    return jsonError("Too many refreshes. Try again later.", 429);
  }

  try {
    return NextResponse.json({ ok: true, posts: await seedDemoDiscussions() });
  } catch (error) {
    console.error("Demo discussions failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't refresh the sample discussions.", 502);
  }
}
