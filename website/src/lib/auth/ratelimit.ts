import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

// Failed sign-ins allowed per 15 minutes, per username and per IP. Stored in Postgres, so limits hold across instances.
export const LIMITS = { windowMs: 15 * 60_000, perUser: 5, perIp: 20 };
export async function loginBlocked(ipHash: string, usernameHash: string): Promise<{ blocked: boolean; retryAfterSec: number }> {
  const since = new Date(Date.now() - LIMITS.windowMs), db = getDb(), t = schema.loginAttempts;
  const [u] = await db.select({ n: sql<number>`count(*)::int`, first: sql<Date | null>`min(${t.at})` }).from(t).where(and(eq(t.usernameHash, usernameHash), eq(t.success, false), gt(t.at, since)));
  const [i] = await db.select({ n: sql<number>`count(*)::int`, first: sql<Date | null>`min(${t.at})` }).from(t).where(and(eq(t.ipHash, ipHash), eq(t.success, false), gt(t.at, since)));
  const hit = u.n >= LIMITS.perUser ? u : i.n >= LIMITS.perIp ? i : null;
  if (!hit) return { blocked: false, retryAfterSec: 0 };
  const first = hit.first ? new Date(hit.first).getTime() : Date.now();
  return { blocked: true, retryAfterSec: Math.max(1, Math.ceil((first + LIMITS.windowMs - Date.now()) / 1000)) };
}
export async function recordAttempt(ipHash: string, usernameHash: string, success: boolean) {
  await getDb().insert(schema.loginAttempts).values({ ipHash, usernameHash, success });
}
