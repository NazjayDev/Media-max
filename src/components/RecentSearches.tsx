"use client";

import Image from "next/image";
import { useRecentSearches, type Recent } from "@/lib/recentSearches";

interface RecentSearchesProps {
  onTitle: (title: Extract<Recent, { kind: "title" }>) => void;
  onVibe: (text: string) => void;
}

/** The last few searches on this device, one tap to run any of them again. */
export default function RecentSearches({ onTitle, onVibe }: RecentSearchesProps) {
  const { recents, clear } = useRecentSearches();
  if (recents.length === 0) return null;

  return (
    <section aria-label="Recent searches" className="mt-6 w-full max-w-xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold">Recently searched</h2>
        <button type="button" onClick={clear} className="text-xs text-muted hover:text-foreground">
          Clear
        </button>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {recents.map((r) => (
          <li key={r.kind === "title" ? `${r.mediaType}:${r.id}` : `vibe:${r.text}`}>
            <button
              type="button"
              onClick={() => (r.kind === "title" ? onTitle(r) : onVibe(r.text))}
              className="flex max-w-[16rem] items-center gap-2 rounded-md border border-border bg-surface py-1 pl-1 pr-3 text-sm transition hover:border-accent-to"
            >
              {r.kind === "title" && r.posterPath ? (
                <Image
                  src={r.posterPath}
                  alt=""
                  width={24}
                  height={36}
                  className="h-9 w-6 shrink-0 rounded-[2px] object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-9 w-6 shrink-0 items-center justify-center rounded-[2px] bg-accent-to/15 text-accent-from"
                >
                  &ldquo;
                </span>
              )}
              <span className="truncate">{r.kind === "title" ? r.title : r.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
