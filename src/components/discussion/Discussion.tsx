"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import type { ReportReason } from "@/lib/commentRules";
import type { PublicComment } from "@/lib/comments";
import type { MediaType } from "@/types/media";
import CommentView from "./CommentView";
import Composer from "./Composer";
import UsernameForm from "./UsernameForm";

const POLL_MS = 15000;

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
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [nonce, setNonce] = useState(0);
  // undefined = still loading, null = signed in without a username yet
  const [username, setUsername] = useState<string | null | undefined>(undefined);
  const [editingName, setEditingName] = useState(false);

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

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("profile failed"))))
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
    const res = await fetch(`/api/comments?${query}&before=${encodeURIComponent(last.createdAt)}`);
    if (!res.ok) return;
    const data = await res.json();
    setComments((prev) => [...prev, ...data.comments]);
    setHasMore(data.hasMore);
    setLoadedOlder(true);
  }, [comments, query]);

  async function post(body: string, spoiler: boolean, parentId?: string): Promise<boolean> {
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

  async function like(commentId: string) {
    const res = await fetch("/api/comments/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: commentId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't save your like.");
      return;
    }
    const { liked, likes } = (await res.json()) as { liked: boolean; likes: number };
    const patch = (list: PublicComment[]): PublicComment[] =>
      list.map((c) => ({
        ...c,
        ...(c.id === commentId ? { liked, likes } : {}),
        replies: patch(c.replies),
      }));
    setComments(patch);
  }

  async function remove(commentId: string) {
    if (!window.confirm("Delete this comment?")) return;
    const res = await fetch(`/api/comments?id=${commentId}`, {
      method: "DELETE",
    });
    if (res.ok) setNonce((n) => n + 1);
    else setError("Couldn't delete that comment.");
  }

  async function sendReport(commentId: string, reason: ReportReason): Promise<boolean> {
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
        Discussion <span className="text-base font-normal text-muted">({total})</span>
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
              onCancel={username === null ? undefined : () => setEditingName(false)}
            />
          ) : (
            <>
              <p className="mb-2 text-xs text-muted">
                Posting as <span className="font-semibold text-foreground">{username}</span>{" "}
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
                onReply={(pid) => setReplyingTo((cur) => (cur === pid ? null : pid))}
                onLike={like}
                onDelete={remove}
                onStartReport={(cid) => setReportingId((cur) => (cur === cid ? null : cid))}
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
