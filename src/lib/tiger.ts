import { Pool } from "pg";

const globalForTiger = globalThis as unknown as { tigerPool?: Pool };

export const tigerConfigured = () => !!process.env.TIGER_DATABASE_URL;

/** Shared connection pool for Tiger Data (TimescaleDB), or null when not configured. */
export function getTiger(): Pool | null {
  const url = process.env.TIGER_DATABASE_URL;
  if (!url) return null;

  globalForTiger.tigerPool ??= new Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 6_000,
  });
  return globalForTiger.tigerPool;
}
