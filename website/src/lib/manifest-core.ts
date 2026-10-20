// Builds the launcher update manifest. Pure functions (no database), so the exact output can be unit-tested
// and checked against the launcher's own updater.js.
//
// The format is the one the launcher already reads (README "Updates"; updater.js verifyManifest/selectLauncherUpdate/
// selectClientBuild): schema 1, launcher.<channel> = { version, url, sha256, notes }, client[] = { version, mc, loader,
// channel, url, sha256, notes }. Extra fields are additive and ignored by current launchers. The launcher's "preview"
// channel is fed from beta releases; "experimental" is listed under its own key only, so nobody gets it by accident.
// A channel with nothing published is left out entirely: updater.js would reject an empty {} entry.
import crypto from "node:crypto";
import { compareVersions } from "./semver";

export type MRelease = {
  id: string; version: string; channel: "stable" | "beta" | "experimental"; summary: string; notesMd: string;
  changes: { added: string[]; improved: string[]; fixed: string[]; breaking: string[] };
  publishedAt: Date | null; minUpdaterVersion: string | null;
};
export type MAsset = { id: string; releaseId: string; kind: string; platform: string; arch: string; filename: string; size: number; sha256: string; mcVersion: string | null; loader: string | null };
export type MInput = {
  origin: string; generatedAt: Date;
  launcher: { releases: MRelease[]; assets: MAsset[] };
  clientMod: { releases: MRelease[]; assets: MAsset[] } | null;
  withdrawn: { product: string; version: string; sha256: string[] }[];
};

export const downloadUrl = (origin: string, assetId: string) => `${origin}/api/download/${assetId}`;
export function notesText(r: MRelease, max = 2000): string {
  const parts = [r.summary.trim()];
  const sec = (label: string, xs: string[]) => { if (xs.length) parts.push(label + ":\n" + xs.map((x) => "- " + x).join("\n")); };
  sec("Added", r.changes.added); sec("Improved", r.changes.improved); sec("Fixed", r.changes.fixed); sec("Breaking changes", r.changes.breaking);
  const t = parts.filter(Boolean).join("\n\n") || r.notesMd.trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}
const newest = (rs: MRelease[]) => [...rs].sort((a, b) => compareVersions(b.version, a.version));

function launcherEntry(origin: string, r: MRelease, assets: MAsset[]) {
  const mine = assets.filter((a) => a.releaseId === r.id && (a.kind === "installer" || a.kind === "package" || a.kind === "disk_image"));
  const win = mine.find((a) => a.platform === "windows" && a.kind === "installer" && a.filename.toLowerCase().endsWith(".exe"));
  if (!win) return null; // the current launcher updater only installs the Windows installer
  const platforms: Record<string, { url: string; sha256: string; size: number; filename: string }> = {};
  for (const a of mine) platforms[`${a.platform}-${a.arch}`] ??= { url: downloadUrl(origin, a.id), sha256: a.sha256, size: a.size, filename: a.filename };
  return {
    version: r.version, url: downloadUrl(origin, win.id), sha256: win.sha256, notes: notesText(r),
    channel: r.channel, platform: "windows", arch: win.arch, size: win.size, filename: win.filename,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    ...(r.minUpdaterVersion ? { minUpdaterVersion: r.minUpdaterVersion } : {}),
    platforms,
  };
}

export function buildManifest(i: MInput) {
  const launcher: Record<string, unknown> = {};
  const pick = (ch: MRelease["channel"]) => { for (const r of newest(i.launcher.releases.filter((x) => x.channel === ch))) { const e = launcherEntry(i.origin, r, i.launcher.assets); if (e) return e; } return null; };
  const stable = pick("stable"), beta = pick("beta"), experimental = pick("experimental");
  if (stable) launcher.stable = stable;
  if (beta) { launcher.preview = beta; launcher.beta = beta; }
  if (experimental) launcher.experimental = experimental;
  const client: unknown[] = [];
  if (i.clientMod) {
    // Newest build per Minecraft version, loader and channel.
    const seen = new Set<string>();
    for (const r of newest(i.clientMod.releases)) for (const a of i.clientMod.assets.filter((x) => x.releaseId === r.id && x.kind === "mod_jar" && x.mcVersion && x.loader)) {
      const k = `${a.mcVersion}|${a.loader}|${r.channel}`; if (seen.has(k)) continue; seen.add(k);
      client.push({ version: r.version, mc: a.mcVersion, loader: a.loader, channel: r.channel, url: downloadUrl(i.origin, a.id), sha256: a.sha256, size: a.size, filename: a.filename, notes: notesText(r, 600), publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null });
    }
  }
  return { schema: 1, product: "auroras-client", generatedAt: i.generatedAt.toISOString(), launcher, client, withdrawn: i.withdrawn };
}
/** Exact bytes served at /updates/manifest.json; the signature covers these bytes. */
export const serialize = (m: ReturnType<typeof buildManifest>) => JSON.stringify(m, null, 1) + "\n";
/** Detached Ed25519 signature, base64 — the same scheme as scripts/sign-manifest.js and updater.verifyManifest. */
export const signBytes = (body: string, key: crypto.KeyObject) => crypto.sign(null, Buffer.from(body, "utf8"), key).toString("base64");
