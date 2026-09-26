import { NextResponse } from "next/server";
import { jsonError, requireDemoUser } from "@/lib/api";
import { seedDemoAccount } from "@/lib/demoSeed";
import { allowRequest } from "@/lib/rateLimit";

export const maxDuration = 60;

// Only accounts on the DEMO_ACCOUNT_EMAILS allowlist can be seeded, and only their own data is touched.
export async function POST() {
  const guard = await requireDemoUser();
  if ("response" in guard) return guard.response;

  if (!(await allowRequest("demo-seed", guard.userId, 6, 3600))) {
    return jsonError("Too many resets. Try again later.", 429);
  }

  try {
    return NextResponse.json({ ok: true, ...(await seedDemoAccount(guard.userId)) });
  } catch (error) {
    console.error("Demo seed failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't prepare the demo account.", 502);
  }
}
