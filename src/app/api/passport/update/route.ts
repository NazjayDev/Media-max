import { NextResponse } from "next/server";
import { updatePlugin } from "@metaplex-foundation/mpl-core";
import { publicKey } from "@metaplex-foundation/umi";
import { auth } from "@/auth";
import { attributesFor, computeTaste, passportsCollection } from "@/lib/passport";
import { allowRequest } from "@/lib/rateLimit";
import { explorerUrl, getUmi, solanaConfigured } from "@/lib/solana";

export const maxDuration = 60;

export async function POST() {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!solanaConfigured()) {
    return NextResponse.json({ error: "Minting is not configured" }, { status: 503 });
  }
  if (!(await allowRequest("passport", userId, 5, 3600))) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const [stats, passports] = await Promise.all([computeTaste(userId), passportsCollection()]);
  const record = passports ? await passports.findOne({ userId }) : null;
  if (!stats || !passports || !record) {
    return NextResponse.json({ error: "No passport to update" }, { status: 404 });
  }

  try {
    await updatePlugin(getUmi(), {
      asset: publicKey(record._id),
      plugin: { type: "Attributes", attributeList: attributesFor(stats) },
    }).sendAndConfirm(getUmi());

    await passports.updateOne({ _id: record._id }, { $set: { snapshot: stats, updatedAt: new Date() } });
    return NextResponse.json({ asset: record._id, explorerUrl: explorerUrl(record._id) });
  } catch (error) {
    console.error("Passport update failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn't update the passport. Try again." }, { status: 502 });
  }
}
