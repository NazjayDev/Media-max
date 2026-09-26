import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { jsonError, requireUser } from "@/lib/api";
import { commentsCollection, visibleComments } from "@/lib/comments";
import { allowRequest } from "@/lib/rateLimit";

/** Toggles the signed-in person's like on a comment. Returns the new state and count. */
export async function POST(request: NextRequest) {
  const guard = await requireUser("Sign in to like comments");
  if ("response" in guard) return guard.response;
  const { userId, user } = guard;

  if (!(await allowRequest("like", userId, 60, 60))) {
    return jsonError("Slow down a little.", 429);
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id || !ObjectId.isValid(body.id)) return jsonError("Invalid comment", 400);

  const collection = await commentsCollection();
  if (!collection) return jsonError("Discussion is unavailable", 503);

  const _id = new ObjectId(body.id);
  const filter = { _id, ...visibleComments(!!user.demo) };
  const comment = await collection.findOne(filter, { projection: { likedBy: 1 } });
  if (!comment) return jsonError("Comment not found", 404);

  // The filters make each branch a no-op if two requests race, so the count can't drift.
  const alreadyLiked = !!comment.likedBy?.includes(userId);
  const updated = alreadyLiked
    ? await collection.findOneAndUpdate(
        { ...filter, likedBy: userId },
        { $pull: { likedBy: userId }, $inc: { likeCount: -1 } },
        { returnDocument: "after", projection: { likeCount: 1, likedBy: 1 } },
      )
    : await collection.findOneAndUpdate(
        { ...filter, likedBy: { $ne: userId } },
        { $addToSet: { likedBy: userId }, $inc: { likeCount: 1 } },
        { returnDocument: "after", projection: { likeCount: 1, likedBy: 1 } },
      );

  const current =
    updated ?? (await collection.findOne(filter, { projection: { likeCount: 1, likedBy: 1 } }));
  return NextResponse.json({
    liked: !!current?.likedBy?.includes(userId),
    likes: Math.max(0, current?.likeCount ?? 0),
  });
}
