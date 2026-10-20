import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { setDependencies } from "@/lib/releases";
import { depList } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const PUT = ownerRoute<{ id: string }>(async (req, { params, session, ipHash }) => {
  await setDependencies(uuidParam(params.id), await readJson(req, depList), { name: "owner:" + session.username, ipHash });
  return json({ ok: true });
});
