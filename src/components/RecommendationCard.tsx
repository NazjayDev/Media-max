import Image from "next/image";
import SaveButton from "@/components/SaveButton";
import RatingChips from "@/components/RatingChips";
import type { Recommendation } from "@/types/media";

interface RecommendationCardProps {
  item: Recommendation;
  index: number;
  footer?: React.ReactNode;
}

export default function RecommendationCard({ item, index, footer }: RecommendationCardProps) {
  return (
    <article
      className="animate-fade-up group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-accent-from/10"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
        <SaveButton item={item} />
        <RatingChips ratings={item.ratings} />
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
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <h3 className="text-sm font-semibold leading-snug sm:text-base">{item.title}</h3>
        {item.why && (
          <p className="text-xs font-medium leading-5 text-accent-from sm:text-sm dark:text-violet-300">
            {item.why}
          </p>
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
            <div className="flex flex-wrap items-center gap-2">
              {item.streamingProviders.map((provider) =>
                provider.logoPath ? (
                  <Image
                    key={provider.id}
                    src={provider.logoPath}
                    alt={provider.name}
                    title={provider.name}
                    width={28}
                    height={28}
                    className="rounded-md ring-1 ring-border"
                  />
                ) : (
                  <span
                    key={provider.id}
                    className="rounded-md bg-black/[.06] px-2 py-1 text-xs text-muted dark:bg-white/[.08]"
                  >
                    {provider.name}
                  </span>
                )
              )}
            </div>
          ) : (
            <p className="text-xs text-muted">Not currently available to stream</p>
          )}
        </div>
        {footer}
      </div>
    </article>
  );
}
