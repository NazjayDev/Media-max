import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { allowRequest } from "@/lib/rateLimit";
import { profilesCollection, validateUsername } from "@/lib/profile";

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const profiles = await profilesCollection();
  if (!profiles) {
    return NextResponse.json({ error: "Profiles are unavailable" }, { status: 503 });
  }
  const profile = await profiles.findOne({ _id: userId });
  return NextResponse.json({ username: profile?.username ?? null });
}

export async function PUT(request: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { username?: unknown } | null;
  const check = validateUsername(body?.username);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  if (!(await allowRequest("username", userId, 5, 3600))) {
    return NextResponse.json({ error: "Too many changes. Try again later." }, { status: 429 });
  }

  const profiles = await profilesCollection();
  if (!profiles) {
    return NextResponse.json({ error: "Profiles are unavailable" }, { status: 503 });
  }

  try {
    await profiles.updateOne(
      { _id: userId },
      { $set: { username: check.username, usernameLower: check.username.toLowerCase(), updatedAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ username: check.username });
  } catch (error) {
    // Duplicate key on the case-insensitive unique index means the name is taken.
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "That username is taken." }, { status: 409 });
    }
    console.error("Username update failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn't save your username." }, { status: 502 });
  }
}
