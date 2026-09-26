"use client";

import { useState } from "react";
import { MAX_COMMENT_LENGTH } from "@/lib/commentRules";

interface ComposerProps {
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (body: string, spoiler: boolean) => Promise<boolean>;
  onCancel?: () => void;
}

export default function Composer({
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
        maxLength={MAX_COMMENT_LENGTH}
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
            {text.length}/{MAX_COMMENT_LENGTH}
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
