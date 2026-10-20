import type { MetadataRoute } from "next";
import { getDocs, getModules } from "@/lib/public-data";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL || "http://localhost:3000";
  const [docs, mods] = await Promise.all([getDocs(), getModules()]);
  return [...["", "/features", "/download", "/modules", "/changelog", "/docs", "/community", "/privacy", "/terms"].map((p) => ({ url: base + p })), ...docs.map((d) => ({ url: `${base}/docs/${d.slug}`, lastModified: d.updatedAt })), ...mods.map((m) => ({ url: `${base}/modules/${m.slug}`, lastModified: m.updatedAt }))];
}
