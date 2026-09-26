"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ReelItem } from "@/app/api/reel/route";
import { useJson } from "@/lib/useJson";

export type ReelKind = "movie" | "tv" | "anime" | null;

const PLACEHOLDER_FRAMES = 14;
const MAX_RETRIES = 4;

/** A strip of film scrolling across the page, each frame holding a real poster. */
export default function PosterReel({ kind }: { kind: ReelKind }) {
  // If the poster list fails to arrive (or comes back empty), try again a few times instead of
  // leaving empty frames on the front page for good.
  const [attempt, setAttempt] = useState(0);
  const { data, failed } = useJson<{ results: ReelItem[] }>(
    `/api/reel?kind=${kind ?? "all"}`,
    attempt,
  );
  const items = data?.results ?? [];
  const missing = failed || (data !== null && items.length === 0);
  useEffect(() => {
    if (!missing || attempt >= MAX_RETRIES) return;
    const timer = setTimeout(() => setAttempt((a) => a + 1), 2500 * (attempt + 1));
    return () => clearTimeout(timer);
  }, [missing, attempt]);
  const frames = items.length > 0 ? items : null;
  const count = frames?.length ?? PLACEHOLDER_FRAMES;

  // The set is rendered twice; the track slides by half its width, so the loop has no seam.
  const track = [0, 1].flatMap((copy) =>
    Array.from({ length: count }, (_, i) => ({ copy, i, item: frames?.[i] ?? null })),
  );

  return (
    <div
      className="reel"
      style={{ "--n": count } as React.CSSProperties}
      role="region"
      aria-label="Posters of popular movies, shows and anime"
    >
      <div className="reel-track">
        {track.map(({ copy, i, item }) => (
          <div className="reel-frame" key={`${copy}-${i}`} aria-hidden={copy === 1 || undefined}>
            <span className="reel-number" aria-hidden>
              {i + 1}A
            </span>
            {item ? (
              <Link
                href={`/title/${item.mediaType}/${item.id}`}
                className="reel-poster"
                aria-label={item.title}
                title={item.title}
                tabIndex={copy === 1 ? -1 : undefined}
              >
                <Image
                  src={item.posterPath}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100px, 132px"
                  className="object-cover"
                  // Never lazy: the reel moves by animation alone, and browsers only re-check what is
                  // near the screen when something else happens (like the mouse moving), so lazy
                  // posters could stay blank while the page sat untouched. The first few load first.
                  {...(copy === 0 && i < 6
                    ? { priority: true }
                    : { loading: "eager" as const, fetchPriority: "low" as const })}
                />
              </Link>
            ) : (
              <span className="reel-poster" aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
