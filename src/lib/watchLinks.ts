import type { MediaType, StreamingProvider } from "@/types/media";

/**
 * Platforms whose own search page opens on the title. Checked by hand: Hulu redirects search to a
 * browse page, and Disney+ and Peacock have no working search address, so those use the fallback.
 */
const PLATFORM_SEARCH: { match: RegExp; url: (q: string) => string }[] = [
  { match: /netflix/i, url: (q) => `https://www.netflix.com/search?q=${q}` },
  { match: /prime video|amazon/i, url: (q) => `https://www.amazon.com/s?k=${q}&i=instant-video` },
  { match: /apple tv/i, url: (q) => `https://tv.apple.com/search?term=${q}` },
  { match: /crunchyroll/i, url: (q) => `https://www.crunchyroll.com/search?q=${q}` },
  { match: /tubi/i, url: (q) => `https://tubitv.com/search/${q}` },
  { match: /paramount/i, url: (q) => `https://www.paramountplus.com/search/?q=${q}` },
  { match: /\bmax\b|hbo/i, url: (q) => `https://www.hbomax.com/search?q=${q}` },
];

/**
 * Where an icon should take you: the platform's own search for this title when we know how to build
 * one, otherwise TMDB's "where to watch" page for this exact title, which links out to every service.
 */
export function watchUrl(
  provider: StreamingProvider,
  title: { title: string; mediaType: MediaType; id: number },
): string {
  const platform = PLATFORM_SEARCH.find((p) => p.match.test(provider.name));
  if (platform) return platform.url(encodeURIComponent(title.title));
  return `https://www.themoviedb.org/${title.mediaType}/${title.id}/watch`;
}
