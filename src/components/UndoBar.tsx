"use client";

import { useEffect } from "react";

export interface UndoState {
  title: string;
  run: () => void;
}

/** "Marked X as watched. Undo" bar that dismisses itself after a few seconds. */
export default function UndoBar({
  undo,
  onDismiss,
}: {
  undo: UndoState | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [undo, onDismiss]);

  if (!undo) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-xl shadow-black/50"
    >
      <span className="min-w-0">
        Marked <strong className="break-words">{undo.title}</strong> as watched.
      </span>
      <button
        type="button"
        onClick={() => {
          undo.run();
          onDismiss();
        }}
        className="shrink-0 font-bold text-accent-from hover:underline"
      >
        Undo
      </button>
    </div>
  );
}
