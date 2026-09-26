import Link from "next/link";
import { GENRES } from "@/lib/genres";

/** A row of genres that open the Browse page filtered to that genre. */
export default function GenreChips() {
  return (
    <section aria-label="Browse by genre" className="mt-10 w-full max-w-3xl">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-extrabold">Browse by genre</h2>
        <Link
          href="/browse"
          className="text-sm font-semibold text-accent-from underline-offset-2 hover:underline"
        >
          Browse everything
        </Link>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {GENRES.map((g) => (
          <li key={g.label}>
            <Link
              href={`/browse?genre=${encodeURIComponent(g.label)}`}
              className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3.5 text-sm font-semibold transition hover:border-accent-to hover:text-accent-from"
            >
              {g.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
