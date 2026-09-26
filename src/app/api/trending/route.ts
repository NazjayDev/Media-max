import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTrending } from "@/lib/trending";

export const maxDuration = 30;

export async function GET() {
  const showcase = !!(await auth())?.user?.demo;
  const data = await getTrending(showcase);
  // Demo accounts see different data than everyone else, so this must not sit in a shared cache.
  return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=30" } });
}
