import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { isMediaType } from "@/lib/media";
import { attachRatings } from "@/lib/ratings";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import {
  MAX_PEOPLE,
  MAX_TITLES_EACH,
  UnrecognisedTitles,
  groupRecommendations,
  type Favorite,
  type Person,
} from "@/lib/together";

export const maxDuration = 60;

/** Accepts free text or an exact { mediaType, id, title } pick; anything else is dropped. */
function parseFavorite(raw: unknown): Favorite | null {
  if (typeof raw === "string") return raw.trim().slice(0, 80) || null;
  const t = raw as { mediaType?: unknown; id?: unknown; title?: unknown } | null;
  if (
    t &&
    isMediaType(t.mediaType) &&
    typeof t.id === "number" &&
    Number.isInteger(t.id) &&
    t.id > 0 &&
    typeof t.title === "string"
  ) {
    return { mediaType: t.mediaType, id: t.id, title: t.title.trim().slice(0, 120) };
  }
  return null;
}

function parsePeople(raw: unknown): Person[] | null {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_PEOPLE) return null;
  const people = raw.map((p, i): Person => {
    const name = typeof p?.name === "string" ? p.name.trim().slice(0, 24) : "";
    const titles = (Array.isArray(p?.titles) ? p.titles : [])
      .map(parseFavorite)
      .filter((t: Favorite | null): t is Favorite => t !== null)
      .slice(0, MAX_TITLES_EACH);
    return { name: name || `Person ${i + 1}`, titles };
  });
  return people.every((p) => p.titles.length > 0) ? people : null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { people?: unknown } | null;
  const people = parsePeople(body?.people);
  if (!people) return jsonError("Add at least one favorite for each of 2-4 people", 400);

  if (!(await allowRequest("together", clientIp(request), 20, 3600))) {
    return jsonError("That's a lot of group nights. Try again in a few minutes.", 429);
  }

  try {
    const result = await groupRecommendations(people);
    const rated = await attachRatings(result.picks);
    return NextResponse.json({ ...result, picks: rated });
  } catch (error) {
    if (error instanceof UnrecognisedTitles) {
      const names = error.unmatched.slice(0, 4).join(", ");
      return jsonError(
        `We couldn't find ${names || "those titles"}. Try the exact movie or show name.`,
        422,
      );
    }
    console.error("Group request failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't blend those tastes. Check the titles and try again.", 502);
  }
}
