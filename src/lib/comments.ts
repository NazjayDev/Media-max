import { ObjectId } from "mongodb";
import { MAX_COMMENT_LENGTH, type ReportReason } from "@/lib/commentRules";
import { ensureIndex, getDb } from "@/lib/mongodb";

interface CommentReport {
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
  /** Number of likes, including any seeded for sample discussions. */
  likeCount?: number;
  /** People who liked it, so one person can only like a comment once. */
  likedBy?: string[];
  /** Demo-only sample discussion. Never shown to anyone but demo accounts. */
  sample?: boolean;
  sampleAuthor?: string;
}

export interface PublicComment {
  id: string;
  body: string;
  authorName: string;
  spoiler: boolean;
  createdAt: string;
  mine: boolean;
  likes: number;
  liked: boolean;
  replies: PublicComment[];
}

// Different people must agree before a comment is covered or hidden.
export const HIDE_AFTER_REPORTS = 3;
export const SPOILER_AFTER_REPORTS = 2;

export async function commentsCollection() {
  const db = await getDb();
  if (!db) return null;
  const collection = db.collection<CommentDoc>("comments");
  await ensureIndex(collection, { mediaKey: 1, parentId: 1, createdAt: -1 });
  await ensureIndex(collection, { createdAt: -1 });
  return collection;
}

/** Comments anyone may see. Sample discussions are added only for demo accounts. */
export const visibleComments = (includeSample: boolean) => ({
  hidden: { $ne: true },
  ...(includeSample ? {} : { sample: { $ne: true } }),
});

export function toPublic(
  doc: CommentDoc,
  viewerId: string | undefined,
  names: Map<string, string>,
  replies: PublicComment[] = [],
): PublicComment {
  return {
    id: doc._id.toHexString(),
    body: doc.body,
    authorName: doc.sampleAuthor ?? names.get(doc.userId) ?? "Anonymous",
    spoiler: !!doc.spoiler,
    createdAt: doc.createdAt.toISOString(),
    mine: !!viewerId && doc.userId === viewerId,
    likes: doc.likeCount ?? 0,
    liked: !!viewerId && !!doc.likedBy?.includes(viewerId),
    replies,
  };
}

/** Trims, normalizes blank lines, and enforces the length limit. Returns null when invalid. */
export function cleanBody(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const body = raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return body.length > 0 && body.length <= MAX_COMMENT_LENGTH ? body : null;
}
