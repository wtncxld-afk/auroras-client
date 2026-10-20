import "server-only";
import crypto from "node:crypto";
import { env } from "./env";

export const PUBLIC_TAG = "public-data";
export type HookResult = { name: string; ok: boolean; detail: string };

/** After a committed change to public data: drop cached pages, purge the CDN if configured, notify a webhook if configured. */
export async function afterPublicChange(event: { type: string; releaseId?: string; version?: string }): Promise<HookResult[]> {
  const out: HookResult[] = [];
  try {
    const { revalidateTag, revalidatePath } = await import("next/cache");
    revalidateTag(PUBLIC_TAG); revalidatePath("/", "layout");
    out.push({ name: "Website cache", ok: true, detail: "Cached pages and data invalidated" });
  } catch (e) { out.push({ name: "Website cache", ok: false, detail: "Not running inside the web server: " + (e as Error).message.slice(0, 120) }); }
  const e = env();
  if (e.CLOUDFLARE_ZONE_ID && e.CLOUDFLARE_API_TOKEN) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(e.CLOUDFLARE_ZONE_ID)}/purge_cache`, {
        method: "POST", headers: { Authorization: "Bearer " + e.CLOUDFLARE_API_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ files: ["/", "/download", "/changelog", "/modules", "/updates/manifest.json", "/updates/manifest.json.sig"].map((p) => e.siteOrigin + p) }),
        signal: AbortSignal.timeout(8000),
      });
      out.push({ name: "CDN purge", ok: r.ok, detail: r.ok ? "Cloudflare cache purged" : "Cloudflare answered " + r.status });
    } catch (x) { out.push({ name: "CDN purge", ok: false, detail: (x as Error).message }); }
  }
  if (e.RELEASE_WEBHOOK_URL && e.RELEASE_WEBHOOK_SECRET) {
    const body = JSON.stringify({ ...event, manifestUrl: e.siteOrigin + "/updates/manifest.json", at: new Date().toISOString() });
    const sig = crypto.createHmac("sha256", e.RELEASE_WEBHOOK_SECRET).update(body).digest("hex");
    try {
      const r = await fetch(e.RELEASE_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json", "X-Auroras-Signature": "sha256=" + sig }, body, signal: AbortSignal.timeout(8000) });
      out.push({ name: "Release webhook", ok: r.ok, detail: r.ok ? "Delivered" : "Webhook answered " + r.status });
    } catch (x) { out.push({ name: "Release webhook", ok: false, detail: (x as Error).message }); }
  }
  return out;
}
