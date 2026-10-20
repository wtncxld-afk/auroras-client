import { latestManifest } from "@/lib/releases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The launcher's update manifest (schema 1), byte-for-byte as signed. Point the launcher's Settings > Updates URL here.
export async function GET() {
  const m = await latestManifest().catch(() => null);
  if (!m) return new Response(JSON.stringify({ error: "No manifest has been generated yet." }), { status: 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  return new Response(m.body, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60, must-revalidate", ETag: `"${m.sha256}"`, "X-Content-Type-Options": "nosniff" } });
}
