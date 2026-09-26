"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const KINDS = [
  { value: "idea", label: "Idea" },
  { value: "bug", label: "Something's broken" },
  { value: "other", label: "Other" },
] as const;

const MAX_MESSAGE = 1000;

/** Event other parts of the site fire to open the feedback dialog, for example the menu. */
export const OPEN_FEEDBACK_EVENT = "open-feedback";

/** Floating feedback button and the dialog it opens. Feedback is stored for the team to read. */
export default function FeedbackButton() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("idea");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, left empty by real people
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function open() {
    setSent(false);
    setError("");
    dialog.current?.showModal();
  }

  useEffect(() => {
    window.addEventListener(OPEN_FEEDBACK_EVENT, open);
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, open);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, contact, website, path: pathname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't send that. Please try again.");
      setSent(true);
      setMessage("");
      setContact("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        // The Ask page keeps its message box fixed to the bottom, so the button sits above it there.
        className={`fixed right-4 z-30 flex items-center gap-2 rounded-full border border-border bg-surface/95 px-4 py-2.5 text-sm font-bold shadow-lg shadow-black/40 backdrop-blur transition hover:border-accent-to hover:text-accent-from ${
          pathname === "/ask" ? "bottom-24" : "bottom-4"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path
            d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V15h-.5A1.5 1.5 0 0 1 5 13.5z"
            strokeLinejoin="round"
          />
        </svg>
        Feedback
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="feedback-title"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/70"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="feedback-title" className="text-xl font-extrabold">
              Help us improve Media Max
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="-mr-1 rounded-full px-2 text-2xl leading-none text-muted hover:text-foreground"
            >
              &times;
            </button>
          </div>

          {sent ? (
            <div className="mt-5" role="status">
              <p className="font-semibold">Thanks, we got it.</p>
              <p className="mt-1 text-sm text-muted">
                Every message is read by the team. You can send another whenever you like.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="rounded-full border border-border px-5 py-2 text-sm font-semibold hover:border-accent-to"
                >
                  Send another
                </button>
                <button
                  type="button"
                  onClick={() => dialog.current?.close()}
                  className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-5 py-2 text-sm font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
              <p className="text-sm text-muted">
                Tell us what would make this better, or what isn&apos;t working.
              </p>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold">What kind of feedback?</legend>
                <div className="flex flex-wrap gap-2">
                  {KINDS.map((k) => (
                    <label
                      key={k.value}
                      className={`cursor-pointer rounded-md border px-3.5 py-2 text-sm font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-from ${
                        kind === k.value
                          ? "border-accent-to bg-accent-to text-[var(--on-accent)]"
                          : "border-border hover:border-accent-to"
                      }`}
                    >
                      <input
                        type="radio"
                        name="feedback-kind"
                        value={k.value}
                        checked={kind === k.value}
                        onChange={() => setKind(k.value)}
                        className="sr-only"
                      />
                      {k.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="feedback-message" className="mb-2 block text-sm font-semibold">
                  Your feedback
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={MAX_MESSAGE}
                  rows={5}
                  required
                  placeholder="For example: I'd like to filter by streaming service on the home page."
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent-from"
                />
                <p className="mt-1 text-right text-xs text-muted">
                  {message.length}/{MAX_MESSAGE}
                </p>
              </div>

              <div>
                <label htmlFor="feedback-contact" className="mb-2 block text-sm font-semibold">
                  Email{" "}
                  <span className="font-normal text-muted">
                    (optional, only if you want a reply)
                  </span>
                </label>
                <input
                  id="feedback-contact"
                  type="email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={120}
                  autoComplete="email"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent-from"
                />
              </div>

              {/* Hidden from people; bots that fill every field give themselves away. */}
              <div className="hidden" aria-hidden>
                <label htmlFor="feedback-website">Website</label>
                <input
                  id="feedback-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={sending || message.trim().length < 3}
                className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-6 py-3 text-base font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-none disabled:bg-surface disabled:text-muted"
              >
                {sending ? "Sending..." : "Send feedback"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
