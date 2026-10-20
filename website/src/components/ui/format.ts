export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const u = ["B", "KB", "MB", "GB"]; let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return (i === 0 ? v.toFixed(0) : v >= 100 ? v.toFixed(0) : v.toFixed(1)) + " " + u[i];
}
const DF = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DTF = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" });
export const formatDate = (d: string | Date | null | undefined) => (d ? DF.format(new Date(d)) : "—");
export const formatDateTime = (d: string | Date | null | undefined) => (d ? DTF.format(new Date(d)) : "—");
export const shortHash = (h: string) => h.slice(0, 12) + "…" + h.slice(-6);
export const PLATFORM_LABEL: Record<string, string> = { windows: "Windows", linux: "Linux", macos: "macOS", any: "Any platform" };
export const KIND_LABEL: Record<string, string> = { installer: "Installer", portable: "Portable", package: "Package", disk_image: "Disk image", archive: "Archive", mod_jar: "Mod jar", module_package: "Module package" };
export const CATEGORY_LABEL: Record<string, string> = { hud: "HUD", visuals: "Visuals", skies: "Custom Skies", emotes: "Emotes", cosmetics: "Cosmetics", utilities: "Utilities", experimental: "Experimental" };
