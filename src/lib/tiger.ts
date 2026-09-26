import { Pool } from "pg";

const globalForTiger = globalThis as unknown as { tigerPool?: Pool };

/**
 * Tiger Cloud serves a certificate from its own CA. libpq's `sslmode=require` semantics
 * (encrypted, CA not verified) are what Tiger's own docs use, so opt into them explicitly.
 */
export function tigerConnectionString(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("sslmode", "require");
  parsed.searchParams.set("uselibpqcompat", "true");
  return parsed.toString();
}

export const tigerConfigured = () => !!process.env.TIGER_DATABASE_URL;

/** Shared connection pool for Tiger Data (TimescaleDB), or null when not configured. */
export function getTiger(): Pool | null {
  const url = process.env.TIGER_DATABASE_URL;
  if (!url) return null;

  globalForTiger.tigerPool ??= new Pool({
    connectionString: tigerConnectionString(url),
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 6_000,
  });
  return globalForTiger.tigerPool;
}
