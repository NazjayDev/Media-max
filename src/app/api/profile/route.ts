import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { profilesCollection, validateUsername } from "@/lib/profile";
import { allowRequest } from "@/lib/rateLimit";

export async function GET() {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const profiles = await profilesCollection();
  if (!profiles) return jsonError("Profiles are unavailable", 503);

  const profile = await profiles.findOne({ _id: guard.userId });
  return NextResponse.json({ username: profile?.username ?? null });
}

export async function PUT(request: NextRequest) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { userId } = guard;

  const body = (await request.json().catch(() => null)) as { username?: unknown } | null;
  const check = validateUsername(body?.username);
  if (!check.ok) return jsonError(check.error, 400);

  if (!(await allowRequest("username", userId, 5, 3600))) {
    return jsonError("Too many changes. Try again later.", 429);
  }

  const profiles = await profilesCollection();
  if (!profiles) return jsonError("Profiles are unavailable", 503);

  try {
    await profiles.updateOne(
      { _id: userId },
      {
        $set: {
          username: check.username,
          usernameLower: check.username.toLowerCase(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    return NextResponse.json({ username: check.username });
  } catch (error) {
    // Duplicate key on the case-insensitive unique index means the name is taken.
    if ((error as { code?: number }).code === 11000)
      return jsonError("That username is taken.", 409);
    console.error("Username update failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't save your username.", 502);
  }
}
