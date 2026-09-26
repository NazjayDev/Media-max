import { passportsCollection } from "@/lib/passport";

const escapeXml = (text: string) =>
  text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function GET(_request: Request, ctx: RouteContext<"/api/passport/[asset]/image">) {
  const { asset } = await ctx.params;
  const passports = await passportsCollection();
  const record = passports ? await passports.findOne({ _id: asset }) : null;
  if (!record) {
    return new Response("Not found", { status: 404 });
  }

  const s = record.snapshot;
  const maxGenre = Math.max(...s.topGenres.map((g) => g.count), 1);
  const bars = s.topGenres
    .map((g, i) => {
      const y = 372 + i * 52;
      const width = Math.round((g.count / maxGenre) * 300);
      return `<text x="60" y="${y}" fill="#e9d5ff" font-size="22">${escapeXml(g.name)}</text>
      <rect x="260" y="${y - 20}" width="${Math.max(width, 12)}" height="26" rx="13" fill="url(#bar)"/>`;
    })
    .join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" font-family="Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#4c1d95"/></linearGradient>
    <linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#db2777"/></linearGradient>
  </defs>
  <rect width="600" height="600" rx="36" fill="url(#bg)"/>
  <rect x="24" y="24" width="552" height="552" rx="24" fill="none" stroke="#a78bfa" stroke-opacity="0.4" stroke-width="2"/>
  <text x="60" y="92" fill="#c4b5fd" font-size="20" letter-spacing="4">MEDIA MAX  TASTE PASSPORT</text>
  <text x="60" y="176" fill="#ffffff" font-size="46" font-weight="700">${escapeXml(s.archetype)}</text>
  <text x="60" y="230" fill="#ddd6fe" font-size="22">${s.saved} saved  |  ${s.watched} watched  |  ${s.avgRating === null ? "no ratings yet" : `${s.avgRating}/5 avg`}</text>
  <text x="60" y="318" fill="#a78bfa" font-size="18" letter-spacing="3">TOP GENRES</text>
  ${bars}
  <text x="60" y="552" fill="#a78bfa" font-size="16">Solana devnet  |  mediamax.select</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
