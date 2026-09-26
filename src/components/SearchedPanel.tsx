import Image from "next/image";
import Link from "next/link";
import type { SearchResult } from "@/types/media";

/**
 * Shows what the recommendations are based on: the poster and name of the title that was searched,
 * or the vibe that was described, so it's clear at a glance that the right thing was understood.
 */
export default function SearchedPanel({
  matched,
  vibe,
}: {
  matched: SearchResult | null;
  vibe: string;
}) {
  return (
    <div className="animate-fade-up mx-auto mb-8 flex w-full max-w-xl items-center gap-4 rounded-lg border border-border bg-surface p-3">
      {matched ? (
        <>
          <Link
            href={`/title/${matched.mediaType}/${matched.id}`}
            aria-label={`Open ${matched.title}`}
            className="bg-[#060403] py-1"
          >
            <span className="film-edge block" aria-hidden />
            <span className="relative mx-1 block h-28 w-[4.75rem] overflow-hidden rounded-[2px] bg-zinc-800">
              {matched.posterPath && (
                <Image src={matched.posterPath} alt="" fill sizes="76px" className="object-cover" />
              )}
            </span>
            <span className="film-edge block" aria-hidden />
          </Link>
          <div className="min-w-0">
            <p className="text-sm text-muted">Recommendations based on</p>
            <p className="mt-0.5 break-words font-[family-name:var(--font-display)] text-xl font-extrabold leading-tight">
              {matched.title}
            </p>
            <p className="mt-1 text-sm text-muted">
              {matched.mediaType === "tv" ? "TV" : "Movie"}
              {matched.year ? ` · ${matched.year}` : ""}
            </p>
          </div>
        </>
      ) : (
        <>
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-accent-to/15 font-[family-name:var(--font-display)] text-4xl font-extrabold text-accent-from"
          >
            &ldquo;
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted">Recommendations for the vibe</p>
            <p className="mt-0.5 break-words font-[family-name:var(--font-display)] text-lg font-extrabold leading-tight">
              {vibe}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
