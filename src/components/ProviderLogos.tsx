import Image from "next/image";
import { watchUrl } from "@/lib/watchLinks";
import type { MediaType, StreamingProvider } from "@/types/media";

interface ProviderLogosProps {
  providers: StreamingProvider[];
  /** Title being shown: its name searches the platform, its id opens the "where to watch" page. */
  title: { title: string; mediaType: MediaType; id: number };
  /** Logo size in pixels. */
  size?: number;
  max?: number;
  className?: string;
}

/** Streaming service icons that open the platform on this title in a new tab. */
export default function ProviderLogos({
  providers,
  title,
  size = 28,
  max,
  className = "flex flex-wrap items-center gap-2",
}: ProviderLogosProps) {
  const shown = max ? providers.slice(0, max) : providers;

  return (
    <div className={className}>
      {shown.map((provider) => (
        <a
          key={provider.id}
          href={watchUrl(provider, title)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Watch ${title.title} on ${provider.name} (opens in a new tab)`}
          title={`Watch on ${provider.name}`}
          className="rounded-md outline-offset-2 transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:-translate-y-0.5"
        >
          {provider.logoPath ? (
            <Image
              src={provider.logoPath}
              alt=""
              width={size}
              height={size}
              className="rounded-md ring-1 ring-border transition hover:ring-2 hover:ring-accent-to"
            />
          ) : (
            <span className="block rounded-md bg-white/[.08] px-2 py-1 text-xs text-muted hover:text-foreground">
              {provider.name}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}
