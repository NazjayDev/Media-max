import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getTiger } from "@/lib/tiger";

export const maxDuration = 30;

async function ok(check: () => Promise<unknown>): Promise<boolean> {
  try {
    await check();
    return true;
  } catch {
    return false;
  }
}

/** Reports which integrations are working, as booleans only. Never returns keys or error text. */
export async function GET() {
  const tiger = getTiger();
  const [mongo, timescale] = await Promise.all([
    ok(async () => {
      const db = await getDb();
      if (!db) throw new Error("no db");
      await db.command({ ping: 1 });
    }),
    ok(async () => {
      if (!tiger) throw new Error("not configured");
      await tiger.query("SELECT 1");
    }),
  ]);

  return NextResponse.json(
    {
      mongodb: mongo,
      tigerData: timescale,
      gemini: !!process.env.GEMINI_API_KEY,
      elevenLabs: !!process.env.ELEVENLABS_API_KEY,
      tmdb: !!process.env.TMDB_API_READ_ACCESS_TOKEN,
      googleSignIn: !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET,
      demoAccountConfigured: !!process.env.DEMO_ACCOUNT_EMAILS?.trim(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
