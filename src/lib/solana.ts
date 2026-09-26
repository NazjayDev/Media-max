import { mplCore } from "@metaplex-foundation/mpl-core";
import { keypairIdentity } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

export const solanaConfigured = () => !!process.env.SOLANA_PAYER_SECRET;

export const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "https://www.mediamax.select").replace(/\/$/, "");

export const explorerUrl = (address: string) =>
  `https://explorer.solana.com/address/${address}?cluster=devnet`;

export const explorerTxUrl = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

/** Umi client on Solana devnet, signing as the app's throwaway payer wallet. */
export function getUmi() {
  const umi = createUmi(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com").use(mplCore());
  const secret = new Uint8Array(Buffer.from(process.env.SOLANA_PAYER_SECRET!, "base64"));
  return umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(secret)));
}
