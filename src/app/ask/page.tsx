"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Message, { type ThreadMessage } from "@/components/chat/Message";
import MicButton from "@/components/MicButton";
import { ASK_SUGGESTIONS } from "@/lib/demoPrompts";
import { useVoiceReplies } from "@/lib/voiceSetting";

const MAX_INPUT = 300;
const HISTORY_SENT = 8;

async function speak(text: string) {
  try {
    const res = await fetch("/api/voice/narrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch {
    // Spoken replies are a bonus; never surface errors for them.
  }
}

export default function AskPage() {
  const { data: session } = useSession();
  const voiceReplies = useVoiceReplies();
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [warming, setWarming] = useState(false);
  const [warmNote, setWarmNote] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread, busy]);

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_INPUT);
    if (!content || busy) return;

    const next: ThreadMessage[] = [...thread, { role: "user", content }];
    setThread(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-HISTORY_SENT).map(({ role, content }) => ({ role, content })),
          seen: next.flatMap((m) => m.results?.map((r) => `${r.mediaType}:${r.id}`) ?? []),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");

      setThread([
        ...next,
        {
          role: "assistant",
          content: data.message,
          results: data.results,
          followUps: data.followUps,
        },
      ]);
      if (voiceReplies) void speak(data.message);
    } catch (error) {
      setThread([
        ...next,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Something went wrong. Try again.",
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function warmDemoAnswers() {
    setWarming(true);
    setWarmNote("");
    try {
      const res = await fetch("/api/demo/prewarm-chat", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setWarmNote(
        res.ok
          ? `Ready: ${data.cached} of ${data.total} starter answers are pre-loaded.`
          : (data.error ?? "Couldn't warm up."),
      );
    } catch {
      setWarmNote("Network error. Try again.");
    } finally {
      setWarming(false);
    }
  }

  const latestAssistant = thread.map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-40 pt-24 sm:px-8">
      <Link href="/" className="mb-4 text-sm text-muted hover:text-foreground">
        &larr; Back to home
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="bg-gradient-to-r from-accent-from to-accent-to bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
          Ask Media Max
        </h1>
        {thread.length > 0 && (
          <button
            type="button"
            onClick={() => setThread([])}
            className="rounded-full border border-border px-4 py-1.5 text-sm hover:border-accent-from"
          >
            New chat
          </button>
        )}
      </div>

      {session?.user?.demo && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>
            {warmNote || "Demo account: pre-load the starter answers so they appear instantly."}
          </span>
          <button
            type="button"
            disabled={warming}
            onClick={warmDemoAnswers}
            className="rounded-full border border-amber-500/60 px-3 py-1 font-semibold hover:bg-amber-500/20 disabled:opacity-50"
          >
            {warming ? "Loading..." : "Pre-load answers"}
          </button>
        </div>
      )}

      {thread.length === 0 ? (
        <div className="mt-8">
          <p className="max-w-xl text-muted">
            Tell me what you&apos;re in the mood for. Add limits like a length or a streaming
            service, then keep refining: &ldquo;more recent&rdquo;, &ldquo;less violent&rdquo;,
            &ldquo;something shorter&rdquo;.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {ASK_SUGGESTIONS.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => send(text)}
                className="rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm transition hover:border-accent-from sm:max-w-xs"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-6" aria-live="polite">
          {thread.map((m, i) => (
            <Message
              key={i}
              message={m}
              isLatest={i === latestAssistant}
              disabled={busy}
              onFollowUp={send}
            />
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted" role="status">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-from" />
              Finding matches...
            </p>
          )}
        </div>
      )}
      <div ref={bottomRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur"
      >
        <div className="mx-auto flex max-w-4xl items-start gap-2 px-4 py-3 sm:px-8">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_INPUT}
            placeholder="e.g. a slow-burn thriller under two hours on Netflix"
            aria-label="Ask Media Max"
            disabled={busy}
            className="min-w-0 flex-1 rounded-full border border-border bg-surface px-5 py-3 text-base outline-none transition focus:border-accent-from focus:ring-4 focus:ring-accent-from/20 disabled:opacity-60"
          />
          <MicButton disabled={busy} onTranscript={(text) => void send(text)} />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-6 py-3 font-semibold text-white disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
