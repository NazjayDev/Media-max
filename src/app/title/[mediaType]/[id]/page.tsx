"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import Discussion from "@/components/discussion/Discussion";
import RatingChips from "@/components/RatingChips";
import SaveButton from "@/components/SaveButton";
import { useJson } from "@/lib/useJson";
import type { MediaType, Recommendation } from "@/types/media";

export default function TitlePage() {
  const params = useParams<{ mediaType: string; id: string }>();
  const valid =
    (params.mediaType === "movie" || params.mediaType === "tv") && /^\d+$/.test(params.id);
  const mediaType = params.mediaType as MediaType;
  const id = Number(params.id);

  const { data: item, failed } = useJson<Recommendation>(
    valid ? `/api/title?mediaType=${mediaType}&id=${id}` : null,
  );

  if (!valid || failed) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-28 text-center">
        <p className="text-muted">We couldn&apos;t find that title.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-full border border-border px-6 py-2.5 font-medium hover:border-accent-from"
        >
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-24 sm:px-8">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        &larr; Back to search
      </Link>

      {!item ? (
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      ) : (
        <article className="mt-6 flex flex-col gap-6 sm:flex-row">
          <div className="relative aspect-[2/3] w-full max-w-[220px] shrink-0 self-center overflow-hidden rounded-2xl border border-border bg-zinc-200 dark:bg-zinc-800 sm:self-start">
            {item.posterPath ? (
              <Image
                src={item.posterPath}
                alt={item.title}
                fill
                sizes="220px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
                No poster available
              </div>
            )}
            <SaveButton item={item} />
            <RatingChips ratings={item.ratings} />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight">{item.title}</h1>
            <p className="mt-1 text-sm text-muted">{mediaType === "tv" ? "TV series" : "Movie"}</p>
            <p className="mt-4 text-sm leading-6 text-muted">
              {item.synopsis || "No synopsis available."}
            </p>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Where to stream
              </p>
              {item.streamingProviders.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {item.streamingProviders.map((p) =>
                    p.logoPath ? (
                      <Image
                        key={p.id}
                        src={p.logoPath}
                        alt={p.name}
                        title={p.name}
                        width={36}
                        height={36}
                        className="rounded-lg ring-1 ring-border"
                      />
                    ) : (
                      <span
                        key={p.id}
                        className="rounded-md bg-black/[.06] px-2 py-1 text-xs dark:bg-white/[.08]"
                      >
                        {p.name}
                      </span>
                    ),
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted">Not currently available to stream</p>
              )}
            </div>
          </div>
        </article>
      )}

      <Discussion mediaType={mediaType} id={id} />
    </div>
  );
}
