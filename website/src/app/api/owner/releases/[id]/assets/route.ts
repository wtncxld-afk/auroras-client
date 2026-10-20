import { ownerRoute } from "@/lib/auth/guard";
import { ApiError, json } from "@/lib/http";
import { env } from "@/lib/env";
import { addUploadedAsset } from "@/lib/releases";
import { receive, UploadError } from "@/lib/uploads";
import { assetQuery } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Raw-body upload (PUT, streamed to a temp file; never buffered whole in memory). Metadata comes in the query string.
export const PUT = ownerRoute<{ id: string }>(async (req, { params, session, ipHash }) => {
  const id = uuidParam(params.id);
  const q = assetQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const max = env().MAX_UPLOAD_MB * 1048576, len = Number(req.headers.get("content-length") || 0);
  if (len > max) throw new ApiError(413, "too_large", `The file is larger than the ${env().MAX_UPLOAD_MB} MB limit.`);
  let rec;
  try { rec = await receive(req.body, max); } catch (e) { if (e instanceof UploadError) throw new ApiError(e.status, e.code, e.message); throw e; }
  const a = await addUploadedAsset(id, q, rec, { name: "owner:" + session.username, ipHash });
  return json({ asset: a }, 201);
});
