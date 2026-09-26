import { WATCH_REGION } from "@/lib/config";
import { mapLimit } from "@/lib/cache";
import { mediaKey } from "@/lib/media";
import { TMDB_IMAGE_BASE_URL, getWatchProviders, tmdbFetch } from "@/lib/tmdb";
import { watchlistCollection } from "@/lib/watchlist";
import type { Recommendation } from "@/types/media";

export const MAX_IMPORT_ROWS = 300;
export const MAX_ITEMS_PER_USER = 500;

export interface LetterboxdRow {
  name: string;
  year: number | null;
  rating: number | null;
  date: Date | null;
}

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, commas and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

/**
 * Reads a Letterboxd export (ratings.csv, watched.csv or diary.csv). Returns null when the file has
 * no "Name" column, so callers can tell the user it isn't a Letterboxd export.
 */
export function parseLetterboxdCsv(text: string): LetterboxdRow[] | null {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) return null;
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const nameIdx = col("name");
  if (nameIdx < 0) return null;
  const yearIdx = col("year");
  const ratingIdx = col("rating");
  const dateIdx = col("watched date") >= 0 ? col("watched date") : col("date");

  const seen = new Map<string, LetterboxdRow>();
  for (const cells of body) {
    const name = cells[nameIdx]?.trim();
    if (!name) continue;
    const year = Number(cells[yearIdx]) || null;
    const rating = Number(cells[ratingIdx]);
    const date = new Date(cells[dateIdx] ?? "");
    seen.set(`${name.toLowerCase()}|${year}`, {
      name,
      year,
      rating: rating >= 0.5 && rating <= 5 && (rating * 2) % 1 === 0 ? rating : null,
      date: Number.isNaN(date.getTime()) ? null : date,
    });
  }
  return [...seen.values()];
}

interface TmdbMovieHit {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
}

async function findMovie(row: LetterboxdRow): Promise<TmdbMovieHit | null> {
  const search = (withYear: boolean) =>
    tmdbFetch<{ results: TmdbMovieHit[] }>("/search/movie", {
      query: row.name,
      include_adult: "false",
      ...(withYear && row.year ? { year: String(row.year) } : {}),
    });
  const hit =
    (await search(true)).results[0] ?? (row.year ? (await search(false)).results[0] : null);
  return hit ?? null;
}

export interface ImportSummary {
  imported: number;
  rated: number;
  unmatched: string[];
  truncated: boolean;
}

/** Resolves rows on TMDB and saves them as watched (with ratings) on the user's dashboard. */
export async function importLetterboxd(
  userId: string,
  allRows: LetterboxdRow[],
): Promise<ImportSummary> {
  const collection = await watchlistCollection();
  if (!collection) throw new Error("Watchlist is unavailable");

  const room = Math.max(0, MAX_ITEMS_PER_USER - (await collection.countDocuments({ userId })));
  const rows = allRows.slice(0, Math.min(MAX_IMPORT_ROWS, room));
  const summary: ImportSummary = {
    imported: 0,
    rated: 0,
    unmatched: [],
    truncated: rows.length < allRows.length,
  };

  await mapLimit(rows, 8, async (row) => {
    try {
      const hit = await findMovie(row);
      if (!hit) return void summary.unmatched.push(row.name);

      const item: Recommendation = {
        id: hit.id,
        mediaType: "movie",
        title: hit.title,
        posterPath: hit.poster_path ? `${TMDB_IMAGE_BASE_URL}/w342${hit.poster_path}` : null,
        synopsis: hit.overview.slice(0, 2000),
        streamingProviders: await getWatchProviders("movie", hit.id, WATCH_REGION),
      };
      const when = row.date ?? new Date();
      await collection.updateOne(
        { userId, key: mediaKey("movie", hit.id) },
        {
          $set: {
            item,
            status: "watched" as const,
            statusUpdatedAt: when,
            ...(row.rating ? { userRating: row.rating } : {}),
          },
          $setOnInsert: {
            addedAt: when,
            favorite: false,
            ...(row.rating ? {} : { userRating: null }),
          },
        },
        { upsert: true },
      );
      summary.imported++;
      if (row.rating) summary.rated++;
    } catch {
      summary.unmatched.push(row.name);
    }
  });
  return summary;
}
