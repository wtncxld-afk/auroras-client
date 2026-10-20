import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { deleteDraft, getRelease, updateRelease } from "@/lib/releases";
import { releaseUpdate } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
type P = { id: string };
export const GET = ownerRoute<P>(async (_req, { params }) => {
  const id = uuidParam(params.id), r = await getRelease(id), db = getDb();
  const [assets, compat, deps] = await Promise.all([
    db.select().from(schema.assets).where(eq(schema.assets.releaseId, id)),
    db.select().from(schema.compatibility).where(eq(schema.compatibility.releaseId, id)),
    db.select().from(schema.dependencies).where(eq(schema.dependencies.releaseId, id)),
  ]);
  return json({ release: r, assets, compat, dependencies: deps });
});
export const PATCH = ownerRoute<P>(async (req, { params, session, ipHash }) => {
  const r = await updateRelease(uuidParam(params.id), await readJson(req, releaseUpdate), { name: "owner:" + session.username, ipHash });
  return json(r);
});
export const DELETE = ownerRoute<P>(async (_req, { params, session, ipHash }) => {
  await deleteDraft(uuidParam(params.id), { name: "owner:" + session.username, ipHash });
  return json({ ok: true });
});
