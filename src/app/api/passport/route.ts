import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  MIN_TITLES_FOR_PASSPORT,
  computeTaste,
  passportsCollection,
} from "@/lib/passport";
import { explorerTxUrl, explorerUrl, solanaConfigured } from "@/lib/solana";

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const [stats, passports] = await Promise.all([computeTaste(userId), passportsCollection()]);
  if (!stats || !passports) {
    return NextResponse.json({ error: "Passport is unavailable" }, { status: 503 });
  }

  const record = await passports.findOne({ userId });
  return NextResponse.json({
    enabled: solanaConfigured(),
    stats,
    minTitles: MIN_TITLES_FOR_PASSPORT,
    passport: record
      ? {
          asset: record._id,
          wallet: record.wallet,
          snapshot: record.snapshot,
          explorerUrl: explorerUrl(record._id),
          txUrl: record.signature ? explorerTxUrl(record.signature) : null,
          imageUrl: `/api/passport/${record._id}/image`,
          updatedAt: record.updatedAt,
        }
      : null,
  });
}
