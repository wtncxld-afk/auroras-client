import { and, eq } from "drizzle-orm";
import { Readable } from "node:stream";
import { getDb, schema } from "@/db";
import { ownerRoute } from "@/lib/auth/guard";
import { ApiError, json } from "@/lib/http";
import { deleteAsset } from "@/lib/releases";
import { storage } from "@/lib/storage";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type P = { id: string; assetId: string };

// Owner-only download of any file, including drafts, for checking a build before publishing it.
export const GET = ownerRoute<P>(async (_req, { params }) => {
  const [a] = await getDb().select().from(schema.assets).where(and(eq(schema.assets.id, uuidParam(params.assetId)), eq(schema.assets.releaseId, uuidParam(params.id))));
  if (!a) throw new ApiError(404, "not_found", "No such file.");
  if (a.storage === "external") return new Response(null, { status: 302, headers: { Location: a.externalUrl!, "Cache-Control": "no-store" } });
  const st = await storage();
  const url = await st.signedUrl(a.storageKey!, { filename: a.filename, contentType: a.contentType, ttlSeconds: 120 });
  if (url) return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
  const s = await st.read(a.storageKey!);
  if (!s) throw new ApiError(404, "not_found", "The file is missing from storage.");
  return new Response(Readable.toWeb(s as Readable) as ReadableStream, { headers: { "Content-Type": a.contentType, "Content-Length": String(a.size), "Content-Disposition": `attachment; filename="${a.filename}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
});
export const DELETE = ownerRoute<P>(async (_req, { params, session, ipHash }) => {
  await deleteAsset(uuidParam(params.id), uuidParam(params.assetId), { name: "owner:" + session.username, ipHash });
  return json({ ok: true });
});
