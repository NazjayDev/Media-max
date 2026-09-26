import { ObjectId } from "mongodb";
import { commentsCollection, type CommentDoc } from "@/lib/comments";
import { getDb } from "@/lib/mongodb";

interface Reply {
  by: string;
  text: string;
  ago: number;
  likes: number;
}
interface Post extends Reply {
  spoiler?: boolean;
  replies?: Reply[];
}

/** Sample conversations, keyed by title. `ago` is hours before the moment they are seeded. */
const DISCUSSIONS: Record<string, Post[]> = {
  "movie:27205": [
    {
      by: "kai_reels",
      ago: 3,
      likes: 41,
      text: "The hallway fight still holds up better than most modern action. Practical rotation, zero shortcuts.",
      replies: [
        {
          by: "midnight_maya",
          ago: 2,
          likes: 12,
          text: "The actors trained for weeks on that set.",
        },
        { by: "nolan_nerd", ago: 1, likes: 9, text: "And the score sells every second of it." },
      ],
    },
    {
      by: "nolan_nerd",
      ago: 6,
      likes: 33,
      text: "Hot take: the ending question is the least interesting part. The real story is Cobb letting go.",
      replies: [
        {
          by: "popcorn_pete",
          ago: 5,
          likes: 8,
          text: "Agree, but I still watch the top every time.",
        },
      ],
    },
    {
      by: "sunday_sam",
      ago: 9,
      likes: 27,
      text: "Rewatched it tonight on a big screen. That Zimmer track gets me every single time.",
    },
    {
      by: "noir_nina",
      ago: 12,
      likes: 19,
      spoiler: true,
      text: "The cut to black before the top falls is the whole point. He doesn't look back to check.",
      replies: [
        {
          by: "reel_ryan",
          ago: 11,
          likes: 4,
          text: "Wait, it cuts before you see it fall? Never noticed.",
        },
      ],
    },
    {
      by: "reel_ryan",
      ago: 15,
      likes: 15,
      text: "Is this the best heist movie or the best sci-fi movie? I can't decide.",
    },
    {
      by: "popcorn_pete",
      ago: 20,
      likes: 11,
      text: "The architect character never gets enough credit. She's the one who actually explains the rules.",
    },
    {
      by: "kai_reels",
      ago: 22,
      likes: 7,
      text: "Watch it again with subtitles on. I caught three lines I missed for years.",
    },
    {
      by: "midnight_maya",
      ago: 30,
      likes: 5,
      text: "Inception or Interstellar? Pick one and defend it.",
    },
  ],
  "tv:1396": [
    {
      by: "midnight_maya",
      ago: 5,
      likes: 36,
      text: "Season 2's plane crash setup is one of the best long-game payoffs in TV.",
      replies: [
        {
          by: "kai_reels",
          ago: 4,
          likes: 10,
          text: "I was sure the black-and-white teasers were random. They were not.",
        },
      ],
    },
    {
      by: "popcorn_pete",
      ago: 8,
      likes: 24,
      text: "Started it this week. Is it normal to already dislike Walter and still root for him?",
      replies: [
        { by: "noir_nina", ago: 7, likes: 14, text: "That's the whole show. Keep going." },
        { by: "sunday_sam", ago: 6, likes: 6, text: "No spoilers, but it gets stranger." },
      ],
    },
    {
      by: "noir_nina",
      ago: 14,
      likes: 20,
      spoiler: true,
      text: "Hank's arc in the final season is what stayed with me. That garage scene.",
    },
    { by: "reel_ryan", ago: 18, likes: 18, text: "Pilot to finale, no filler. Rare." },
    {
      by: "sunday_sam",
      ago: 26,
      likes: 9,
      text: "Underrated: the cinematography in the desert scenes.",
    },
    { by: "kai_reels", ago: 30, likes: 6, text: "Rank the seasons. I'll start: 4, 5, 2, 3, 1." },
    { by: "nolan_nerd", ago: 34, likes: 13, text: "Gus is the best villain ever written for TV." },
  ],
  "tv:1429": [
    {
      by: "kaijufan88",
      ago: 4,
      likes: 28,
      text: "Season 1 episode 5 changed how I watch anime.",
      replies: [{ by: "reel_ryan", ago: 3, likes: 9, text: "The score in that scene is unreal." }],
    },
    {
      by: "midnight_maya",
      ago: 10,
      likes: 17,
      spoiler: true,
      text: "The reveal about the basement... I refuse to say more.",
    },
    {
      by: "sunday_sam",
      ago: 13,
      likes: 12,
      text: "Is the final season worth it if the middle dragged for you?",
      replies: [
        {
          by: "kaijufan88",
          ago: 12,
          likes: 15,
          text: "Yes, it pays off. Stay for the last three episodes.",
        },
      ],
    },
    { by: "noir_nina", ago: 19, likes: 10, text: "The opening themes alone are worth the watch." },
    { by: "popcorn_pete", ago: 25, likes: 7, text: "Which season has the best animation?" },
    { by: "kai_reels", ago: 31, likes: 4, text: "Dub or sub?" },
  ],
  "tv:95396": [
    {
      by: "noir_nina",
      ago: 7,
      likes: 22,
      text: "The office set design is the main character. Everything is too clean.",
      replies: [
        {
          by: "reel_ryan",
          ago: 6,
          likes: 8,
          text: "The break room scene had me holding my breath.",
        },
      ],
    },
    { by: "nolan_nerd", ago: 16, likes: 16, text: "Best pilot of the last decade." },
    {
      by: "midnight_maya",
      ago: 22,
      likes: 14,
      spoiler: true,
      text: "That season finale sprint through the halls. I had to pause and breathe.",
    },
    { by: "sunday_sam", ago: 28, likes: 8, text: "Slow burn, but I can't stop." },
    { by: "kaijufan88", ago: 36, likes: 6, text: "Adam Scott is doing career-best work." },
  ],
  "movie:693134": [
    {
      by: "popcorn_pete",
      ago: 8,
      likes: 25,
      text: "Sandworm riding in IMAX is the best thing I've seen in a theater.",
      replies: [{ by: "kai_reels", ago: 7, likes: 9, text: "The sound design shook the seats." }],
    },
    {
      by: "reel_ryan",
      ago: 21,
      likes: 9,
      text: "Do I need to watch part one first?",
      replies: [{ by: "nolan_nerd", ago: 20, likes: 5, text: "Yes, and it's worth it." }],
    },
    {
      by: "noir_nina",
      ago: 29,
      likes: 11,
      text: "Villeneuve makes deserts look better than most directors make cities.",
    },
  ],
  "movie:129": [
    {
      by: "sunday_sam",
      ago: 11,
      likes: 30,
      text: "The train scene has no dialogue and says everything.",
      replies: [
        {
          by: "midnight_maya",
          ago: 10,
          likes: 11,
          text: "That quiet stretch is the secret sauce.",
        },
      ],
    },
    { by: "kaijufan88", ago: 26, likes: 14, text: "First Ghibli I ever saw. Still my favorite." },
    {
      by: "kai_reels",
      ago: 33,
      likes: 8,
      text: "The bath house details are absurd. Rewatch and just look at the background.",
    },
  ],
  "movie:157336": [
    {
      by: "nolan_nerd",
      ago: 15,
      likes: 18,
      text: "The docking scene is the best sequence in any space movie.",
      replies: [
        { by: "sunday_sam", ago: 14, likes: 7, text: "The organ music going full volume. Chills." },
      ],
    },
    { by: "popcorn_pete", ago: 27, likes: 10, text: "Cried at the message scene. Twice." },
  ],
};

