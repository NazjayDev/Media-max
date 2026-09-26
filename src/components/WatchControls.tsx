"use client";

import { useWatchlist } from "@/components/Providers";
import type { WatchStatus, WatchlistEntry } from "@/types/media";

const STATUS_OPTIONS: { value: WatchStatus; label: string }[] = [
  { value: "want", label: "Want" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

export default function WatchControls({ entry }: { entry: WatchlistEntry }) {
  const { setStatus, setRating } = useWatchlist();

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <div role="group" aria-label={`Status for ${entry.title}`} className="flex gap-1">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={entry.status === opt.value}
            onClick={() => setStatus(entry, opt.value)}
            className={`flex-1 rounded-full px-2 py-1 text-[11px] font-medium transition ${
              entry.status === opt.value
                ? "bg-gradient-to-r from-accent-from to-accent-to text-white"
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {entry.status === "watched" && (
        <div role="group" aria-label={`Your rating for ${entry.title}`} className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={(entry.userRating ?? 0) >= n}
              onClick={() => setRating(entry, entry.userRating === n ? null : n)}
              className={`text-lg leading-none transition hover:scale-110 ${
                (entry.userRating ?? 0) >= n ? "text-amber-400" : "text-muted/40"
              }`}
            >
              ★
            </button>
          ))}
          <span className="ml-1 text-[11px] text-muted">
            {entry.userRating ? `${entry.userRating}/5` : "Rate it"}
          </span>
        </div>
      )}
    </div>
  );
}
