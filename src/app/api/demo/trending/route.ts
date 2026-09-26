import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { seedDemoActivity } from "@/lib/demoActivity";
import { allowRequest } from "@/lib/rateLimit";

export const maxDuration = 60;

export async function POST() {
  const user = (await auth())?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!user.demo) {
    return NextResponse.json({ error: "Not a demo account" }, { status: 403 });
  }
  if (!(await allowRequest("demo-trending", user.id, 10, 3600))) {
    return NextResponse.json({ error: "Too many refreshes. Try again later." }, { status: 429 });
  }

  try {
    return NextResponse.json({ ok: true, events: await seedDemoActivity() });
  } catch (error) {
    console.error("Demo trending refresh failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn't refresh the showcase." }, { status: 502 });
  }
}
