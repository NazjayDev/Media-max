"use client";

import { useWatchlist } from "@/components/Providers";
import type { Recommendation } from "@/types/media";

export default function SaveButton({ item }: { item: Recommendation }) {
  const { isSaved, toggle } = useWatchlist();
  const saved = isSaved(item);

  return (
    <button
      type="button"
      onClick={() => toggle(item)}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${item.title} from watchlist` : `Save ${item.title} to watchlist`}
      title={saved ? "Remove from watchlist" : "Save to watchlist"}
      className={`absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur transition active:scale-90 ${
        saved
          ? "bg-gradient-to-r from-accent-from to-accent-to text-white"
          : "bg-black/60 text-white hover:bg-black/80"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}
