import { NextRequest, NextResponse } from "next/server";
import { create } from "@metaplex-foundation/mpl-core";
import { generateSigner, publicKey, sol } from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { auth } from "@/auth";
import {
  MIN_TITLES_FOR_PASSPORT,
  attributesFor,
  computeTaste,
  passportsCollection,
} from "@/lib/passport";
import { allowRequest } from "@/lib/rateLimit";
import { PUBLIC_BASE_URL, explorerTxUrl, explorerUrl, getUmi, solanaConfigured } from "@/lib/solana";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!solanaConfigured()) {
    return NextResponse.json({ error: "Minting is not configured" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { wallet?: unknown } | null;
  let owner;
  try {
    owner = publicKey(String(body?.wallet ?? ""));
  } catch {
    return NextResponse.json({ error: "That doesn't look like a Solana address" }, { status: 400 });
  }

  if (!(await allowRequest("passport", userId, 5, 3600))) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const [stats, passports] = await Promise.all([computeTaste(userId), passportsCollection()]);
  if (!stats || !passports) {
    return NextResponse.json({ error: "Passport is unavailable" }, { status: 503 });
  }
  if (stats.saved < MIN_TITLES_FOR_PASSPORT) {
    return NextResponse.json(
      { error: `Save at least ${MIN_TITLES_FOR_PASSPORT} titles to mint your passport` },
      { status: 400 }
    );
  }
  if (await passports.findOne({ userId })) {
    return NextResponse.json({ error: "You already have a passport. Update it instead." }, { status: 409 });
  }

  const umi = getUmi();
  const balance = await umi.rpc.getBalance(umi.identity.publicKey);
  if (balance.basisPoints < sol(0.01).basisPoints) {
    return NextResponse.json({ error: "Minting is temporarily unavailable" }, { status: 503 });
  }

  const asset = generateSigner(umi);
  const address = asset.publicKey.toString();
  const now = new Date();

  // Metadata must be readable before the asset exists on-chain, so store the snapshot first.
  await passports.insertOne({
    _id: address,
    userId,
    wallet: owner.toString(),
    snapshot: stats,
    createdAt: now,
    updatedAt: now,
  });

  try {
    const result = await create(umi, {
      asset,
      name: "Media Max Taste Passport",
      uri: `${PUBLIC_BASE_URL}/api/passport/${address}/metadata`,
      owner,
      plugins: [{ type: "Attributes", attributeList: attributesFor(stats) }],
    }).sendAndConfirm(umi);

    const signature = base58.deserialize(result.signature)[0];
    await passports.updateOne({ _id: address }, { $set: { signature } });

    return NextResponse.json({
      asset: address,
      explorerUrl: explorerUrl(address),
      txUrl: explorerTxUrl(signature),
    });
  } catch (error) {
    await passports.deleteOne({ _id: address }).catch(() => undefined);
    console.error("Passport mint failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Couldn't mint the passport. Try again." }, { status: 502 });
  }
}
