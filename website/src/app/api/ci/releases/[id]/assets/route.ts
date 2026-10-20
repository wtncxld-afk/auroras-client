import { ciRoute } from "@/lib/auth/guard";
import { ApiError, json } from "@/lib/http";
import { env } from "@/lib/env";
import { addUploadedAsset } from "@/lib/releases";
import { receive, UploadError } from "@/lib/uploads";
import { assetQuery } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export const PUT = ciRoute<{ id: string }>("releases:draft", async (req, { params, token, ipHash }) => {
  const q = assetQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const max = env().MAX_UPLOAD_MB * 1048576;
  if (Number(req.headers.get("content-length") || 0) > max) throw new ApiError(413, "too_large", "File too large.");
  let rec; try { rec = await receive(req.body, max); } catch (e) { if (e instanceof UploadError) throw new ApiError(e.status, e.code, e.message); throw e; }
  const a = await addUploadedAsset(uuidParam(params.id), q, rec, { name: "ci:" + token.name, ipHash });
  return json({ asset: { id: a.id, filename: a.filename, size: a.size, sha256: a.sha256 } }, 201);
});
