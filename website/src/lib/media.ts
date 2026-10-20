import "server-only";
import { Readable } from "node:stream";
import { schema } from "@/db";
import { storage } from "./storage";
import { fail } from "./http";

export async function serveMedia(m: typeof schema.moduleMedia.$inferSelect, cache = "public, max-age=300") {
  const st = await storage();
  const signed = await st.signedUrl(m.storageKey, { filename: m.id, contentType: m.contentType, ttlSeconds: 300 });
  if (signed) return new Response(null, { status: 302, headers: { Location: signed, "Cache-Control": "no-store" } });
  const s = await st.read(m.storageKey);
  if (!s) return fail(404, "not_found", "Not found.");
  return new Response(Readable.toWeb(s as Readable) as ReadableStream, { headers: { "Content-Type": m.contentType, "Content-Length": String(m.size), "Cache-Control": cache, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", ETag: `"${m.sha256}"` } });
}
