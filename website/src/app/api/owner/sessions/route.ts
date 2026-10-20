import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ownerRoute } from "@/lib/auth/guard";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const GET = ownerRoute(async (_req, { session }) => {
  const rows = await getDb().select({ id: schema.sessions.id, createdAt: schema.sessions.createdAt, lastSeenAt: schema.sessions.lastSeenAt, expiresAt: schema.sessions.expiresAt, userAgent: schema.sessions.userAgent })
    .from(schema.sessions).where(and(eq(schema.sessions.ownerId, session.ownerId), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, new Date()))).orderBy(desc(schema.sessions.lastSeenAt));
  // Session ids are hashes of the cookie tokens; only a short prefix is shown, as a handle for revoking.
  return json({ sessions: rows.map((r) => ({ ...r, id: r.id.slice(0, 16), current: r.id === session.id })) });
});
