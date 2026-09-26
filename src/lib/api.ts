import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";

export const jsonError = (error: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });

type SessionUser = Session["user"];
type Guard = { user: SessionUser; userId: string } | { response: NextResponse };

/** Resolves the signed-in user, or a ready-made 401 response for the route to return. */
export async function requireUser(message = "Sign in required"): Promise<Guard> {
  const user = (await auth())?.user;
  return user?.id ? { user, userId: user.id } : { response: jsonError(message, 401) };
}

/** Like requireUser, but only for accounts on the demo allowlist. */
export async function requireDemoUser(): Promise<Guard> {
  const guard = await requireUser();
  if ("response" in guard) return guard;
  return guard.user.demo ? guard : { response: jsonError("Not a demo account", 403) };
}
