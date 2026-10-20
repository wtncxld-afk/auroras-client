import { z } from "zod";
import { ownerRoute } from "@/lib/auth/guard";
import { ApiError, json } from "@/lib/http";
import { env } from "@/lib/env";
import { addModuleMedia } from "@/lib/content";
import { receive, UploadError } from "@/lib/uploads";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const q = z.object({ kind: z.enum(["icon", "preview"]), alt: z.string().max(200).default("") });
export const PUT = ownerRoute<{ id: string }>(async (req, { params, session, ipHash }) => {
  const { kind, alt } = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const max = env().MAX_IMAGE_MB * 1048576;
  if (Number(req.headers.get("content-length") || 0) > max) throw new ApiError(413, "too_large", `Images are limited to ${env().MAX_IMAGE_MB} MB.`);
  let rec; try { rec = await receive(req.body, max); } catch (e) { if (e instanceof UploadError) throw new ApiError(e.status, e.code, e.message); throw e; }
  return json({ media: await addModuleMedia(uuidParam(params.id), kind, alt, rec, { name: "owner:" + session.username, ipHash }) }, 201);
});
