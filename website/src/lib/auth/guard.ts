import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { readSession, SESSION_COOKIE, type OwnerSession } from "./session";
import { ApiError, fail, ipHash, sameOrigin, toResponse } from "../http";
import { safeEqual, sha256Hex } from "../crypto";
import { audit } from "../audit";

/*
 * Authorization is deny-by-default and enforced here, on the server, for every owner page and API route:
 *  - owner pages call requireOwnerPage() before reading anything;
 *  - owner API routes are wrapped in ownerRoute(), which rejects anything without a live owner session and, for any
 *    state-changing method, also requires a same-origin request and the session's CSRF token in X-CSRF-Token;
 *  - CI routes are wrapped in ciRoute(), which accepts only a scoped, unrevoked CI token (never a cookie).
 * tests/unit/authz-static.test.ts fails if any route or page under /owner or /api/owner skips these.
 */

export type RouteCtx<P = Record<string, string>> = { params: Promise<P> };
type OwnerHandler<P> = (req: NextRequest, ctx: { params: P; session: OwnerSession; ipHash: string }) => Promise<Response>;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function ownerRoute<P = Record<string, string>>(handler: OwnerHandler<P>) {
  return async (req: NextRequest, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value, req.headers.get("user-agent") || "");
      if (!session) return fail(401, "unauthenticated", "Sign in as the owner first.");
      const ip = ipHash(req);
      if (MUTATING.has(req.method)) {
        const token = req.headers.get("x-csrf-token") || "";
        if (!sameOrigin(req) || !token || !safeEqual(token, session.csrfToken)) {
          await audit({ actor: "owner:" + session.username, action: "security.csrf_rejected", severity: "warning", ipHash: ip, detail: { path: new URL(req.url).pathname, method: req.method } });
          return fail(403, "csrf", "This request didn't come from the owner dashboard.");
        }
      }
      return await handler(req, { params: await ctx.params, session, ipHash: ip });
    } catch (e) { return toResponse(e); }
  };
}

/** For owner pages (server components). Redirects to the sign-in page when there is no live owner session. */
export async function requireOwnerPage(): Promise<OwnerSession> {
  const c = await cookies(), h = await headers();
  const s = await readSession(c.get(SESSION_COOKIE)?.value, h.get("user-agent") || "");
  if (!s) redirect("/owner/login");
  return s;
}
export async function currentOwner(): Promise<OwnerSession | null> {
  const c = await cookies(), h = await headers();
  return readSession(c.get(SESSION_COOKIE)?.value, h.get("user-agent") || "");
}

export type CiScope = "releases:draft" | "releases:publish";
type CiHandler<P> = (req: NextRequest, ctx: { params: P; token: { id: string; name: string; scopes: string[] }; ipHash: string }) => Promise<Response>;
export function ciRoute<P = Record<string, string>>(scope: CiScope, handler: CiHandler<P>) {
  return async (req: NextRequest, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      const m = /^Bearer (aur_ci_[A-Za-z0-9_-]{43})$/.exec(req.headers.get("authorization") || "");
      if (!m) return fail(401, "unauthenticated", "A CI token is required.");
      const db = getDb();
      const [t] = await db.select().from(schema.ciTokens).where(and(eq(schema.ciTokens.tokenHash, sha256Hex(m[1])), isNull(schema.ciTokens.revokedAt))).limit(1);
      if (!t) return fail(401, "unauthenticated", "Unknown or revoked CI token.");
      if (!t.scopes.includes(scope)) {
        await audit({ actor: "ci:" + t.name, action: "security.ci_scope_denied", severity: "warning", ipHash: ipHash(req), detail: { scope } });
        return fail(403, "forbidden", "This CI token doesn't have the " + scope + " scope.");
      }
      await db.update(schema.ciTokens).set({ lastUsedAt: new Date() }).where(eq(schema.ciTokens.id, t.id));
      return await handler(req, { params: await ctx.params, token: { id: t.id, name: t.name, scopes: t.scopes }, ipHash: ipHash(req) });
    } catch (e) { return toResponse(e); }
  };
}
export { ApiError };
