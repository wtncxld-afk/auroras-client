import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ownerRoute } from "@/lib/auth/guard";
import { ApiError, json } from "@/lib/http";
import { deleteModuleMedia } from "@/lib/content";
import { serveMedia } from "@/lib/media";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type P = { id: string; mediaId: string };
export const GET = ownerRoute<P>(async (_req, { params }) => {
  const [m] = await getDb().select().from(schema.moduleMedia).where(and(eq(schema.moduleMedia.id, uuidParam(params.mediaId)), eq(schema.moduleMedia.moduleId, uuidParam(params.id))));
  if (!m) throw new ApiError(404, "not_found", "No such image.");
  return serveMedia(m, "private, no-store");
});
export const DELETE = ownerRoute<P>(async (_req, { params, session, ipHash }) => { await deleteModuleMedia(uuidParam(params.id), uuidParam(params.mediaId), { name: "owner:" + session.username, ipHash }); return json({ ok: true }); });
