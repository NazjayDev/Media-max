"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import type { PublicComment } from "@/lib/comments";
import type { MediaType } from "@/types/media";

const MAX_LENGTH = 1000;
const POLL_MS = 15000;

function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  return image ? (
    <Image src={image} alt="" width={32} height={32} referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full ring-1 ring-border" />
  ) : (
    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-accent-from to-accent-to text-xs font-bold text-white">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

interface ComposerProps {
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}

function Composer({ placeholder, submitLabel, busy, onSubmit, onCancel }: ComposerProps) {
  const [text, setText] = useState("");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSubmit(text)) setText("");
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_LENGTH}
        rows={3}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-accent-from focus:ring-4 focus:ring-accent-from/20"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{text.length}/{MAX_LENGTH}</span>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent-from">
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={busy || text.trim().length === 0}
            className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Posting..." : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

interface CommentViewProps {
  comment: PublicComment;
  signedIn: boolean;
  isReply?: boolean;
  onReply: (parentId: string) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  replyingTo: string | null;
  replyComposer: React.ReactNode;
}

function CommentView({ comment, signedIn, isReply, onReply, onDelete, onReport, replyingTo, replyComposer }: CommentViewProps) {
  return (
    <li className="flex gap-3">
      <Avatar name={comment.authorName} image={comment.authorImage} />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{comment.authorName}</span>{" "}
          <span className="text-xs text-muted">{timeAgo(comment.createdAt)}</span>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6">{comment.body}</p>
        <div className="mt-1 flex gap-3 text-xs text-muted">
          {!isReply && signedIn && (
            <button type="button" onClick={() => onReply(comment.id)} className="hover:text-foreground">
              Reply
            </button>
          )}
          {comment.mine ? (
            <button type="button" onClick={() => onDelete(comment.id)} className="hover:text-red-500">
              Delete
            </button>
          ) : (
            signedIn && (
              <button type="button" onClick={() => onReport(comment.id)} className="hover:text-foreground">
                Report
              </button>
            )
          )}
        </div>

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
                onReport={onReport}
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

export default function Discussion({ mediaType, id }: { mediaType: MediaType; id: number }) {
  const { status } = useSession();
  const signedIn = status === "authenticated";

  const [comments, setComments] = useState<PublicComment[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedOlder, setLoadedOlder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const query = `mediaType=${mediaType}&id=${id}`;

  // Load (and periodically refresh) the newest page. Refreshing pauses once older pages are loaded.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/comments?${query}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("load failed"))))
        .then((data) => {
          if (cancelled) return;
          setComments(data.comments);
          setTotal(data.total);
          setHasMore(data.hasMore);
          setLoadedOlder(false);
          setError("");
        })
        .catch(() => {
          if (!cancelled) setError("Couldn't load the discussion.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !loadedOlder) load();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [query, nonce, loadedOlder]);

  const loadOlder = useCallback(async () => {
    const last = comments[comments.length - 1];
    if (!last) return;
    const res = await fetch(`/api/comments?${query}&before=${encodeURIComponent(last.createdAt)}`);
    if (!res.ok) return;
    const data = await res.json();
    setComments((prev) => [...prev, ...data.comments]);
    setHasMore(data.hasMore);
    setLoadedOlder(true);
  }, [comments, query]);

  async function post(body: string, parentId?: string): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType, id, body, parentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't post your comment.");
        return false;
      }
      setReplyingTo(null);
      setNonce((n) => n + 1);
      return true;
    } catch {
      setError("Network error. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(commentId: string) {
    if (!window.confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments?id=${commentId}`, { method: "DELETE" });
    if (res.ok) setNonce((n) => n + 1);
    else setError("Couldn't delete that comment.");
  }

  async function report(commentId: string) {
    if (!window.confirm("Report this comment as inappropriate?")) return;
    const res = await fetch("/api/comments/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: commentId }),
    });
    setError(res.ok ? "" : "Couldn't send that report.");
    if (res.ok) window.alert("Thanks. We'll review it.");
  }

  return (
    <section aria-labelledby="discussion-heading" className="mt-12">
      <h2 id="discussion-heading" className="text-xl font-bold">
        Discussion <span className="text-base font-normal text-muted">({total})</span>
      </h2>

      <div className="mt-4">
        {signedIn ? (
          <Composer placeholder="Share your thoughts (no spoilers without a warning)" submitLabel="Post" busy={busy && replyingTo === null} onSubmit={(b) => post(b)} />
        ) : (
          <div className="rounded-xl border border-border bg-surface px-5 py-4 text-sm">
            <p className="text-muted">Sign in to join the conversation.</p>
            <button
              type="button"
              onClick={() => signIn("google")}
              className="mt-3 rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 py-2 font-semibold text-white"
            >
              Sign in with Google
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-8" aria-live="polite">
        {loading ? (
          <p className="text-sm text-muted">Loading discussion...</p>
        ) : comments.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-5 py-6 text-center text-sm text-muted">
            No comments yet. Start the conversation.
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {comments.map((c) => (
              <CommentView
                key={c.id}
                comment={c}
                signedIn={signedIn}
                onReply={(pid) => setReplyingTo((cur) => (cur === pid ? null : pid))}
                onDelete={remove}
                onReport={report}
                replyingTo={replyingTo}
                replyComposer={
                  <Composer
                    placeholder="Write a reply"
                    submitLabel="Reply"
                    busy={busy}
                    onSubmit={(b) => post(b, replyingTo ?? undefined)}
                    onCancel={() => setReplyingTo(null)}
                  />
                }
              />
            ))}
          </ul>
        )}

        {hasMore && (
          <button type="button" onClick={loadOlder} className="mt-6 rounded-full border border-border px-5 py-2 text-sm font-medium hover:border-accent-from">
            Load older comments
          </button>
        )}
      </div>
    </section>
  );
}
