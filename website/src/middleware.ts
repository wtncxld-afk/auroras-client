import { NextResponse, type NextRequest } from "next/server";

/*
 * Runs before every page and API request:
 *  1. A per-request nonce-based Content Security Policy (no inline script runs without the nonce).
 *  2. Defence in depth for the owner area: requests to /owner/* and /api/owner/* without a session cookie are turned
 *     away here. This is NOT the real check — every owner page and route verifies the session against the database
 *     itself (lib/auth/guard.ts) — it only stops anonymous traffic early.
 */
const COOKIE = "__Host-auroras_owner";
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get(COOKIE)?.value;
  if (pathname.startsWith("/api/owner/") && pathname !== "/api/owner/auth/login" && !hasSession)
    return NextResponse.json({ error: { code: "unauthenticated", message: "Sign in as the owner first." } }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if ((pathname === "/owner" || pathname.startsWith("/owner/")) && pathname !== "/owner/login" && !hasSession) {
    const url = req.nextUrl.clone(); url.pathname = "/owner/login"; url.search = "";
    return NextResponse.redirect(url);
  }
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(req.nextUrl.protocol === "https:" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  if (pathname.startsWith("/owner") || pathname.startsWith("/api/owner")) { res.headers.set("X-Robots-Tag", "noindex, nofollow"); res.headers.set("Cache-Control", "no-store"); }
  return res;
}
export const config = { matcher: [{ source: "/((?!_next/static|_next/image|brand/|product/|favicon|icon|apple-touch-icon).*)" }] };
