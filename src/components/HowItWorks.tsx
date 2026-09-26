"use client";

import { useRecentSearches } from "@/lib/recentSearches";

const STEPS = [
  {
    title: "Name something you love",
    text: "Search a movie, show or anime, or describe a mood. Type it or say it out loud.",
  },
  {
    title: "Get picks that fit",
    text: "Each one comes with a reason it matches. Hide what you've already watched.",
  },
  {
    title: "Watch in one tap",
    text: "Tap a streaming icon on any pick to open that service on the title.",
  },
];

/** A short explanation for first-time visitors. Anyone who has already searched knows how it works. */
export default function HowItWorks() {
  const { recents } = useRecentSearches();
  if (recents.length > 0) return null;

  return (
    <section aria-labelledby="how-it-works" className="mt-8 w-full max-w-3xl">
      <h2 id="how-it-works" className="text-center text-lg font-extrabold">
        How Media Max works
      </h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-to font-[family-name:var(--font-display)] text-sm font-extrabold text-[var(--on-accent)]"
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{step.title}</span>
              <span className="mt-1 block text-sm leading-5 text-muted">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
