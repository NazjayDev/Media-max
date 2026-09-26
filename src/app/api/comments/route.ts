import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { jsonError, requireUser } from "@/lib/api";
import { cleanBody, commentsCollection, toPublic, type PublicComment } from "@/lib/comments";
import { mediaKey, parseMedia } from "@/lib/media";
import { usernamesFor } from "@/lib/profile";
import { allowRequest } from "@/lib/rateLimit";
import { tmdbFetch } from "@/lib/tmdb";
import { auth } from "@/auth";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const media = parseMedia(params.get("mediaType"), params.get("id"));
  if (!media) return jsonError("Invalid title", 400);

  const collection = await commentsCollection();
  if (!collection) return jsonError("Discussion is unavailable", 503);

  const viewerId = (await auth())?.user?.id;
  const key = mediaKey(media.mediaType, media.id);
  const beforeParam = params.get("before");
  const before =
    beforeParam && !Number.isNaN(Date.parse(beforeParam)) ? new Date(beforeParam) : null;

  const visible = { mediaKey: key, hidden: { $ne: true } };
  const [top, total] = await Promise.all([
    collection
      .find({ ...visible, parentId: null, ...(before ? { createdAt: { $lt: before } } : {}) })
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE + 1)
      .toArray(),
    collection.countDocuments(visible),
  ]);

  const hasMore = top.length > PAGE_SIZE;
  const page = top.slice(0, PAGE_SIZE);
  const replies = page.length
    ? await collection
        .find({ ...visible, parentId: { $in: page.map((c) => c._id) } })
        .sort({ createdAt: 1 })
        .toArray()
    : [];

  const names = await usernamesFor([...page, ...replies].map((c) => c.userId));
  const repliesByParent = new Map<string, PublicComment[]>();
  for (const r of replies) {
    const parent = r.parentId!.toHexString();
    repliesByParent.set(parent, [
      ...(repliesByParent.get(parent) ?? []),
      toPublic(r, viewerId, names),
    ]);
  }

  return NextResponse.json({
    total,
    hasMore,
    comments: page.map((c) =>
      toPublic(c, viewerId, names, repliesByParent.get(c._id.toHexString()) ?? []),
    ),
  });
}

export async function POST(request: NextRequest) {
  const guard = await requireUser("Sign in to join the discussion");
  if ("response" in guard) return guard.response;
  const { userId } = guard;

  const payload = (await request.json().catch(() => null)) as {
    mediaType?: string;
    id?: number | string;
    body?: unknown;
    spoiler?: unknown;
    parentId?: string;
  } | null;

  const media = parseMedia(payload?.mediaType, payload?.id);
  const body = cleanBody(payload?.body);
  if (!media || !body) return jsonError("Write a comment up to 1000 characters", 400);

  if (!(await allowRequest("comment", userId, 8, 60))) {
    return jsonError("You're posting too fast. Wait a moment.", 429);
  }

  const collection = await commentsCollection();
  if (!collection) return jsonError("Discussion is unavailable", 503);

  const names = await usernamesFor([userId]);
  if (!names.has(userId)) {
    return jsonError("Choose a username before posting.", 403, { code: "username_required" });
  }

  const key = mediaKey(media.mediaType, media.id);

  // Only real titles can have a discussion.
  try {
    await tmdbFetch(`/${media.mediaType}/${media.id}`);
  } catch {
    return jsonError("Title not found", 404);
  }

  let parentId: ObjectId | null = null;
  if (payload?.parentId) {
    if (!ObjectId.isValid(payload.parentId)) return jsonError("Invalid reply target", 400);
    const parent = await collection.findOne({ _id: new ObjectId(payload.parentId), mediaKey: key });
    if (!parent || parent.parentId !== null || parent.hidden) {
      return jsonError("That comment can't be replied to", 400);
    }
    parentId = parent._id;
  }

  const doc = {
    _id: new ObjectId(),
    mediaKey: key,
    parentId,
    userId,
    body,
    spoiler: payload?.spoiler === true,
    createdAt: new Date(),
  };
  await collection.insertOne(doc);

  return NextResponse.json({ comment: toPublic(doc, userId, names) }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !ObjectId.isValid(id)) return jsonError("Invalid comment", 400);

  const collection = await commentsCollection();
  if (!collection) return jsonError("Discussion is unavailable", 503);

  const _id = new ObjectId(id);
  const removed = await collection.deleteOne({ _id, userId: guard.userId });
  if (removed.deletedCount === 0) return jsonError("Not found", 404);

  // Removing a top-level comment removes its replies too.
  await collection.deleteMany({ parentId: _id });
  return NextResponse.json({ ok: true });
}
