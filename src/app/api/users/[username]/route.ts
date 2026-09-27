import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { getProfileByUsername } from "@/lib/profile";
import { topPostsFor } from "@/lib/comments";
import { parseMedia } from "@/lib/media";
import { getTitleCard } from "@/lib/tmdb";

/** A public profile page: username, favorites, and the person's best-liked discussion posts. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) return jsonError("No one goes by that name here.", 404);

  const posts = await topPostsFor(profile.userId, 5);
  const cards = await Promise.all(
    posts.map((p) => {
      const media = parseMedia(...(p.mediaKey.split(":") as [string, string]));
      return media ? getTitleCard(media.mediaType, media.id) : null;
    }),
  );

  const topPosts = posts.flatMap((p, i) => {
    const card = cards[i];
    if (!card) return [];
    return [
      {
        id: p.id,
        body: p.body,
        spoiler: p.spoiler,
        likes: p.likes,
        createdAt: p.createdAt,
        title: {
          mediaType: card.mediaType,
          id: card.id,
          title: card.title,
          posterPath: card.posterPath,
        },
      },
    ];
  });

  return NextResponse.json({
    username: profile.username,
    favorites: profile.favorites,
    memberSince: profile.memberSince,
    topPosts,
  });
}
