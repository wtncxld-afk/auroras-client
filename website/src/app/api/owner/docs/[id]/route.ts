import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { deleteDoc, upsertDoc } from "@/lib/content";
import { docInput } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
type P = { id: string };
export const PUT = ownerRoute<P>(async (req, { params, session, ipHash }) => json({ doc: await upsertDoc(uuidParam(params.id), await readJson(req, docInput), { name: "owner:" + session.username, ipHash }) }));
export const DELETE = ownerRoute<P>(async (_req, { params, session, ipHash }) => { await deleteDoc(uuidParam(params.id), { name: "owner:" + session.username, ipHash }); return json({ ok: true }); });
