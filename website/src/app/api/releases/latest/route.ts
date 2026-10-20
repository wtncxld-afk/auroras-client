import { getLatestLauncher } from "@/lib/public-data";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Small public JSON API: the current launcher release per channel, from the same records as the website.
export async function GET() {
  const l = await getLatestLauncher(), o = env().siteOrigin;
  const out = (r: Awaited<ReturnType<typeof getLatestLauncher>>["stable"]) => r && { version: r.version, channel: r.channel, publishedAt: r.publishedAt, files: r.assets.map((a) => ({ filename: a.filename, platform: a.platform, arch: a.arch, size: a.size, sha256: a.sha256, url: `${o}/api/download/${a.id}` })) };
  return Response.json({ stable: out(l.stable), beta: out(l.beta), experimental: out(l.experimental) }, { headers: { "Cache-Control": "public, max-age=30" } });
}
