import { cached } from "@/lib/cache";
import { commentsCollection, visibleComments } from "@/lib/comments";
import { ensureDemoDiscussions } from "@/lib/demoDiscussions";
import { parseMedia } from "@/lib/media";
import { usernamesFor } from "@/lib/profile";
import { getTitleCard } from "@/lib/tmdb";
import type { MediaType } from "@/types/media";

export interface HotDiscussion {
  mediaType: MediaType;
  id: number;
  title: string;
  posterPath: string | null;
  /** Posts (comments and replies) in the last 7 days. */
  posts: number;
  postsToday: number;
  likes: number;
  people: number;
  /** Posts compared with the average title that has a discussion, for example 2.4 for 2.4 times. */
  timesAverage: number;
  /** Share of the busiest title's posts, 0-1, for drawing a comparison bar. */
  vsLeader: number;
  rising: boolean;
  top: { author: string; text: string; likes: number; spoiler: boolean } | null;
}

export interface Community {
  titles: HotDiscussion[];
  includesSample: boolean;
  generatedAt: string;
}

const WINDOW_HOURS = 7 * 24;
const HALF_LIFE_HOURS = 48;
const LIKE_WEIGHT = 0.6;
const PEOPLE_WEIGHT = 0.75;
const LIMIT = 10;
const HOUR = 3_600_000;

interface Row {
  mediaKey: string;
  parentId: unknown;
  userId: string;
  createdAt: Date;
  likeCount?: number;
  body: string;
  spoiler?: boolean;
  sampleAuthor?: string;
}

/**
 * Ranks titles by how hot their discussion is. Each post counts once, plus a bonus per like, and
 * counts for less as it ages (it halves every 48 hours). Distinct people add a little, so a
 * conversation between many beats one person posting repeatedly.
 */
async function compute(includeSample: boolean): Promise<Community> {
  const collection = await commentsCollection();
  if (!collection) return { titles: [], includesSample: false, generatedAt: "" };
  if (includeSample) await ensureDemoDiscussions();

  const now = Date.now();
  const rows = (await collection
    .find(
      {
        createdAt: { $gte: new Date(now - WINDOW_HOURS * HOUR) },
        ...visibleComments(includeSample),
      },
      {
        projection: {
          mediaKey: 1,
          parentId: 1,
          userId: 1,
          createdAt: 1,
          likeCount: 1,
          body: 1,
          spoiler: 1,
          sampleAuthor: 1,
        },
      },
    )
    .limit(4000)
    .toArray()) as Row[];

  const byTitle = new Map<string, Row[]>();
  for (const row of rows) byTitle.set(row.mediaKey, [...(byTitle.get(row.mediaKey) ?? []), row]);

  const scored = [...byTitle.entries()].map(([key, list]) => {
    let heat = 0;
    let likes = 0;
    let postsToday = 0;
    let yesterday = 0;
    for (const c of list) {
      const ageHours = (now - c.createdAt.getTime()) / HOUR;
      const l = c.likeCount ?? 0;
      likes += l;
      heat += (1 + LIKE_WEIGHT * l) * Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
      if (ageHours < 24) postsToday++;
      else if (ageHours < 48) yesterday++;
    }
    const people = new Set(list.map((c) => c.userId)).size;
    return {
      key,
      list,
      posts: list.length,
      likes,
      postsToday,
      people,
      heat: heat + PEOPLE_WEIGHT * people,
      rising: postsToday >= 4 && postsToday > yesterday * 2,
    };
  });

  scored.sort((a, b) => b.heat - a.heat);
  const top = scored.slice(0, LIMIT);
  const totalPosts = scored.reduce((sum, t) => sum + t.posts, 0);
  const average = scored.length > 0 ? totalPosts / scored.length : 0;
  const leader = Math.max(...top.map((t) => t.posts), 1);

  // The most-liked top-level comment (newest wins ties) is the one shown under each title.
  const topComments = top.map((t) => {
    const best = t.list
      .filter((c) => !c.parentId)
      .sort(
        (a, b) =>
          (b.likeCount ?? 0) - (a.likeCount ?? 0) || b.createdAt.getTime() - a.createdAt.getTime(),
      )[0];
    return best ?? null;
  });
  const names = await usernamesFor(topComments.flatMap((c) => (c ? [c.userId] : [])));

  const cards = await Promise.all(
    top.map((t) => {
      const [mediaType, id] = t.key.split(":");
      const media = parseMedia(mediaType, id);
      return media ? getTitleCard(media.mediaType, media.id) : null;
    }),
  );

  const titles = top.flatMap((t, i): HotDiscussion[] => {
    const card = cards[i];
    const best = topComments[i];
    if (!card) return [];
    return [
      {
        mediaType: card.mediaType,
        id: card.id,
        title: card.title,
        posterPath: card.posterPath,
        posts: t.posts,
        postsToday: t.postsToday,
        likes: t.likes,
        people: t.people,
        timesAverage: average > 0 ? Math.round((t.posts / average) * 10) / 10 : 1,
        vsLeader: t.posts / leader,
        rising: t.rising,
        top: best
          ? {
              author: best.sampleAuthor ?? names.get(best.userId) ?? "Anonymous",
              text: best.body.length > 180 ? `${best.body.slice(0, 177).trimEnd()}...` : best.body,
              likes: best.likeCount ?? 0,
              spoiler: !!best.spoiler,
            }
          : null,
      },
    ];
  });

  return {
    titles,
    includesSample: includeSample && rows.some((r) => r.sampleAuthor),
    generatedAt: new Date().toISOString(),
  };
}

/** Hottest discussions right now. Demo accounts also see sample discussions; everyone else sees real ones. */
export async function getCommunity(includeSample = false): Promise<Community> {
  return cached(`community:v1:${includeSample ? "demo" : "public"}`, 30, () =>
    compute(includeSample),
  );
}
