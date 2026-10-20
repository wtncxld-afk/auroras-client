import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { upsertDoc } from "@/lib/content";
import { docInput } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const POST = ownerRoute(async (req, { session, ipHash }) => json({ doc: await upsertDoc(null, await readJson(req, docInput), { name: "owner:" + session.username, ipHash }) }, 201));
