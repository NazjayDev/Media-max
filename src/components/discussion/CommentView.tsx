"use client";

import { useState } from "react";
import type { ReportReason } from "@/lib/commentRules";
import type { PublicComment } from "@/lib/comments";
import ReportForm from "./ReportForm";
import { timeAgo } from "./time";

function Avatar({ name }: { name: string }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: `hsl(${hash} 55% 42%)` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function CommentBody({ comment }: { comment: PublicComment }) {
  const [revealed, setRevealed] = useState(false);

  if (comment.spoiler && !revealed) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
        <span aria-hidden>🙈</span>
        <span className="text-amber-700 dark:text-amber-300">This comment contains spoilers.</span>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded-full border border-amber-500/60 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
        >
          Show anyway
        </button>
      </div>
    );
  }

  return (
    <>
      {comment.spoiler && (
        <button
          type="button"
          onClick={() => setRevealed(false)}
          className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600 hover:underline dark:text-amber-400"
        >
          Spoiler · hide again
        </button>
      )}
      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6">{comment.body}</p>
    </>
  );
}

interface CommentViewProps {
  comment: PublicComment;
  signedIn: boolean;
  isReply?: boolean;
  onReply: (parentId: string) => void;
  onDelete: (id: string) => void;
  onStartReport: (id: string) => void;
  onSendReport: (id: string, reason: ReportReason) => Promise<boolean>;
  onCancelReport: () => void;
  reportingId: string | null;
  reportedIds: Set<string>;
  replyingTo: string | null;
  replyComposer: React.ReactNode;
}

export default function CommentView({
  comment,
  signedIn,
  isReply,
  onReply,
  onDelete,
  onStartReport,
  onSendReport,
  onCancelReport,
  reportingId,
  reportedIds,
  replyingTo,
  replyComposer,
}: CommentViewProps) {
  return (
    <li className="flex gap-3">
      <Avatar name={comment.authorName} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{comment.authorName}</span>{" "}
          <span className="text-xs text-muted">{timeAgo(comment.createdAt)}</span>
        </p>
        <CommentBody comment={comment} />
        <div className="mt-1 flex gap-3 text-xs text-muted">
          {!isReply && signedIn && (
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="hover:text-foreground"
            >
              Reply
            </button>
          )}
          {comment.mine ? (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="hover:text-red-500"
            >
              Delete
            </button>
          ) : (
            signedIn &&
            (reportedIds.has(comment.id) ? (
              <span>Reported. Thanks.</span>
            ) : (
              <button
                type="button"
                onClick={() => onStartReport(comment.id)}
                className="hover:text-foreground"
              >
                Report
              </button>
            ))
          )}
        </div>

        {reportingId === comment.id && (
          <ReportForm
            onSubmit={(reason) => onSendReport(comment.id, reason)}
            onCancel={onCancelReport}
          />
        )}

        {replyingTo === comment.id && <div className="mt-3">{replyComposer}</div>}

        {comment.replies.length > 0 && (
          <ul className="mt-4 flex flex-col gap-4 border-l border-border pl-4">
            {comment.replies.map((r) => (
              <CommentView
                key={r.id}
                comment={r}
                signedIn={signedIn}
                isReply
                onReply={onReply}
                onDelete={onDelete}
                onStartReport={onStartReport}
                onSendReport={onSendReport}
                onCancelReport={onCancelReport}
                reportingId={reportingId}
                reportedIds={reportedIds}
                replyingTo={replyingTo}
                replyComposer={replyComposer}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
