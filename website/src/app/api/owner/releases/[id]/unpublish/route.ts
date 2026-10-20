import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { unpublish } from "@/lib/releases";
import { confirmInput } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const POST = ownerRoute<{ id: string }>(async (req, { params, session, ipHash }) => {
  await readJson(req, confirmInput);
  const hooks = await unpublish(uuidParam(params.id), { name: "owner:" + session.username, ipHash });
  return json({ ok: true, hooks });
});
