import Image from "next/image";
import Link from "next/link";
import ProviderLogos from "@/components/ProviderLogos";
import SaveButton from "@/components/SaveButton";
import RatingChips from "@/components/RatingChips";
import type { Recommendation } from "@/types/media";

interface RecommendationCardProps {
  item: Recommendation;
  index: number;
  footer?: React.ReactNode;
  /** When given, the card shows an "Already watched" button that calls this. */
  onSeen?: (item: Recommendation) => void;
}

export default function RecommendationCard({
  item,
  index,
  footer,
  onSeen,
}: RecommendationCardProps) {
  return (
    <article
      className="animate-fade-up group flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:border-accent-to/60 hover:shadow-xl hover:shadow-accent-to/10"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="bg-[#060403]">
        <span aria-hidden className="film-edge" />
        <div className="relative mx-1.5 aspect-[2/3] overflow-hidden rounded-[2px] bg-zinc-800">
          <SaveButton item={item} />
          <RatingChips ratings={item.ratings} />
          <Link
            href={`/title/${item.mediaType}/${item.id}`}
            aria-label={`Open ${item.title} and join the discussion`}
            className="absolute inset-0 block"
          >
            {item.posterPath ? (
              <Image
                src={item.posterPath}
                alt={item.title}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-muted">
                No poster available
              </div>
            )}
          </Link>
        </div>
        <span aria-hidden className="film-edge" />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <h3 className="text-sm font-semibold leading-snug sm:text-base">
          <Link href={`/title/${item.mediaType}/${item.id}`} className="hover:underline">
            {item.title}
          </Link>
          {item.year ? (
            <span className="ml-1.5 text-xs font-normal text-muted">{item.year}</span>
          ) : null}
        </h3>
        {item.why && (
          <p className="text-xs font-medium leading-5 text-accent-from sm:text-sm">{item.why}</p>
        )}
        <p
          className={`text-xs leading-5 text-muted sm:text-sm sm:leading-6 ${
            item.why ? "line-clamp-2" : "line-clamp-3"
          }`}
        >
          {item.blurb || item.synopsis || "No synopsis available."}
        </p>

        <div className="mt-auto pt-3">
          {item.streamingProviders.length > 0 ? (
            <ProviderLogos providers={item.streamingProviders} title={item} />
          ) : (
            <p className="text-xs text-muted">Not currently available to stream</p>
          )}
        </div>
        {onSeen && (
          <button
            type="button"
            onClick={() => onSeen(item)}
            className="mt-2 flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-xs font-bold transition hover:border-accent-to hover:text-accent-from"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden
            >
              <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Already watched
          </button>
        )}
        <Link
          href={`/title/${item.mediaType}/${item.id}`}
          className="mt-2 text-xs text-muted transition hover:text-foreground"
        >
          Discuss this title
        </Link>
        {footer}
      </div>
    </article>
  );
}
