import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { MediaType } from "@/types/media";

export interface CommentDoc {
  _id: ObjectId;
  mediaKey: string;
  parentId: ObjectId | null;
  userId: string;
  authorName: string;
  authorImage: string | null;
  body: string;
  createdAt: Date;
  reports?: string[];
  hidden?: boolean;
}

export interface PublicComment {
  id: string;
  body: string;
  authorName: string;
  authorImage: string | null;
  createdAt: string;
  mine: boolean;
  replies: PublicComment[];
}

export const MAX_COMMENT_LENGTH = 1000;
export const HIDE_AFTER_REPORTS = 3;

export const mediaKeyOf = (mediaType: MediaType, id: number) => `${mediaType}:${id}`;

export async function commentsCollection() {
  const db = await getDb();
  if (!db) return null;
  const collection = db.collection<CommentDoc>("comments");
  await collection.createIndex({ mediaKey: 1, parentId: 1, createdAt: -1 }).catch(() => undefined);
  return collection;
}

export function toPublic(doc: CommentDoc, viewerId: string | undefined, replies: PublicComment[] = []): PublicComment {
  return {
    id: doc._id.toHexString(),
    body: doc.body,
    authorName: doc.authorName,
    authorImage: doc.authorImage,
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
