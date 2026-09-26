/** Hard requirements we can check against facts, extracted from what the user typed. */
export interface Constraints {
  /** Lower-cased substrings to look for in a title's streaming provider names. */
  services: string[];
  /** Longest acceptable length in minutes. */
  maxMinutes?: number;
  /** True when the length limit is per episode ("under 30 minutes an episode"). */
  perEpisode: boolean;
}

const SERVICE_PATTERNS: [RegExp, string][] = [
  [/netflix/i, "netflix"],
  [/\bhulu\b/i, "hulu"],
  [/disney\s*(\+|plus)/i, "disney"],
  [/(prime video|amazon prime|amazon video)/i, "prime video"],
  [/(\bmax\b|\bhbo\b)/i, "max"],
  [/peacock/i, "peacock"],
  [/paramount/i, "paramount"],
  [/apple\s*tv/i, "apple tv"],
  [/crunchyroll/i, "crunchyroll"],
];

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3 };

function parseMaxMinutes(text: string): number | undefined {
  const match = text.match(
    /(?:under|less than|shorter than|below|within|at most|no more than|max(?:imum)? of)\s+(\d+(?:\.\d+)?|an?|one|two|three)\s*(hours?|hrs?|h\b|minutes?|mins?)/i,
  );
  const orLess = text.match(/(\d+)\s*(minutes?|mins?|hours?|hrs?)\s+or\s+(?:less|shorter)/i);
  const found = match ?? orLess;
  if (!found) return undefined;

  const raw = found[1].toLowerCase();
  const amount = NUMBER_WORDS[raw] ?? Number(raw);
  if (!Number.isFinite(amount)) return undefined;
  return Math.round(/^h/i.test(found[2]) ? amount * 60 : amount);
}

export function constraintsFrom(text: string): Constraints {
  return {
    services: SERVICE_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, name]) => name),
    maxMinutes: parseMaxMinutes(text),
    perEpisode: /\b(episode|episodes|per ep|an ep)\b/i.test(text),
  };
}

export interface Facts {
  services: string[];
  minutes: number | null;
}

/** Whether a title meets the hard requirements. Unknown facts don't disqualify a title. */
export function meetsConstraints(
  mediaType: "movie" | "tv",
  facts: Facts | undefined,
  c: Constraints,
): boolean {
  if (c.services.length > 0) {
    const names = (facts?.services ?? []).map((s) => s.toLowerCase());
    if (!c.services.some((wanted) => names.some((n) => n.includes(wanted)))) return false;
  }
  if (c.maxMinutes !== undefined) {
    if (c.perEpisode) {
      if (mediaType === "movie") return false;
      if (facts?.minutes && facts.minutes > c.maxMinutes) return false;
    } else {
      // A whole-title limit like "under two hours" means a movie.
      if (mediaType === "tv") return false;
      if (facts?.minutes && facts.minutes > c.maxMinutes) return false;
    }
  }
  return true;
}
