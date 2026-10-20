import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ownerRoute } from "@/lib/auth/guard";
import { ApiError, json, readJson } from "@/lib/http";
import { deleteModule, updateModule } from "@/lib/content";
import { moduleUpdate } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
type P = { id: string };
export const GET = ownerRoute<P>(async (_req, { params }) => {
  const [m] = await getDb().select().from(schema.modules).where(eq(schema.modules.id, uuidParam(params.id)));
  if (!m) throw new ApiError(404, "not_found", "No such module.");
  return json({ module: m });
});
export const PATCH = ownerRoute<P>(async (req, { params, session, ipHash }) => json({ module: await updateModule(uuidParam(params.id), await readJson(req, moduleUpdate), { name: "owner:" + session.username, ipHash }) }));
export const DELETE = ownerRoute<P>(async (_req, { params, session, ipHash }) => { await deleteModule(uuidParam(params.id), { name: "owner:" + session.username, ipHash }); return json({ ok: true }); });
