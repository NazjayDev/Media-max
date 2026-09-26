import type { WatchlistEntry } from "@/types/media";

/** Ratings at or above this appear in "Your top rated". */
const TOP_RATED_MIN = 4;

const time = (iso?: string) => new Date(iso ?? 0).getTime();
const byRecent = (a: WatchlistEntry, b: WatchlistEntry) =>
  time(b.statusUpdatedAt) - time(a.statusUpdatedAt);

/** Splits a user's saved titles into the dashboard's rows. */
export function groupWatchlist(items: WatchlistEntry[]) {
  return {
    watching: items.filter((i) => i.status === "watching").sort(byRecent),
    want: items
      .filter((i) => i.status === "want")
      .sort((a, b) => time(b.addedAt) - time(a.addedAt)),
    watched: items.filter((i) => i.status === "watched").sort(byRecent),
    favorites: items.filter((i) => i.favorite),
    topRated: items
      .filter((i) => (i.userRating ?? 0) >= TOP_RATED_MIN)
      .sort((a, b) => (b.userRating ?? 0) - (a.userRating ?? 0) || byRecent(a, b)),
  };
}
