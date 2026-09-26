"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import type { PublicComment, ReportReason } from "@/lib/comments";
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
    if (Math.abs(seconds) >= size)
      return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

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

interface UsernameFormProps {
  initial: string;
  intro?: string;
  submitLabel: string;
  onSaved: (username: string) => void;
  onCancel?: () => void;
}

function UsernameForm({
  initial,
  intro,
  submitLabel,
  onSaved,
  onCancel,
}: UsernameFormProps) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that username.");
        return;
      }
      onSaved(data.username);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="rounded-xl border border-border bg-surface px-5 py-4 text-sm"
    >
      {intro && <p className="mb-3 text-muted">{intro}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.trim())}
          maxLength={20}
          placeholder="e.g. night_owl_42"
          aria-label="Username"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 outline-none focus:border-accent-from focus:ring-4 focus:ring-accent-from/20"
        />
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-border px-4 py-2 hover:border-accent-from"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={busy || value.length < 3}
            className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        3-20 letters, numbers, _ or -. Unique to you.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}

interface ComposerProps {
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (body: string, spoiler: boolean) => Promise<boolean>;
  onCancel?: () => void;
}

function Composer({
  placeholder,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [spoiler, setSpoiler] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await onSubmit(text, spoiler)) {
          setText("");
          setSpoiler(false);
        }
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={spoiler}
            onClick={() => setSpoiler((v) => !v)}
            title="Readers will have to click to see this comment"
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              spoiler
                ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            <span aria-hidden>{spoiler ? "🙈" : "👁"}</span>
            {spoiler ? "Marked as spoiler" : "Contains spoilers"}
          </button>
          <span className="text-[11px] text-muted">
            {text.length}/{MAX_LENGTH}
          </span>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent-from"
            >
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

const REPORT_OPTIONS: { value: ReportReason; label: string; hint: string }[] = [
  {
    value: "spoiler",
    label: "Spoiler without a warning",
    hint: "It should have been marked as a spoiler.",
  },
  {
    value: "harassment",
    label: "Hurtful or harassing",
    hint: "Insults, hate, or attacks on people.",
  },
  {
    value: "offtopic",
    label: "Unrelated to this title",
    hint: "Off-topic or not about the movie or show.",
  },
  {
    value: "spam",
    label: "Spam or advertising",
    hint: "Links, promotion, or repeated posts.",
  },
];

function ReportForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (reason: ReportReason) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reason) return;
        setBusy(true);
        await onSubmit(reason);
        setBusy(false);
      }}
      className="mt-3 rounded-xl border border-border bg-surface p-3 text-sm"
    >
      <fieldset>
        <legend className="mb-2 font-semibold">
          Why are you reporting this?
        </legend>
        <div className="flex flex-col gap-1.5">
          {REPORT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-2"
            >
              <input
                type="radio"
                name="report-reason"
                value={opt.value}
                checked={reason === opt.value}
                onChange={() => setReason(opt.value)}
                className="mt-1"
              />
              <span>
                {opt.label}
                <span className="block text-xs text-muted">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={!reason || busy}
          className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 py-1.5 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Sending..." : "Send report"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border px-4 py-1.5 hover:border-accent-from"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function CommentBody({ comment }: { comment: PublicComment }) {
  const [revealed, setRevealed] = useState(false);

  if (comment.spoiler && !revealed) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
        <span aria-hidden>🙈</span>
        <span className="text-amber-700 dark:text-amber-300">
          This comment contains spoilers.
        </span>
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
      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6">
        {comment.body}
      </p>
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

function CommentView({
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
          <span className="text-xs text-muted">
            {timeAgo(comment.createdAt)}
          </span>
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

        {replyingTo === comment.id && (
          <div className="mt-3">{replyComposer}</div>
        )}

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

export default function Discussion({
  mediaType,
  id,
}: {
  mediaType: MediaType;
  id: number;
}) {
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
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [nonce, setNonce] = useState(0);
  // undefined = still loading, null = signed in without a username yet
  const [username, setUsername] = useState<string | null | undefined>(
    undefined,
  );
  const [editingName, setEditingName] = useState(false);

  const query = `mediaType=${mediaType}&id=${id}`;

  // Load (and periodically refresh) the newest page. Refreshing pauses once older pages are loaded.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/comments?${query}`)
        .then((res) =>
          res.ok ? res.json() : Promise.reject(new Error("load failed")),
        )
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

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch("/api/profile")
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("profile failed")),
      )
      .then((data) => {
        if (!cancelled) setUsername(data.username);
      })
      .catch(() => {
        if (!cancelled) setUsername(null);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const loadOlder = useCallback(async () => {
    const last = comments[comments.length - 1];
    if (!last) return;
    const res = await fetch(
      `/api/comments?${query}&before=${encodeURIComponent(last.createdAt)}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    setComments((prev) => [...prev, ...data.comments]);
    setHasMore(data.hasMore);
    setLoadedOlder(true);
  }, [comments, query]);

  async function post(
    body: string,
    spoiler: boolean,
    parentId?: string,
  ): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType, id, body, spoiler, parentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "username_required") setUsername(null);
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
    const res = await fetch(`/api/comments?id=${commentId}`, {
      method: "DELETE",
    });
    if (res.ok) setNonce((n) => n + 1);
    else setError("Couldn't delete that comment.");
  }

  async function sendReport(
    commentId: string,
    reason: ReportReason,
  ): Promise<boolean> {
    const res = await fetch("/api/comments/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: commentId, reason }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't send that report.");
      return false;
    }
    setError("");
    setReportingId(null);
    setReportedIds((prev) => new Set(prev).add(commentId));
    setNonce((n) => n + 1);
    return true;
  }

  return (
    <section aria-labelledby="discussion-heading" className="mt-12">
      <h2 id="discussion-heading" className="text-xl font-bold">
        Discussion{" "}
        <span className="text-base font-normal text-muted">({total})</span>
      </h2>

      <div className="mt-4">
        {signedIn ? (
          username === undefined ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : username === null || editingName ? (
            <UsernameForm
              initial={username ?? ""}
              intro={
                username === null
                  ? "Pick a username to join the discussion. It's the only name shown on your comments, so you can stay anonymous."
                  : undefined
              }
              submitLabel={username === null ? "Save username" : "Update"}
              onSaved={(name) => {
                setUsername(name);
                setEditingName(false);
                setNonce((n) => n + 1);
              }}
              onCancel={
                username === null ? undefined : () => setEditingName(false)
              }
            />
          ) : (
            <>
              <p className="mb-2 text-xs text-muted">
                Posting as{" "}
                <span className="font-semibold text-foreground">
                  {username}
                </span>{" "}
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Change
                </button>
              </p>
              <Composer
                placeholder="Share your thoughts (no spoilers without a warning)"
                submitLabel="Post"
                busy={busy && replyingTo === null}
                onSubmit={(b, sp) => post(b, sp)}
              />
            </>
          )
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
                onReply={(pid) =>
                  setReplyingTo((cur) => (cur === pid ? null : pid))
                }
                onDelete={remove}
                onStartReport={(cid) =>
                  setReportingId((cur) => (cur === cid ? null : cid))
                }
                onSendReport={sendReport}
                onCancelReport={() => setReportingId(null)}
                reportingId={reportingId}
                reportedIds={reportedIds}
                replyingTo={replyingTo}
                replyComposer={
                  <Composer
                    placeholder="Write a reply"
                    submitLabel="Reply"
                    busy={busy}
                    onSubmit={(b, sp) => post(b, sp, replyingTo ?? undefined)}
                    onCancel={() => setReplyingTo(null)}
                  />
                }
              />
            ))}
          </ul>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={loadOlder}
            className="mt-6 rounded-full border border-border px-5 py-2 text-sm font-medium hover:border-accent-from"
          >
            Load older comments
          </button>
        )}
      </div>
    </section>
  );
}
