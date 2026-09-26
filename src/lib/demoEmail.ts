/** Emails (comma-separated in DEMO_ACCOUNT_EMAILS) that get a preloaded presentation dashboard. */
export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.DEMO_ACCOUNT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
