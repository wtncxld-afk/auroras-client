import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, like, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { env } from "../env";
import { storage } from "../storage";
import { latestManifest } from "../releases";
import { compareVersions } from "../semver";
import { sha256Hex } from "../crypto";

// Read models for the owner dashboard. Only ever called after requireOwnerPage().
const T = schema.releases;

export async function dashboard() {
  const db = getDb();
  const [rel, mods, recent, security, downloads, latest, manifest, health] = await Promise.all([
    db.select({ moduleId: T.moduleId, status: T.status, n: sql<number>`count(*)::int` }).from(T).groupBy(T.moduleId, T.status),
    db.select({ status: schema.modules.status, n: sql<number>`count(*)::int` }).from(schema.modules).groupBy(schema.modules.status),
    db.select().from(schema.auditEvents).where(or(like(schema.auditEvents.action, "release.%"), like(schema.auditEvents.action, "asset.%"), like(schema.auditEvents.action, "module.%"))).orderBy(desc(schema.auditEvents.id)).limit(8),
    db.select().from(schema.auditEvents).where(or(like(schema.auditEvents.action, "auth.%"), like(schema.auditEvents.action, "security.%"), like(schema.auditEvents.action, "owner.%"))).orderBy(desc(schema.auditEvents.id)).limit(8),
    db.select({ day: schema.downloadCounts.day, n: sql<number>`sum(${schema.downloadCounts.count})::int` }).from(schema.downloadCounts).where(gte(schema.downloadCounts.day, sql`(current_date - 29)`)).groupBy(schema.downloadCounts.day).orderBy(asc(schema.downloadCounts.day)),
    db.select().from(T).where(and(isNull(T.moduleId), eq(T.status, "published"))),
    latestManifest(),
    systemHealth(),
  ]);
  const count = (pred: (r: (typeof rel)[number]) => boolean) => rel.filter(pred).reduce((a, r) => a + r.n, 0);
  const newest = (ch: string) => latest.filter((r) => r.channel === ch).sort((a, b) => compareVersions(b.version, a.version))[0] ?? null;
  return {
    publishedLauncher: count((r) => !r.moduleId && r.status === "published"),
    publishedModuleReleases: count((r) => !!r.moduleId && r.status === "published"),
    drafts: count((r) => r.status === "draft"),
    withdrawn: count((r) => r.status === "withdrawn"),
    publishedModules: mods.filter((m) => m.status === "published").reduce((a, m) => a + m.n, 0),
    latest: { stable: newest("stable"), beta: newest("beta"), experimental: newest("experimental") },
    recent, security, downloads, manifest: manifest ? { createdAt: manifest.createdAt, signed: !!manifest.signature, reason: manifest.reason, sha256: manifest.sha256 } : null, health,
  };
}

export async function systemHealth() {
  const e = env(), checks: { name: string; ok: boolean; detail: string }[] = [];
  try { await getDb().execute(sql`select 1`); checks.push({ name: "Database", ok: true, detail: "Connected" }); } catch (x) { checks.push({ name: "Database", ok: false, detail: (x as Error).message.slice(0, 120) }); }
  try { const h = await (await storage()).health(); checks.push({ name: "File storage (" + e.STORAGE_DRIVER + ")", ...h }); } catch (x) { checks.push({ name: "File storage", ok: false, detail: (x as Error).message }); }
  checks.push({ name: "Manifest signing key", ok: !!e.signingKey, detail: e.publicKeyPem ? "Ed25519, public key fingerprint " + sha256Hex(e.publicKeyPem.trim()).slice(0, 16) : "Not configured: /updates/manifest.json.sig answers 503" });
  checks.push({ name: "CDN purge", ok: true, detail: e.CLOUDFLARE_ZONE_ID ? "Cloudflare purge configured" : "Not configured (optional)" });
  checks.push({ name: "Release webhook", ok: true, detail: e.RELEASE_WEBHOOK_URL ? "Configured" : "Not configured (optional)" });
  checks.push({ name: "Environment", ok: true, detail: e.APP_ENV + (e.TRUST_PROXY_HEADERS ? ", trusting proxy IP headers" : ", proxy IP headers ignored") });
  return checks;
}

export async function releasesList() {
  const db = getDb();
  const rows = await db.select({ r: T, module: schema.modules.name, files: sql<number>`(select count(*)::int from ${schema.assets} where ${schema.assets.releaseId} = ${T.id})` }).from(T).leftJoin(schema.modules, eq(schema.modules.id, T.moduleId)).orderBy(desc(T.createdAt));
  return rows.sort((a, b) => (a.module ?? "").localeCompare(b.module ?? "") || compareVersions(b.r.version, a.r.version));
}

