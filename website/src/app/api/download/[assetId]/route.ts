import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { authorizeDownload, countDownload } from "@/lib/public-data";
import { storage } from "@/lib/storage";
import { env } from "@/lib/env";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public download endpoint. Authorization is checked on every request against the live release state (never cached),
// so unpublishing or withdrawing a release blocks new downloads immediately. Private storage is never exposed:
// S3/R2 files get a short-lived signed URL, local files are streamed with Range support (resumable downloads).
export async function GET(req: NextRequest, ctx: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await ctx.params;
    const hit = await authorizeDownload(assetId);
    if (!hit) return fail(404, "not_found", "This file isn't available. It may have been withdrawn or replaced by a newer release.");
    const a = hit.asset, base = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Checksum-SHA256": a.sha256 };
    await countDownload(a.id).catch(() => {});
    if (a.storage === "external") {
      const u = new URL(a.externalUrl!);
      if (u.protocol !== "https:" || !env().externalHosts.includes(u.hostname.toLowerCase())) return fail(404, "not_found", "This file isn't available.");
      return new Response(null, { status: 302, headers: { ...base, Location: u.href } });
    }
    const st = await storage();
    if (st.driver !== a.storage) return fail(503, "storage_unavailable", "This file is stored somewhere this server can't reach right now.");
    const signed = await st.signedUrl(a.storageKey!, { filename: a.filename, contentType: a.contentType, ttlSeconds: env().DOWNLOAD_URL_TTL_SECONDS });
    if (signed) return new Response(null, { status: 302, headers: { ...base, Location: signed } });
    const stat = await st.stat(a.storageKey!);
    if (!stat || stat.size !== a.size) return fail(503, "file_missing", "The file is temporarily unavailable. Please try again later.");
    const headers: Record<string, string> = { ...base, "Content-Type": a.contentType, "Content-Disposition": `attachment; filename="${a.filename}"`, "Accept-Ranges": "bytes", ETag: `"${a.sha256}"`, "Content-Security-Policy": "default-src 'none'; sandbox" };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : a.size - Number(range[2]), end = range[1] && range[2] ? Number(range[2]) : a.size - 1;
      if (!range[1]) end = a.size - 1;
      if (start < 0 || start >= a.size || end < start) return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${a.size}` } });
      end = Math.min(end, a.size - 1);
      const s = await st.read(a.storageKey!, { start, end });
      return new Response(toWeb(s!), { status: 206, headers: { ...headers, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${a.size}` } });
    }
    const s = await st.read(a.storageKey!);
    return new Response(toWeb(s!), { status: 200, headers: { ...headers, "Content-Length": String(a.size) } });
  } catch (e) {
    console.error("[auroras] download failed:", (e as Error).message);
    return fail(500, "server_error", "The download couldn't start. Please try again.");
  }
}
const toWeb = (s: NodeJS.ReadableStream) => Readable.toWeb(s as Readable) as ReadableStream;

// Availability check used by the download buttons (no body, not counted as a download).
export async function HEAD(_req: NextRequest, ctx: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await ctx.params;
  const hit = await authorizeDownload(assetId).catch(() => null);
  if (!hit) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store", "X-Checksum-SHA256": hit.asset.sha256, "X-File-Size": String(hit.asset.size) } });
}
