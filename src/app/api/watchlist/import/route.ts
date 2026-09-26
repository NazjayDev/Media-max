import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api";
import { importLetterboxd, parseLetterboxdCsv } from "@/lib/letterboxd";
import { allowRequest } from "@/lib/rateLimit";

export const maxDuration = 60;

const MAX_CSV_CHARS = 400_000;

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;

  const body = (await request.json().catch(() => null)) as { csv?: unknown } | null;
  if (typeof body?.csv !== "string" || body.csv.length > MAX_CSV_CHARS) {
    return jsonError("Choose a Letterboxd CSV file under 400 KB", 400);
  }
  const rows = parseLetterboxdCsv(body.csv);
  if (!rows || rows.length === 0) {
    return jsonError(
      "That doesn't look like a Letterboxd export (ratings.csv or watched.csv)",
      400,
    );
  }

  if (!(await allowRequest("import", guard.userId, 10, 3600))) {
    return jsonError("Too many imports. Try again later.", 429);
  }

  try {
    return NextResponse.json(await importLetterboxd(guard.userId, rows));
  } catch (error) {
    console.error("Letterboxd import failed:", error instanceof Error ? error.message : error);
    return jsonError("Couldn't import right now. Try again in a moment.", 502);
  }
}
