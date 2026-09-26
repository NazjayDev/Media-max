"use client";

import { useWatchlist } from "@/components/Providers";
import type { WatchStatus, WatchlistEntry } from "@/types/media";

const STATUS_OPTIONS: { value: WatchStatus; label: string }[] = [
  { value: "want", label: "Want" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

interface StarRatingProps {
  value: number;
  onChange: (next: number | null) => void;
  title: string;
}

/** Five stars with half-star steps: the left half of a star sets n - 0.5, the right half sets n. */
function StarRating({ value, onChange, title }: StarRatingProps) {
  return (
    <div role="group" aria-label={`Your rating for ${title}`} className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = value >= n ? 100 : value >= n - 0.5 ? 50 : 0;
        return (
          <span key={n} className="relative inline-block h-5 w-5 text-xl">
            <span aria-hidden className="block w-5 text-center leading-5 text-muted/40">
              ★
            </span>
            <span
              aria-hidden
              className="absolute left-0 top-0 h-5 overflow-hidden text-amber-400"
              style={{ width: `${fill}%` }}
            >
              <span className="block w-5 text-center leading-5">★</span>
            </span>
            <button
              type="button"
              aria-label={`${n - 0.5} stars`}
              aria-pressed={value === n - 0.5}
              onClick={() => onChange(value === n - 0.5 ? null : n - 0.5)}
              className="absolute inset-y-0 left-0 w-1/2"
            />
            <button
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={value === n}
              onClick={() => onChange(value === n ? null : n)}
              className="absolute inset-y-0 right-0 w-1/2"
            />
          </span>
        );
      })}
    </div>
  );
}

export default function WatchControls({ entry }: { entry: WatchlistEntry }) {
  const { setStatus, setRating, setFavorite } = useWatchlist();

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      <div role="group" aria-label={`Status for ${entry.title}`} className="grid grid-cols-3 gap-1">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={entry.status === opt.value}
            onClick={() => setStatus(entry, opt.value)}
            className={`rounded-full px-1 py-1 text-[11px] font-medium transition ${
              entry.status === opt.value
                ? "bg-gradient-to-r from-accent-from to-accent-to text-white"
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        {entry.status === "watched" ? (
          <div className="flex min-w-0 items-center gap-1.5">
            <StarRating
              value={entry.userRating ?? 0}
              onChange={(v) => setRating(entry, v)}
              title={entry.title}
            />
            <span className="whitespace-nowrap text-[10px] text-muted">
              {entry.userRating ?? "Rate"}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted">Favorite</span>
        )}
        <button
          type="button"
          aria-pressed={entry.favorite}
          aria-label={
            entry.favorite
              ? `Remove ${entry.title} from favorites`
              : `Add ${entry.title} to favorites`
          }
          title={entry.favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={() => setFavorite(entry, !entry.favorite)}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-base leading-none transition active:scale-90 ${
            entry.favorite
              ? "border-pink-500 bg-pink-500/15 text-pink-500"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          {entry.favorite ? "♥" : "♡"}
        </button>
      </div>
    </div>
  );
}
