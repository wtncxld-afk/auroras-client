import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { rollback } from "@/lib/releases";
import { rollbackInput } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const POST = ownerRoute<{ id: string }>(async (req, { params, session, ipHash }) => {
  const b = await readJson(req, rollbackInput);
  const hooks = await rollback(uuidParam(params.id), b.targetId, { withdrawCurrent: b.withdrawCurrent, reason: b.reason }, { name: "owner:" + session.username, ipHash });
  return json({ ok: true, hooks });
});
