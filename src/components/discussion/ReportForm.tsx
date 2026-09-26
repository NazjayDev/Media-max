"use client";

import { useState } from "react";
import type { ReportReason } from "@/lib/commentRules";

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

export default function ReportForm({
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
        <legend className="mb-2 font-semibold">Why are you reporting this?</legend>
        <div className="flex flex-col gap-1.5">
          {REPORT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-start gap-2">
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
