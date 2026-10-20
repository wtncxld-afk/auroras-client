import "server-only";
import { unstable_cache } from "next/cache";
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { compareVersions } from "./semver";
import { PUBLIC_TAG } from "./hooks";
import { parseSetting, type SettingKey, type SettingValue } from "./settings-schema";

/*
 * Everything the public site shows comes from here, read from the same release rows the dashboard publishes and the
 * manifest is built from. Only published releases (plus withdrawn ones, as changelog notices without files) and
 * published modules are ever selected. Results are cached under one tag that every publishing action invalidates;
 * the 60 s revalidate is only a safety net for multi-instance deployments.
 */
export type PubAsset = { id: string; kind: string; platform: string; arch: string; filename: string; size: number; sha256: string; checksumSource: string; signatureInfo: string | null; mcVersion: string | null; loader: string | null };
export type PubCompat = { mcVersion: string; loader: string; status: string; notes: string };
export type PubDep = { name: string; versionRange: string; required: boolean; url: string | null; moduleSlug: string | null };
export type PubRelease = {
  id: string; moduleId: string | null; version: string; channel: "stable" | "beta" | "experimental"; status: "published" | "withdrawn";
  title: string; summary: string; notesMd: string; changes: { added: string[]; improved: string[]; fixed: string[]; breaking: string[] };
  compatNotes: string; publishedAt: string | null; withdrawnReason: string | null; retained: boolean;
  assets: PubAsset[]; compat: PubCompat[]; deps: PubDep[]; isLatestInChannel: boolean;
};
export type PubModule = {
  id: string; slug: string; name: string; summary: string; descriptionMd: string; category: string; features: string[];
  installMd: string; requirementsMd: string; knownIssuesMd: string; author: string; docsUrl: string | null; sourceUrl: string | null;
  isClientMod: boolean; icon: string | null; previews: { url: string; alt: string }[]; releases: PubRelease[]; latest: PubRelease | null; updatedAt: string;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);
type RRow = typeof schema.releases.$inferSelect;

async function loadReleases(where: { moduleIds: string[] | null }): Promise<PubRelease[]> {
  const db = getDb(), T = schema.releases;
  const scope = where.moduleIds === null ? isNull(T.moduleId) : where.moduleIds.length ? inArray(T.moduleId, where.moduleIds) : sql`false`;
  const rows = await db.select().from(T).where(and(scope, or(eq(T.status, "published"), eq(T.status, "withdrawn"))));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [assets, compat, deps] = await Promise.all([
    db.select().from(schema.assets).where(inArray(schema.assets.releaseId, ids)).orderBy(asc(schema.assets.platform), asc(schema.assets.filename)),
    db.select().from(schema.compatibility).where(inArray(schema.compatibility.releaseId, ids)),
    db.select({ d: schema.dependencies, slug: schema.modules.slug }).from(schema.dependencies).leftJoin(schema.modules, eq(schema.modules.id, schema.dependencies.moduleId)).where(inArray(schema.dependencies.releaseId, ids)),
  ]);
  const latest = new Map<string, string>(); // product|channel -> release id
  for (const r of rows.filter((x) => x.status === "published")) {
    const k = (r.moduleId ?? "launcher") + "|" + r.channel, cur = latest.get(k), curRow = cur && rows.find((x) => x.id === cur);
    if (!curRow || compareVersions(r.version, curRow.version) > 0) latest.set(k, r.id);
  }
  const out = rows.map((r: RRow): PubRelease => {
    const isLatest = latest.get((r.moduleId ?? "launcher") + "|" + r.channel) === r.id;
    const downloadable = r.status === "published" && (r.retained || isLatest);
    return {
      id: r.id, moduleId: r.moduleId, version: r.version, channel: r.channel, status: r.status as "published" | "withdrawn",
      title: r.title, summary: r.summary, notesMd: r.notesMd, changes: r.changes, compatNotes: r.compatNotes,
      publishedAt: iso(r.publishedAt), withdrawnReason: r.status === "withdrawn" ? r.withdrawnReason : null, retained: r.retained,
      assets: downloadable ? assets.filter((a) => a.releaseId === r.id).map((a) => ({ id: a.id, kind: a.kind, platform: a.platform, arch: a.arch, filename: a.filename, size: a.size, sha256: a.sha256, checksumSource: a.checksumSource, signatureInfo: a.signatureInfo, mcVersion: a.mcVersion, loader: a.loader })) : [],
      compat: compat.filter((c) => c.releaseId === r.id).map((c) => ({ mcVersion: c.mcVersion, loader: c.loader, status: c.status, notes: c.notes })),
      deps: deps.filter((d) => d.d.releaseId === r.id).map((d) => ({ name: d.d.name, versionRange: d.d.versionRange, required: d.d.required, url: d.d.url, moduleSlug: d.slug })),
      isLatestInChannel: isLatest,
    };
  });
  return out.sort((a, b) => compareVersions(b.version, a.version));
}

export const getLauncherReleases = unstable_cache(() => loadReleases({ moduleIds: null }), ["launcher-releases"], { tags: [PUBLIC_TAG], revalidate: 60 });

