import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { profilesCollection, validateFavorites, validateUsername } from "@/lib/profile";
import { allowRequest } from "@/lib/rateLimit";

export async function GET() {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const profiles = await profilesCollection();
  if (!profiles) return jsonError("Profiles are unavailable", 503);

  const profile = await profiles.findOne({ _id: guard.userId });
  return NextResponse.json({
    username: profile?.username ?? null,
    favorites: profile?.favorites ?? [],
  });
}

export async function PUT(request: NextRequest) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { userId } = guard;

  const body = (await request.json().catch(() => null)) as {
    username?: unknown;
    favorites?: unknown;
  } | null;

  // Favorites can be saved on their own (username already set) or together with a new username.
  const wantsFavorites = body !== null && "favorites" in (body ?? {});
  const favorites = wantsFavorites ? validateFavorites(body?.favorites) : undefined;
  if (favorites === null) return jsonError("Invalid favorites", 400);

  let username: string | undefined;
  if (body?.username !== undefined) {
    const check = validateUsername(body.username);
    if (!check.ok) return jsonError(check.error, 400);
    username = check.username;
  }
  if (username === undefined && favorites === undefined) {
    return jsonError("Nothing to update", 400);
  }

  if (!(await allowRequest("username", userId, 10, 3600))) {
    return jsonError("Too many changes. Try again later.", 429);
  }

  const profiles = await profilesCollection();
  if (!profiles) return jsonError("Profiles are unavailable", 503);

  try {
    const result = await profiles.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          updatedAt: new Date(),
          ...(username !== undefined ? { username, usernameLower: username.toLowerCase() } : {}),
          ...(favorites !== undefined ? { favorites } : {}),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (!result) return jsonError("Couldn't save your profile.", 502);
    if (username === undefined && !result.username) {
      return jsonError("Choose a username before setting favorites.", 400);
    }
    return NextResponse.json({ username: result.username, favorites: result.favorites ?? [] });
  } catch (error) {
    // Duplicate key on the case-insensitive unique index means the name is taken.
    if ((error as { code?: number }).code === 11000)
      return jsonError("That username is taken.", 409);
    console.error("Profile update failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't save your profile.", 502);
  }
}