export async function releaseDetail(id: string) {
  const db = getDb();
  const [r] = await db.select().from(T).where(eq(T.id, id));
  if (!r) return null;
  const [assets, compat, deps, history, siblings, mod, downloads] = await Promise.all([
    db.select().from(schema.assets).where(eq(schema.assets.releaseId, id)).orderBy(asc(schema.assets.createdAt)),
    db.select().from(schema.compatibility).where(eq(schema.compatibility.releaseId, id)),
    db.select().from(schema.dependencies).where(eq(schema.dependencies.releaseId, id)),
    db.select().from(schema.auditEvents).where(and(eq(schema.auditEvents.targetId, id))).orderBy(desc(schema.auditEvents.id)).limit(50),
    db.select().from(T).where(and(r.moduleId ? eq(T.moduleId, r.moduleId) : isNull(T.moduleId), eq(T.channel, r.channel))),
    r.moduleId ? db.select().from(schema.modules).where(eq(schema.modules.id, r.moduleId)).then((x) => x[0] ?? null) : Promise.resolve(null),
    db.select({ assetId: schema.downloadCounts.assetId, n: sql<number>`sum(${schema.downloadCounts.count})::int` }).from(schema.downloadCounts).innerJoin(schema.assets, eq(schema.assets.id, schema.downloadCounts.assetId)).where(eq(schema.assets.releaseId, id)).groupBy(schema.downloadCounts.assetId),
  ]);
  const rollbackTargets = siblings.filter((s) => s.id !== id && s.firstPublishedAt && (s.status === "published" || s.status === "unpublished") && compareVersions(s.version, r.version) < 0).sort((a, b) => compareVersions(b.version, a.version));
  return { release: r, assets, compat, deps, history, rollbackTargets, module: mod, downloads: Object.fromEntries(downloads.map((d) => [d.assetId, d.n])) };
}

export async function modulesList() {
  const db = getDb();
  return db.select({ m: schema.modules, releases: sql<number>`(select count(*)::int from ${T} where ${T.moduleId} = ${schema.modules.id})`, published: sql<number>`(select count(*)::int from ${T} where ${T.moduleId} = ${schema.modules.id} and ${T.status} = 'published')` }).from(schema.modules).orderBy(asc(schema.modules.sort), asc(schema.modules.name));
}
export async function moduleDetail(id: string) {
  const db = getDb();
  const [m] = await db.select().from(schema.modules).where(eq(schema.modules.id, id));
  if (!m) return null;
  const [media, releases] = await Promise.all([db.select().from(schema.moduleMedia).where(eq(schema.moduleMedia.moduleId, id)).orderBy(asc(schema.moduleMedia.sort)), db.select().from(T).where(eq(T.moduleId, id))]);
  return { module: m, media, releases: releases.sort((a, b) => compareVersions(b.version, a.version)) };
}
export async function allSettings() { return Object.fromEntries((await getDb().select().from(schema.siteSettings)).map((r) => [r.key, r.value])); }
export async function announcementsList() { return getDb().select().from(schema.announcements).orderBy(desc(schema.announcements.updatedAt)); }
export async function publishedReleasesForSelect() { return getDb().select({ id: T.id, version: T.version, moduleId: T.moduleId }).from(T).where(eq(T.status, "published")); }
export async function docsList() { return getDb().select().from(schema.docPages).orderBy(asc(schema.docPages.section), asc(schema.docPages.sort)); }
export async function docById(id: string) { return (await getDb().select().from(schema.docPages).where(eq(schema.docPages.id, id)))[0] ?? null; }
export async function auditPage(opts: { page: number; q?: string; severity?: string }) {
  const db = getDb(), A = schema.auditEvents, size = 50;
  const where = and(opts.q ? like(A.action, opts.q.replace(/[%_]/g, "") + "%") : undefined, opts.severity && ["info", "notice", "warning", "critical"].includes(opts.severity) ? eq(A.severity, opts.severity as "info") : undefined);
  const rows = await db.select().from(A).where(where).orderBy(desc(A.id)).limit(size + 1).offset(opts.page * size);
  return { rows: rows.slice(0, size), more: rows.length > size };
}
export async function sessionsFor(ownerId: string) {
  return getDb().select({ id: schema.sessions.id, createdAt: schema.sessions.createdAt, lastSeenAt: schema.sessions.lastSeenAt, expiresAt: schema.sessions.expiresAt, userAgent: schema.sessions.userAgent })
    .from(schema.sessions).where(and(eq(schema.sessions.ownerId, ownerId), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, new Date()))).orderBy(desc(schema.sessions.lastSeenAt));
}
export async function ciTokens() { return (await getDb().select().from(schema.ciTokens).orderBy(desc(schema.ciTokens.createdAt))).map(({ tokenHash: _t, ...x }) => x); }
export async function ownerInfo(ownerId: string) {
  const db = getDb();
  const [o] = await db.select({ username: schema.owners.username, totpEnabled: schema.owners.totpEnabled, lastLoginAt: schema.owners.lastLoginAt, passwordChangedAt: schema.owners.passwordChangedAt }).from(schema.owners).where(eq(schema.owners.id, ownerId));
  const [codes] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.recoveryCodes).where(and(eq(schema.recoveryCodes.ownerId, ownerId), isNull(schema.recoveryCodes.usedAt)));
  return { ...o, recoveryCodesLeft: codes?.n ?? 0 };
}
export async function moduleOptions() { return getDb().select({ id: schema.modules.id, name: schema.modules.name, isClientMod: schema.modules.isClientMod }).from(schema.modules).orderBy(asc(schema.modules.name)); }
export { inArray };
