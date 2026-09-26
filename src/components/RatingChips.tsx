import type { Ratings } from "@/types/media";

export default function RatingChips({ ratings }: { ratings?: Ratings }) {
  if (!ratings) return null;

  const chips: { label: string; value: string }[] = [];
  if (ratings.imdb) chips.push({ label: "IMDb", value: ratings.imdb });
  if (ratings.rottenTomatoes) chips.push({ label: "RT", value: ratings.rottenTomatoes });
  if (ratings.metacritic) chips.push({ label: "MC", value: ratings.metacritic });
  if (chips.length === 0 && ratings.tmdb) {
    chips.push({ label: "TMDB", value: ratings.tmdb.toFixed(1) });
  }
  if (chips.length === 0) return null;

  return (
    <div className="absolute bottom-2 left-2 z-10 flex flex-wrap gap-1">
      {chips.map((chip) => (
        <span
          key={chip.label}
          title={`${chip.label} rating`}
          className="rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur"
        >
          <span className="text-amber-300">★</span> {chip.value}{" "}
          <span className="font-normal text-white/60">{chip.label}</span>
        </span>
      ))}
    </div>
  );
}
