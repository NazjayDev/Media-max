import { getTiger } from "@/lib/tiger";
import type { MediaType } from "@/types/media";

export type EventKind = "search" | "vibe" | "save";

export interface ActivityEvent {
  kind: EventKind;
  mediaType?: MediaType;
  tmdbId?: number;
  title?: string;
  query?: string;
}

const normalize = (query: string) => query.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);

/**
 * Records an anonymous activity event in the Tiger Data hypertable.
 * No user ids or IP addresses are stored. Never throws, so it can't break a request.
 */
export async function logEvent(event: ActivityEvent): Promise<void> {
  const pool = getTiger();
  if (!pool) return;

  try {
    await pool.query(
      `INSERT INTO events (kind, media_type, tmdb_id, title, query)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event.kind,
        event.mediaType ?? null,
        event.tmdbId ?? null,
        event.title?.slice(0, 200) ?? null,
        event.query ? normalize(event.query) : null,
      ]
    );
  } catch (error) {
    console.error("Event logging failed:", error instanceof Error ? error.message : error);
  }
}
