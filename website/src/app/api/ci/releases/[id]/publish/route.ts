import { ciRoute } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { publish } from "@/lib/releases";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
// Only for tokens the owner explicitly created with "allow publishing" (scope releases:publish), used by the
// approval-gated publish job in .github/workflows/website-release.yml.
export const POST = ciRoute<{ id: string }>("releases:publish", async (_req, { params, token, ipHash }) => json({ ok: true, hooks: await publish(uuidParam(params.id), { name: "ci:" + token.name, ipHash }) }));
