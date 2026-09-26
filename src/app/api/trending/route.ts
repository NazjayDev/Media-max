import { NextResponse } from "next/server";
import { getTrending } from "@/lib/trending";

export async function GET() {
  const data = await getTrending();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
