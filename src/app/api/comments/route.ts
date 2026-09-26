import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import {
  cleanBody,
  commentsCollection,
  mediaKeyOf,
  toPublic,
  type PublicComment,
} from "@/lib/comments";
import { allowRequest } from "@/lib/rateLimit";
import { usernamesFor } from "@/lib/profile";
import { tmdbFetch } from "@/lib/tmdb";
import type { MediaType } from "@/types/media";

const PAGE_SIZE = 20;

function parseMedia(mediaType: string | null, id: string | null) {
  const numeric = Number(id);
  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isInteger(numeric) || numeric <= 0) {
    return null;
  }
  return { mediaType: mediaType as MediaType, id: numeric };
}

export async function GET(request: NextRequest) {
  const media = parseMedia(
    request.nextUrl.searchParams.get("mediaType"),
    request.nextUrl.searchParams.get("id")
  );
  if (!media) {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }

  const collection = await commentsCollection();
  if (!collection) {
    return NextResponse.json({ error: "Discussion is unavailable" }, { status: 503 });
  }

  const viewerId = (await auth())?.user?.id;
  const mediaKey = mediaKeyOf(media.mediaType, media.id);
  const beforeParam = request.nextUrl.searchParams.get("before");
  const before = beforeParam && !Number.isNaN(Date.parse(beforeParam)) ? new Date(beforeParam) : null;

  const visible = { mediaKey, hidden: { $ne: true } };
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
    const key = r.parentId!.toHexString();
    repliesByParent.set(key, [...(repliesByParent.get(key) ?? []), toPublic(r, viewerId, names)]);
  }

  return NextResponse.json({
    total,
    hasMore,
    comments: page.map((c) =>
      toPublic(c, viewerId, names, repliesByParent.get(c._id.toHexString()) ?? [])
    ),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in to join the discussion" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    mediaType?: string;
    id?: number | string;
    body?: unknown;
    parentId?: string;
  } | null;

  const media = parseMedia(payload?.mediaType ?? null, String(payload?.id ?? ""));
  const body = cleanBody(payload?.body);
  if (!media || !body) {
    return NextResponse.json({ error: "Write a comment up to 1000 characters" }, { status: 400 });
  }

  if (!(await allowRequest("comment", user.id, 8, 60))) {
    return NextResponse.json({ error: "You're posting too fast. Wait a moment." }, { status: 429 });
  }

  const collection = await commentsCollection();
  if (!collection) {
    return NextResponse.json({ error: "Discussion is unavailable" }, { status: 503 });
  }

  const names = await usernamesFor([user.id]);
  if (!names.has(user.id)) {
    return NextResponse.json(
      { error: "Choose a username before posting.", code: "username_required" },
      { status: 403 }
    );
  }

  const mediaKey = mediaKeyOf(media.mediaType, media.id);

  // Only real titles can have a discussion.
  try {
    await tmdbFetch(`/${media.mediaType}/${media.id}`);
  } catch {
    return NextResponse.json({ error: "Title not found" }, { status: 404 });
  }

  let parentId: ObjectId | null = null;
  if (payload?.parentId) {
    if (!ObjectId.isValid(payload.parentId)) {
      return NextResponse.json({ error: "Invalid reply target" }, { status: 400 });
    }
    const parent = await collection.findOne({ _id: new ObjectId(payload.parentId), mediaKey });
    if (!parent || parent.parentId !== null || parent.hidden) {
      return NextResponse.json({ error: "That comment can't be replied to" }, { status: 400 });
    }
    parentId = parent._id;
  }

  const doc = {
    _id: new ObjectId(),
    mediaKey,
    parentId,
    userId: user.id,
    body,
    createdAt: new Date(),
  };
  await collection.insertOne(doc);

  return NextResponse.json({ comment: toPublic(doc, user.id, names) }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }

  const collection = await commentsCollection();
  if (!collection) {
    return NextResponse.json({ error: "Discussion is unavailable" }, { status: 503 });
  }

  const _id = new ObjectId(id);
  const removed = await collection.deleteOne({ _id, userId });
  if (removed.deletedCount === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Removing a top-level comment removes its replies too.
  await collection.deleteMany({ parentId: _id });
  return NextResponse.json({ ok: true });
}
