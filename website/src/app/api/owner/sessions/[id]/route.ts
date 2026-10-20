import { and, eq, isNull, like } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ownerRoute } from "@/lib/auth/guard";
import { ApiError, json } from "@/lib/http";
import { revokeSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const DELETE = ownerRoute<{ id: string }>(async (_req, { params, session, ipHash }) => {
  if (!/^[0-9a-f]{16}$/.test(params.id)) throw new ApiError(404, "not_found", "No such session.");
  const rows = await getDb().select({ id: schema.sessions.id }).from(schema.sessions).where(and(eq(schema.sessions.ownerId, session.ownerId), isNull(schema.sessions.revokedAt), like(schema.sessions.id, params.id + "%")));
  if (rows.length !== 1) throw new ApiError(404, "not_found", "No such session.");
  await revokeSession(rows[0].id, "revoked by owner");
  await audit({ actor: "owner:" + session.username, action: "auth.session_revoked", severity: "notice", ipHash });
  return json({ ok: true });
});
