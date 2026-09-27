import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { jsonError } from "@/lib/api";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import { searchUsernames } from "@/lib/profile";

const MAX_QUERY = 20;

/** Finds people by username, so you can look up a friend and open their profile. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, MAX_QUERY) ?? "";
  if (query.length < 2) return NextResponse.json({ results: [] });

  if (!(await allowRequest("user-search", clientIp(request), 60, 600))) {
    return jsonError("Too many searches. Try again in a minute.", 429);
  }

  const viewer = (await auth())?.user?.id;
  try {
    return NextResponse.json({ results: await searchUsernames(query, viewer) });
  } catch (error) {
    console.error("User search failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ results: [] });
  }
}
