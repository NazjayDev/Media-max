"use client";

import { useMemo } from "react";
import type { WatchlistEntry } from "@/types/media";

export default function StatsStrip({ items }: { items: WatchlistEntry[] }) {
  const stats = useMemo(() => {
    const ratings = items.map((i) => i.userRating).filter((r): r is number => r !== null);
    const genreCounts = new Map<string, number>();
    for (const i of items)
      for (const g of i.genres ?? []) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    return {
      saved: items.length,
      watched: items.filter((i) => i.status === "watched").length,
      avg: ratings.length
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null,
      genres: [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g),
    };
  }, [items]);

  const tiles: { label: string; value: string }[] = [
    { label: "Saved", value: String(stats.saved) },
    { label: "Watched", value: String(stats.watched) },
    {
      label: "Avg rating you give",
      value: stats.avg === null ? "n/a" : `${stats.avg} / 5`,
    },
    {
      label: "Top genres",
      value: stats.genres.length ? stats.genres.join(", ") : "n/a",
    },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted">{t.label}</p>
          <p className="mt-1 truncate text-lg font-bold" title={t.value}>
            {t.value}
          </p>
        </div>
      ))}
    </div>
  );
}
