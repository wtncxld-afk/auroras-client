import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { env } from "../env";
import { randomToken, sha256Hex, safeEqual } from "../crypto";

export const SESSION_COOKIE = "__Host-auroras_owner";
export type OwnerSession = { id: string; ownerId: string; username: string; csrfToken: string; expiresAt: Date; createdAt: Date };

export function cookieOptions(maxAgeSeconds: number) {
  // __Host- requires Secure, Path=/ and no Domain. Browsers accept Secure cookies on http://localhost for development.
  return { httpOnly: true, secure: true, sameSite: "strict" as const, path: "/", maxAge: maxAgeSeconds };
}

export async function createSession(ownerId: string, meta: { ipHash: string; userAgent: string }) {
  const token = randomToken(32), e = env();
  const expiresAt = new Date(Date.now() + e.SESSION_TTL_HOURS * 3600_000);
  await getDb().insert(schema.sessions).values({ id: sha256Hex(token), ownerId, csrfToken: randomToken(24), expiresAt, ipHash: meta.ipHash, userAgent: meta.userAgent.slice(0, 300) });
  return { token, expiresAt, maxAge: e.SESSION_TTL_HOURS * 3600 };
}

/**
 * Resolves a cookie token to a live owner session, or null. Checks: token format, not revoked, not past its absolute
 * expiry or idle timeout, same browser (user agent) that signed in, owner still exists, isn't disabled and has role owner.
 */
export async function readSession(token: string | undefined | null, userAgent: string): Promise<OwnerSession | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const db = getDb(), id = sha256Hex(token), now = new Date();
  const rows = await db.select({ s: schema.sessions, o: schema.owners }).from(schema.sessions)
    .innerJoin(schema.owners, eq(schema.owners.id, schema.sessions.ownerId))
    .where(and(eq(schema.sessions.id, id), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, now))).limit(1);
  const r = rows[0];
  if (!r || r.o.disabled || r.o.role !== "owner") return null;
  if (now.getTime() - r.s.lastSeenAt.getTime() > env().SESSION_IDLE_MINUTES * 60_000) { await revokeSession(id, "idle timeout"); return null; }
  if (r.s.userAgent && !safeEqual(r.s.userAgent, userAgent.slice(0, 300))) { await revokeSession(id, "browser changed"); return null; }
  if (r.s.createdAt < r.o.passwordChangedAt) { await revokeSession(id, "password changed"); return null; }
  if (now.getTime() - r.s.lastSeenAt.getTime() > 60_000) await db.update(schema.sessions).set({ lastSeenAt: now }).where(eq(schema.sessions.id, id));
  return { id, ownerId: r.o.id, username: r.o.username, csrfToken: r.s.csrfToken, expiresAt: r.s.expiresAt, createdAt: r.s.createdAt };
}
export async function revokeSession(id: string, reason: string) {
  await getDb().update(schema.sessions).set({ revokedAt: new Date(), revokeReason: reason }).where(and(eq(schema.sessions.id, id), isNull(schema.sessions.revokedAt)));
}
export async function revokeAllSessions(ownerId: string, reason: string) {
  await getDb().update(schema.sessions).set({ revokedAt: new Date(), revokeReason: reason }).where(and(eq(schema.sessions.ownerId, ownerId), isNull(schema.sessions.revokedAt)));
}
