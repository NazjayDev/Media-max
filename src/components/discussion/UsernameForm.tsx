"use client";

import { useState } from "react";

interface UsernameFormProps {
  initial: string;
  intro?: string;
  submitLabel: string;
  onSaved: (username: string) => void;
  onCancel?: () => void;
}

export default function UsernameForm({
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
    <form onSubmit={save} className="rounded-xl border border-border bg-surface px-5 py-4 text-sm">
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
      <p className="mt-2 text-[11px] text-muted">3-20 letters, numbers, _ or -. Unique to you.</p>
      {error && (
        <p role="alert" className="mt-2 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
