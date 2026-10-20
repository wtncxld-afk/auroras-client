import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { setCompat } from "@/lib/releases";
import { compatList } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const PUT = ownerRoute<{ id: string }>(async (req, { params, session, ipHash }) => {
  await setCompat(uuidParam(params.id), await readJson(req, compatList), { name: "owner:" + session.username, ipHash });
  return json({ ok: true });
});
