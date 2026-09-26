"use client";

import Image from "next/image";
import Link from "next/link";
import { useWatchlist } from "@/components/Providers";
import type { WatchlistEntry } from "@/types/media";

export default function ContinueWatching({ entry }: { entry: WatchlistEntry }) {
  const { setStatus } = useWatchlist();
  return (
    <section
      className="mt-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-accent-from/10 to-accent-to/10"
      aria-labelledby="continue-heading"
    >
      <div className="flex gap-4 p-4 sm:gap-6 sm:p-5">
        <Link
          href={`/title/${entry.mediaType}/${entry.id}`}
          className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800 sm:w-32"
        >
          {entry.posterPath && (
            <Image
              src={entry.posterPath}
              alt={entry.title}
              fill
              sizes="128px"
              className="object-cover"
            />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-from dark:text-violet-300">
            Continue watching
          </p>
          <h2 id="continue-heading" className="mt-1 text-xl font-extrabold sm:text-2xl">
            <Link href={`/title/${entry.mediaType}/${entry.id}`} className="hover:underline">
              {entry.title}
            </Link>
          </h2>
          <p className="mt-2 line-clamp-3 text-sm text-muted">{entry.blurb || entry.synopsis}</p>
          {entry.streamingProviders.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.streamingProviders
                .slice(0, 5)
                .map((p) =>
                  p.logoPath ? (
                    <Image
                      key={p.id}
                      src={p.logoPath}
                      alt={p.name}
                      title={p.name}
                      width={28}
                      height={28}
                      className="rounded-md ring-1 ring-border"
                    />
                  ) : null,
                )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatus(entry, "watched")}
              className="rounded-full bg-gradient-to-r from-accent-from to-accent-to px-4 py-2 text-sm font-semibold text-white"
            >
              Mark as watched
            </button>
            <Link
              href={`/title/${entry.mediaType}/${entry.id}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-accent-from"
            >
              Join the discussion
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
