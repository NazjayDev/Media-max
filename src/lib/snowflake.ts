// Minimal Snowflake SQL API client using key-pair (JWT) authentication.
// Self-contained on purpose so scripts can import it directly with Node's TypeScript support.
import { createHash, createPrivateKey, createPublicKey, createSign } from "node:crypto";

const DATABASE = "MEDIAMAX";
const SCHEMA = "PUBLIC";

export interface SnowflakeOptions {
  bindings?: string[];
  database?: string;
  schema?: string;
  timeoutSeconds?: number;
}

type Row = Record<string, unknown>;

interface ColumnMeta {
  name: string;
  type: string;
  scale?: number | null;
}

interface StatementResponse {
  data?: (string | null)[][];
  statementHandle?: string;
  message?: string;
  code?: string;
  resultSetMetaData?: { rowType: ColumnMeta[]; partitionInfo?: unknown[] };
}

export const snowflakeConfigured = () =>
  !!(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USER && process.env.SNOWFLAKE_PRIVATE_KEY);

const base64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** "ORG-ACCOUNT" or "locator.region" -> the account name used in JWT claims (no region suffix). */
function jwtAccount(): string {
  return process.env.SNOWFLAKE_ACCOUNT!.trim().split(".")[0].toUpperCase();
}

function host(): string {
  const account = process.env.SNOWFLAKE_ACCOUNT!.trim().toLowerCase().replace(/_/g, "-");
  return account.endsWith(".snowflakecomputing.com") ? account : `${account}.snowflakecomputing.com`;
}

let cachedJwt: { token: string; expiresAt: number } | null = null;

function jwt(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt - 300 > now) return cachedJwt.token;

  const pem = Buffer.from(process.env.SNOWFLAKE_PRIVATE_KEY!, "base64").toString("utf8");
  const privateKey = createPrivateKey(pem);
  const der = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  const fingerprint = `SHA256:${createHash("sha256").update(der).digest("base64")}`;

  const subject = `${jwtAccount()}.${process.env.SNOWFLAKE_USER!.trim().toUpperCase()}`;
  const expiresAt = now + 3300;
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ iss: `${subject}.${fingerprint}`, sub: subject, iat: now, exp: expiresAt })
  );

  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(privateKey);
  const token = `${header}.${payload}.${base64url(signature)}`;
  cachedJwt = { token, expiresAt };
  return token;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${jwt()}`,
    "X-Snowflake-Authorization-Token-Type": "KEYPAIR_JWT",
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "media-max/1.0",
  };
}

function convert(value: string | null, column: ColumnMeta): unknown {
  if (value === null) return null;
  switch (column.type) {
    case "fixed":
      return (column.scale ?? 0) === 0 ? Number(value) : Number(value);
    case "real":
      return Number(value);
    case "boolean":
      return value === "true" || value === "1";
    case "array":
    case "object":
    case "variant":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

async function poll(handle: string, deadline: number): Promise<StatementResponse> {
  for (;;) {
    if (Date.now() > deadline) throw new Error("Snowflake statement timed out");
    await new Promise((r) => setTimeout(r, 800));
    const res = await fetch(`https://${host()}/api/v2/statements/${handle}`, { headers: headers() });
    if (res.status === 200) return (await res.json()) as StatementResponse;
    if (res.status !== 202) throw new Error(`Snowflake ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

/** Runs one SQL statement and returns rows as objects with lower-cased column names. */
export async function snowflakeQuery(sql: string, options: SnowflakeOptions = {}): Promise<Row[]> {
  const timeout = options.timeoutSeconds ?? 60;
  const deadline = Date.now() + timeout * 1000;

  const bindings = options.bindings
    ? Object.fromEntries(options.bindings.map((value, i) => [String(i + 1), { type: "TEXT", value }]))
    : undefined;

  const res = await fetch(`https://${host()}/api/v2/statements`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      statement: sql,
      timeout,
      database: options.database ?? DATABASE,
      schema: options.schema ?? SCHEMA,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
      ...(process.env.SNOWFLAKE_ROLE ? { role: process.env.SNOWFLAKE_ROLE } : {}),
      ...(bindings ? { bindings } : {}),
    }),
    signal: AbortSignal.timeout(timeout * 1000 + 5000),
  });

  let body: StatementResponse;
  if (res.status === 202) {
    const accepted = (await res.json()) as StatementResponse;
    body = await poll(accepted.statementHandle!, deadline);
  } else if (res.ok) {
    body = (await res.json()) as StatementResponse;
  } else {
    const text = await res.text();
    throw new Error(`Snowflake ${res.status}: ${text.slice(0, 400)}`);
  }

  const columns = body.resultSetMetaData?.rowType ?? [];
  const rows = [...(body.data ?? [])];

  const partitions = body.resultSetMetaData?.partitionInfo?.length ?? 1;
  for (let p = 1; p < partitions; p++) {
    const more = await fetch(
      `https://${host()}/api/v2/statements/${body.statementHandle}?partition=${p}`,
      { headers: headers() }
    );
    if (!more.ok) throw new Error(`Snowflake partition ${p} failed (${more.status})`);
    rows.push(...(((await more.json()) as StatementResponse).data ?? []));
  }

  return rows.map((row) =>
    Object.fromEntries(columns.map((col, i) => [col.name.toLowerCase(), convert(row[i] ?? null, col)]))
  );
}
