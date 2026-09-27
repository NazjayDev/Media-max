// Plain data with no server imports, so pages and components can use it too.

/** Friendly genres mapped onto the different names TMDB uses for movies and for TV. */
export const GENRES: { label: string; names: string[]; tvNames?: string[] }[] = [
  { label: "Action", names: ["Action", "Action & Adventure"] },
  { label: "Adventure", names: ["Adventure", "Action & Adventure"] },
  { label: "Animation", names: ["Animation"] },
  { label: "Comedy", names: ["Comedy"] },
  { label: "Crime", names: ["Crime"] },
  { label: "Drama", names: ["Drama"] },
  { label: "Family", names: ["Family", "Kids"] },
  { label: "Fantasy", names: ["Fantasy", "Sci-Fi & Fantasy"] },
  { label: "Horror", names: ["Horror"] },
  { label: "Mystery", names: ["Mystery"] },
  { label: "Romance", names: ["Romance"] },
  { label: "Sci-Fi", names: ["Science Fiction", "Sci-Fi & Fantasy"] },
  {
    label: "Thriller",
    names: ["Thriller"],
    // TMDB has no "Thriller" genre for TV at all (it's movie-only there), so on TV this reaches
    // for the closest real tags instead of coming back empty.
    tvNames: ["Mystery", "Crime"],
  },
  { label: "War & history", names: ["War", "War & Politics", "History"] },
  { label: "Western", names: ["Western"] },
];
