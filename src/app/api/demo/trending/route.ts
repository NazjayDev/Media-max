import { NextResponse } from "next/server";
import { jsonError, requireDemoUser } from "@/lib/api";
import { seedDemoActivity } from "@/lib/demoActivity";
import { allowRequest } from "@/lib/rateLimit";

export const maxDuration = 60;

export async function POST() {
  const guard = await requireDemoUser();
  if ("response" in guard) return guard.response;

  if (!(await allowRequest("demo-trending", guard.userId, 10, 3600))) {
    return jsonError("Too many refreshes. Try again later.", 429);
  }

  try {
    return NextResponse.json({ ok: true, events: await seedDemoActivity() });
  } catch (error) {
    console.error("Demo trending refresh failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't refresh the showcase.", 502);
  }
}
