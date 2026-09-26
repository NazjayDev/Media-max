import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import { getDb } from "@/lib/mongodb";
import { TMDB_IMAGE_BASE_URL } from "@/lib/tmdb";
import type { MediaType } from "@/types/media";

const KINDS = ["all", "movie", "tv", "anime"] as const;
type Kind = (typeof KINDS)[number];

const FRAMES = 24;
const POOL = 150;
const REEL_TTL_SECONDS = 6 * 3600;

export interface ReelItem {
  mediaType: MediaType;
  id: number;
  title: string;
  posterPath: string;
}

interface Row {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath: string | null;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Well-known titles with posters, picked at random from the top of the catalog. */
async function pick(filter: Record<string, unknown>, count: number): Promise<ReelItem[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .collection<Row>("titles")
    .find({ ...filter, posterPath: { $ne: null } }, { projection: { embedding: 0 } })
    .sort({ voteCount: -1 })
    .limit(POOL)
    .toArray();
  return shuffle(rows)
    .slice(0, count)
    .map((r) => ({
      mediaType: r.mediaType,
      id: r.tmdbId,
      title: r.title,
      posterPath: `${TMDB_IMAGE_BASE_URL}/w342${r.posterPath}`,
    }));
}

async function build(kind: Kind): Promise<ReelItem[]> {
  if (kind === "anime") return pick({ anime: true }, FRAMES);
  if (kind === "movie") return pick({ mediaType: "movie", anime: false }, FRAMES);
  if (kind === "tv") return pick({ mediaType: "tv", anime: false }, FRAMES);

  // The default reel mixes all three so the strip looks varied.
  const third = FRAMES / 3;
  const [movies, shows, anime] = await Promise.all([
    pick({ mediaType: "movie", anime: false }, third),
    pick({ mediaType: "tv", anime: false }, third),
    pick({ anime: true }, third),
  ]);
  return shuffle([...movies, ...shows, ...anime]);
}

export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("kind") ?? "all";
  const kind = (KINDS as readonly string[]).includes(param) ? (param as Kind) : "all";

  try {
    const results = await cached(`reel1:${kind}`, REEL_TTL_SECONDS, async () => {
      const items = await build(kind);
      if (items.length < 8) throw new Error("Catalog too small for the reel");
      return items;
    });
    return NextResponse.json({ results }, { headers: { "Cache-Control": "public, max-age=1800" } });
  } catch (error) {
    console.error("Reel failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ results: [] });
  }
}
