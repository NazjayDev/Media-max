import { NextResponse } from "next/server";
import { attributesFor, passportsCollection } from "@/lib/passport";
import { PUBLIC_BASE_URL } from "@/lib/solana";

export async function GET(_request: Request, ctx: RouteContext<"/api/passport/[asset]/metadata">) {
  const { asset } = await ctx.params;
  const passports = await passportsCollection();
  const record = passports ? await passports.findOne({ _id: asset }) : null;
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const s = record.snapshot;
  return NextResponse.json(
    {
      name: "Media Max Taste Passport",
      symbol: "MMAX",
      description: `${s.archetype}. A snapshot of a viewer's taste from their Media Max watchlist: ${s.saved} titles saved, ${s.watched} watched.`,
      image: `${PUBLIC_BASE_URL}/api/passport/${asset}/image`,
      external_url: PUBLIC_BASE_URL,
      attributes: attributesFor(s).map((a) => ({ trait_type: a.key, value: a.value })),
      properties: {
        category: "image",
        files: [{ uri: `${PUBLIC_BASE_URL}/api/passport/${asset}/image`, type: "image/svg+xml" }],
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
