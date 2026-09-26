import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { getDb } from "@/lib/mongodb";
import { allowRequest, clientIp } from "@/lib/rateLimit";

const KINDS = ["idea", "bug", "other"] as const;
type Kind = (typeof KINDS)[number];

const MAX_MESSAGE = 1000;
const MAX_CONTACT = 120;

interface FeedbackDoc {
  kind: Kind;
  message: string;
  /** Optional address the person typed if they want a reply. */
  contact?: string;
  /** Page they were on when they sent it. */
  path: string;
  /** Present only when they were signed in. */
  userId?: string;
  createdAt: Date;
}

/** Stores a piece of feedback. Anyone can send it; read them with scripts/read-feedback.mjs. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    message?: unknown;
    contact?: unknown;
    path?: unknown;
    website?: unknown;
  } | null;

  // Real people never fill this hidden field; bots often do. Pretend it worked and drop it.
  if (typeof body?.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (message.length < 3 || message.length > MAX_MESSAGE) {
    return jsonError(`Write a message of 3 to ${MAX_MESSAGE} characters.`, 400);
  }
  const kind = KINDS.find((k) => k === body?.kind) ?? "other";
  const contact =
    typeof body?.contact === "string" ? body.contact.trim().slice(0, MAX_CONTACT) : "";
  const path = typeof body?.path === "string" ? body.path.slice(0, 120) : "";

  if (!(await allowRequest("feedback", clientIp(request), 5, 3600))) {
    return jsonError("You've sent a lot of feedback. Please try again later.", 429);
  }

  const db = await getDb();
  if (!db) return jsonError("Feedback is unavailable right now. Please try again soon.", 503);

  const userId = (await auth())?.user?.id;
  const doc: FeedbackDoc = {
    kind,
    message,
    path,
    createdAt: new Date(),
    ...(contact ? { contact } : {}),
    ...(userId ? { userId } : {}),
  };
  await db.collection<FeedbackDoc>("feedback").insertOne(doc);
  return NextResponse.json({ ok: true }, { status: 201 });
}
