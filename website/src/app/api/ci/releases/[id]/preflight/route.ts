import { ciRoute } from "@/lib/auth/guard";
import { json } from "@/lib/http";
import { preflight } from "@/lib/releases";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const GET = ciRoute<{ id: string }>("releases:draft", async (_req, { params }) => json(await preflight(uuidParam(params.id))));