export const getModules = unstable_cache(async (): Promise<PubModule[]> => {
  const db = getDb(), M = schema.modules;
  const mods = await db.select().from(M).where(eq(M.status, "published")).orderBy(asc(M.sort), asc(M.name));
  if (!mods.length) return [];
  const [rels, media] = await Promise.all([
    loadReleases({ moduleIds: mods.map((m) => m.id) }),
    db.select().from(schema.moduleMedia).where(inArray(schema.moduleMedia.moduleId, mods.map((m) => m.id))).orderBy(asc(schema.moduleMedia.sort)),
  ]);
  return mods.map((m) => {
    const releases = rels.filter((r) => r.moduleId === m.id);
    const pub = releases.filter((r) => r.status === "published");
    const latest = pub.find((r) => r.channel === "stable" && r.isLatestInChannel) ?? pub[0] ?? null;
    const mm = media.filter((x) => x.moduleId === m.id);
    const icon = mm.find((x) => x.kind === "icon");
    return {
      id: m.id, slug: m.slug, name: m.name, summary: m.summary, descriptionMd: m.descriptionMd, category: m.category, features: m.features,
      installMd: m.installMd, requirementsMd: m.requirementsMd, knownIssuesMd: m.knownIssuesMd, author: m.author, docsUrl: m.docsUrl, sourceUrl: m.sourceUrl,
      isClientMod: m.isClientMod, icon: icon ? `/api/media/${icon.id}` : null,
      previews: mm.filter((x) => x.kind === "preview").map((x) => ({ url: `/api/media/${x.id}`, alt: x.alt })),
      releases, latest, updatedAt: m.updatedAt.toISOString(),
    };
  });
}, ["modules"], { tags: [PUBLIC_TAG], revalidate: 60 });

export async function getModule(slug: string) { return (await getModules()).find((m) => m.slug === slug) ?? null; }

export const getSettingsRaw = unstable_cache(async () => {
  const rows = await getDb().select().from(schema.siteSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}, ["settings"], { tags: [PUBLIC_TAG], revalidate: 60 });
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> { return parseSetting(key, (await getSettingsRaw())[key]); }

export type PubAnnouncement = { id: string; title: string; bodyMd: string; level: string; releaseVersion: string | null };
export const getAnnouncements = unstable_cache(async (): Promise<PubAnnouncement[]> => {
  const now = new Date(), A = schema.announcements;
  const rows = await getDb().select({ a: A, v: schema.releases.version, st: schema.releases.status }).from(A).leftJoin(schema.releases, eq(schema.releases.id, A.releaseId))
    .where(and(eq(A.active, true), or(isNull(A.startsAt), lte(A.startsAt, now)), or(isNull(A.endsAt), gt(A.endsAt, now)))).orderBy(desc(A.updatedAt)).limit(3);
  // An announcement tied to a release only shows while that release is published, so a banner never advertises a draft.
  return rows.filter((r) => !r.a.releaseId || r.st === "published").map((r) => ({ id: r.a.id, title: r.a.title, bodyMd: r.a.bodyMd, level: r.a.level, releaseVersion: r.v }));
}, ["announcements"], { tags: [PUBLIC_TAG], revalidate: 60 });

export type PubDoc = { slug: string; title: string; section: string; summary: string; bodyMd: string; updatedAt: string; sort: number };
export const getDocs = unstable_cache(async (): Promise<PubDoc[]> => {
  const rows = await getDb().select().from(schema.docPages).where(eq(schema.docPages.published, true)).orderBy(asc(schema.docPages.sort), asc(schema.docPages.title));
  return rows.map((d) => ({ slug: d.slug, title: d.title, section: d.section, summary: d.summary, bodyMd: d.bodyMd, updatedAt: d.updatedAt.toISOString(), sort: d.sort }));
}, ["docs"], { tags: [PUBLIC_TAG], revalidate: 60 });

/** Newest published launcher release per channel (the authoritative "latest" everywhere on the site). */
export async function getLatestLauncher() {
  const all = (await getLauncherReleases()).filter((r) => r.status === "published");
  const pick = (ch: PubRelease["channel"]) => all.find((r) => r.channel === ch && r.isLatestInChannel) ?? null;
  return { stable: pick("stable"), beta: pick("beta"), experimental: pick("experimental") };
}

/**
 * Download authorization, uncached: the asset's release must be published right now, its module (if any) published,
 * and the release either retained or still the latest of its channel. Anything else — unknown id, draft, unpublished,
 * withdrawn — gets the same "not found", so ids can't be probed.
 */
export async function authorizeDownload(assetId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) return null;
  const db = getDb(), T = schema.releases;
  const [row] = await db.select({ a: schema.assets, r: T, mStatus: schema.modules.status }).from(schema.assets)
    .innerJoin(T, eq(T.id, schema.assets.releaseId)).leftJoin(schema.modules, eq(schema.modules.id, T.moduleId))
    .where(and(eq(schema.assets.id, assetId), eq(T.status, "published"))).limit(1);
  if (!row) return null;
  if (row.r.moduleId && row.mStatus !== "published") return null;
  if (!row.r.retained) {
    const peers = await db.select({ version: T.version }).from(T).where(and(row.r.moduleId ? eq(T.moduleId, row.r.moduleId) : isNull(T.moduleId), eq(T.channel, row.r.channel), eq(T.status, "published")));
    if (peers.some((p) => compareVersions(p.version, row.r.version) > 0)) return null;
  }
  return { asset: row.a, release: row.r };
}
export async function countDownload(assetId: string) {
  const day = new Date().toISOString().slice(0, 10);
  await getDb().insert(schema.downloadCounts).values({ assetId, day, count: 1 })
    .onConflictDoUpdate({ target: [schema.downloadCounts.assetId, schema.downloadCounts.day], set: { count: sql`${schema.downloadCounts.count} + 1` } });
}
