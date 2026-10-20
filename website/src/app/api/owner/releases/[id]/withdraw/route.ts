import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { withdraw } from "@/lib/releases";
import { withdrawInput } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const POST = ownerRoute<{ id: string }>(async (req, { params, session, ipHash }) => {
  const { reason } = await readJson(req, withdrawInput);
  const hooks = await withdraw(uuidParam(params.id), reason, { name: "owner:" + session.username, ipHash });
  return json({ ok: true, hooks });
});
