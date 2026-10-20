import { latestManifest } from "@/lib/releases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Detached Ed25519 signature (base64) over the exact bytes of /updates/manifest.json.
export async function GET() {
  const m = await latestManifest().catch(() => null);
  if (!m || !m.signature) return new Response("Manifest signing is not configured on this server.\n", { status: 503, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  return new Response(m.signature, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60, must-revalidate", ETag: `"${m.sha256}"`, "X-Content-Type-Options": "nosniff" } });
}
