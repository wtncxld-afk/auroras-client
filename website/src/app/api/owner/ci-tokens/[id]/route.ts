import { ownerRoute } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { revokeCiToken } from "@/lib/content";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const DELETE = ownerRoute<{ id: string }>(async (_req, { params, session, ipHash }) => { await revokeCiToken(uuidParam(params.id), { name: "owner:" + session.username, ipHash }); return json({ ok: true }); });
