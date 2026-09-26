import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { MediaType } from "@/types/media";

export type ReportReason = "spoiler" | "harassment" | "offtopic" | "spam";
export const REPORT_REASONS: ReportReason[] = ["spoiler", "harassment", "offtopic", "spam"];

export interface CommentReport {
  userId: string;
  reason: ReportReason;
  at: Date;
}

export interface CommentDoc {
  _id: ObjectId;
  mediaKey: string;
  parentId: ObjectId | null;
  userId: string;
  body: string;
  createdAt: Date;
  spoiler?: boolean;
  /** True when the spoiler cover was added by community reports rather than the author. */
  spoilerFlagged?: boolean;
  reports?: CommentReport[];
  hidden?: boolean;
}

export interface PublicComment {
  id: string;
  body: string;
  authorName: string;
  spoiler: boolean;
  createdAt: string;
  mine: boolean;
  replies: PublicComment[];
}

export const MAX_COMMENT_LENGTH = 1000;
// Different people must agree before a comment is covered or hidden.
export const HIDE_AFTER_REPORTS = 3;
export const SPOILER_AFTER_REPORTS = 2;

export const mediaKeyOf = (mediaType: MediaType, id: number) => `${mediaType}:${id}`;

export async function commentsCollection() {
  const db = await getDb();
  if (!db) return null;
  const collection = db.collection<CommentDoc>("comments");
  await collection.createIndex({ mediaKey: 1, parentId: 1, createdAt: -1 }).catch(() => undefined);
  return collection;
}

export function toPublic(
  doc: CommentDoc,
  viewerId: string | undefined,
  names: Map<string, string>,
  replies: PublicComment[] = []
): PublicComment {
  return {
    id: doc._id.toHexString(),
    body: doc.body,
    authorName: names.get(doc.userId) ?? "Anonymous",
    spoiler: !!doc.spoiler,
    createdAt: doc.createdAt.toISOString(),
    mine: !!viewerId && doc.userId === viewerId,
    replies,
  };
}

/** Trims, normalizes blank lines, and enforces the length limit. Returns null when invalid. */
export function cleanBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const body = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return body.length > 0 && body.length <= MAX_COMMENT_LENGTH ? body : null;
}
