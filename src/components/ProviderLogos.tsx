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
  /** Words shown before the icons so it's clear they can be tapped. Empty to hide. */
  label?: string;
  className?: string;
}

/** Small arrow badge in the corner of each icon, the usual sign of a link that opens elsewhere. */
function LinkBadge() {
  return (
    <span
      aria-hidden
      className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent-to text-[var(--on-accent)] ring-2 ring-surface"
    >
      <svg
        viewBox="0 0 12 12"
        className="h-2 w-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** Streaming service icons that open the platform on this title in a new tab. */
export default function ProviderLogos({
  providers,
  title,
  size = 28,
  max,
  label = "Watch on",
  className = "flex flex-wrap items-center gap-x-2.5 gap-y-2",
}: ProviderLogosProps) {
  const shown = max ? providers.slice(0, max) : providers;

  return (
    <div className={className}>
      {label && <span className="mr-0.5 text-[11px] font-bold text-muted">{label}</span>}
      {shown.map((provider) => (
        <a
          key={provider.id}
          href={watchUrl(provider, title)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Watch ${title.title} on ${provider.name} (opens in a new tab)`}
          title={`Watch on ${provider.name}`}
          className="group relative rounded-md outline-offset-2 transition hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
        >
          {provider.logoPath ? (
            <Image
              src={provider.logoPath}
              alt=""
              width={size}
              height={size}
              className="rounded-md ring-1 ring-border transition group-hover:ring-2 group-hover:ring-accent-to"
            />
          ) : (
            <span className="block rounded-md bg-white/[.08] px-2 py-1 text-xs text-muted group-hover:text-foreground">
              {provider.name}
            </span>
          )}
          {provider.logoPath && <LinkBadge />}
        </a>
      ))}
    </div>
  );
}
