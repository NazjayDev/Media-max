import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { seedDemoAccount } from "@/lib/demoSeed";
import { allowRequest } from "@/lib/rateLimit";

export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  // Only accounts on the DEMO_ACCOUNT_EMAILS allowlist can be seeded, and only their own data is touched.
  if (!user.demo) {
    return NextResponse.json({ error: "Not a demo account" }, { status: 403 });
  }
  if (!(await allowRequest("demo-seed", user.id, 6, 3600))) {
    return NextResponse.json({ error: "Too many resets. Try again later." }, { status: 429 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await seedDemoAccount(user.id)) });
  } catch (error) {
    console.error("Demo seed failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn't prepare the demo account." }, { status: 502 });
  }
}
