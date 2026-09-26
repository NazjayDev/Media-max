import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCommunity } from "@/lib/community";

export const maxDuration = 30;

export async function GET() {
  const showcase = !!(await auth())?.user?.demo;
  try {
    // Demo accounts see extra sample discussions, so this must not be cached and shared.
    return NextResponse.json(await getCommunity(showcase), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Community failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ titles: [], includesSample: false, generatedAt: "" });
  }
}
