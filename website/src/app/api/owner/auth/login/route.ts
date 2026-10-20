import { NextResponse, type NextRequest } from "next/server";
import { attemptLogin } from "@/lib/auth/login";
import { cookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { fail, ipHash, readJson, sameOrigin, toResponse } from "@/lib/http";
import { loginInput } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The only owner endpoint reachable without a session. There is no registration endpoint: the single owner is
// provisioned on the server with `npm run owner:create`.
export async function POST(req: NextRequest) {
  try {
    if (!sameOrigin(req)) return fail(403, "csrf", "Sign in from the owner sign-in page.");
    const input = await readJson(req, loginInput);
    const r = await attemptLogin(input, { ipHash: ipHash(req), userAgent: req.headers.get("user-agent") || "" });
    if (!r.ok) return fail(r.status, r.status === 429 ? "rate_limited" : "invalid_credentials", r.message, r.retryAfter ? { retryAfter: r.retryAfter } : undefined);
    const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    res.cookies.set(SESSION_COOKIE, r.token, cookieOptions(r.maxAge));
    return res;
  } catch (e) { return toResponse(e); }
}
