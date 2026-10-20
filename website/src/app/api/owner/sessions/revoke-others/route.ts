import { and, eq, isNull, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ownerRoute } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const POST = ownerRoute(async (_req, { session, ipHash }) => {
  const r = await getDb().update(schema.sessions).set({ revokedAt: new Date(), revokeReason: "signed out everywhere else" })
    .where(and(eq(schema.sessions.ownerId, session.ownerId), isNull(schema.sessions.revokedAt), ne(schema.sessions.id, session.id))).returning({ id: schema.sessions.id });
  await audit({ actor: "owner:" + session.username, action: "auth.sessions_revoked", severity: "notice", ipHash, detail: { count: r.length } });
  return json({ ok: true, revoked: r.length });
});