/** Hours to push a title's whole conversation into the past, so the board mixes busy and quiet titles. */
const AGE_OFFSET: Record<string, number> = {
  "tv:95396": 30,
  "movie:693134": 60,
  "movie:129": 90,
  "movie:157336": 120,
};

const HOUR = 3_600_000;
/** Below this many sample posts in the last two days, the sample discussions count as stale. */
const MIN_FRESH_SAMPLES = 20;

/** Replaces the sample discussions with a fresh set dated relative to now. Demo accounts only. */
export async function seedDemoDiscussions(): Promise<number> {
  const collection = await commentsCollection();
  const db = await getDb();
  if (!collection || !db) throw new Error("Discussion storage is unavailable");

  const now = Date.now();
  const docs: CommentDoc[] = [];
  const base = (
    key: string,
    p: Reply,
    parentId: ObjectId | null,
    spoiler?: boolean,
  ): CommentDoc => ({
    _id: new ObjectId(),
    mediaKey: key,
    parentId,
    userId: `sample:${p.by}`,
    sampleAuthor: p.by,
    sample: true,
    body: p.text,
    createdAt: new Date(now - (p.ago + (AGE_OFFSET[key] ?? 0)) * HOUR),
    spoiler,
    likeCount: p.likes,
    likedBy: [],
  });

  for (const [key, posts] of Object.entries(DISCUSSIONS)) {
    for (const post of posts) {
      const top = base(key, post, null, post.spoiler);
      docs.push(top);
      for (const reply of post.replies ?? []) docs.push(base(key, reply, top._id));
    }
  }

  await collection.deleteMany({ sample: true });
  await collection.insertMany(docs);
  // Drop cached Community snapshots so the new sample activity shows immediately.
  await db.collection<{ _id: string }>("cache").deleteMany({ _id: { $regex: "^community:" } });
  return docs.length;
}

/** Re-seeds the sample discussions when they have aged out of the two-day window. */
export async function ensureDemoDiscussions(): Promise<void> {
  const collection = await commentsCollection();
  if (!collection) return;
  const fresh = await collection.countDocuments({
    sample: true,
    createdAt: { $gte: new Date(Date.now() - 48 * HOUR) },
  });
  if (fresh < MIN_FRESH_SAMPLES) await seedDemoDiscussions();
}
