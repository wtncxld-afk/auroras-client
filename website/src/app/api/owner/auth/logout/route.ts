import { NextResponse } from "next/server";
import { ownerRoute } from "@/lib/auth/guard";
import { revokeSession, SESSION_COOKIE, cookieOptions } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const POST = ownerRoute(async (_req, { session, ipHash }) => {
  await revokeSession(session.id, "signed out");
  await audit({ actor: "owner:" + session.username, action: "auth.logout", ipHash });
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return res;
});
