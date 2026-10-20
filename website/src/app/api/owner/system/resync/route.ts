import { ownerRoute } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { resync } from "@/lib/releases";

export const dynamic = "force-dynamic";
export const POST = ownerRoute(async (_req, { session, ipHash }) => json({ ok: true, hooks: await resync({ name: "owner:" + session.username, ipHash }) }));
