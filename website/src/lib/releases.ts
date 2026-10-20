import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb, schema, type Tx } from "@/db";
import { env } from "./env";
import { audit } from "./audit";
import { ApiError } from "./http";
import { compareVersions } from "./semver";
import { storage, assetKey } from "./storage";
import { buildManifest, serialize, signBytes, type MAsset, type MRelease } from "./manifest-core";
import { sha256Hex } from "./crypto";
import { afterPublicChange, type HookResult } from "./hooks";
import { discard, KIND_RULES, validateFile, type AssetKind, type Received } from "./uploads";
import type { z } from "zod";
import type { releaseCreate, releaseUpdate, compatList, depList, assetQuery } from "./validation";

/*
 * The release service. Every state change runs in one database transaction together with the regeneration of the
 * signed launcher manifest and an audit record, so the website, downloads, changelog and launcher manifest always come
 * from the same committed release rows. If anything fails (validation, missing file, signing) nothing is committed and
 * the previous published state stays live.
 */
type R = typeof schema.releases.$inferSelect;
export type Actor = { name: string; ipHash?: string };
const T = schema.releases, A = schema.assets;

export async function getRelease(id: string, tx?: Tx): Promise<R> {
  const [r] = await (tx ?? getDb()).select().from(T).where(eq(T.id, id)).limit(1);
  if (!r) throw new ApiError(404, "not_found", "No such release.");
  return r;
}
const productLabel = async (r: R, tx?: Tx) => {
  if (!r.moduleId) return "Launcher";
  const [m] = await (tx ?? getDb()).select({ name: schema.modules.name }).from(schema.modules).where(eq(schema.modules.id, r.moduleId));
  return m?.name ?? "Module";
};

export async function createRelease(input: z.infer<typeof releaseCreate>, actor: Actor, source = "dashboard") {
  return getDb().transaction(async (tx) => {
    if (input.moduleId) {
      const [m] = await tx.select().from(schema.modules).where(eq(schema.modules.id, input.moduleId));
      if (!m) throw new ApiError(400, "invalid_input", "That module doesn't exist.");
    }
    const [r] = await tx.insert(T).values({ ...input, status: "draft", source }).returning();
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "release.create", targetType: "release", targetId: r.id, detail: { version: r.version, channel: r.channel, product: input.moduleId ? "module" : "launcher", source } }, tx);
    return r;
  });
}

export async function updateRelease(id: string, input: z.infer<typeof releaseUpdate>, actor: Actor) {
  const res = await getDb().transaction(async (tx) => {
    const r = await getRelease(id, tx);
    const live = r.status === "published";
    if (live && ((input.version && input.version !== r.version) || (input.channel && input.channel !== r.channel)))
      throw new ApiError(409, "published", "Unpublish the release before changing its version or channel.");
    if (r.status === "withdrawn" && (input.version || input.channel)) throw new ApiError(409, "withdrawn", "A withdrawn release can't be renumbered.");
    const [u] = await tx.update(T).set({ ...input, updatedAt: new Date() }).where(eq(T.id, id)).returning();
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "release.update", targetType: "release", targetId: id, detail: { fields: Object.keys(input), version: u.version, live } }, tx);
    if (live) await regenerateManifest(tx, "release edited: " + u.version);
    return { release: u, live };
  });
  const hooks = res.live ? await afterPublicChange({ type: "release.updated", releaseId: id, version: res.release.version }) : [];
  return { release: res.release, hooks };
}

export async function deleteDraft(id: string, actor: Actor) {
  const keys = await getDb().transaction(async (tx) => {
    const r = await getRelease(id, tx);
    if (r.status !== "draft" || r.firstPublishedAt) throw new ApiError(409, "not_draft", "Only drafts that were never published can be deleted. Withdraw or unpublish it instead.");
    const files = await tx.select({ key: A.storageKey }).from(A).where(and(eq(A.releaseId, id), ne(A.storage, "external")));
    await tx.delete(T).where(eq(T.id, id));
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "release.delete_draft", targetType: "release", targetId: id, severity: "notice", detail: { version: r.version } }, tx);
    return files.map((f) => f.key!).filter(Boolean);
  });
  const st = await storage();
  for (const k of keys) await st.delete(k).catch(() => {});
}

const editable = (r: R) => { if (r.status === "published" || r.status === "withdrawn") throw new ApiError(409, "locked", r.status === "published" ? "Files of a published release can't change. Unpublish it first." : "A withdrawn release can't change."); };

/** Stores an uploaded, received file as an asset of a draft/unpublished release, after server-side validation. */
export async function addUploadedAsset(releaseId: string, q: z.infer<typeof assetQuery>, rec: Received, actor: Actor) {
  try {
    const r = await getRelease(releaseId);
    editable(r);
    const kind = q.kind as AssetKind;
    if (kind === "mod_jar" && (!q.mc || !q.loader)) throw new ApiError(400, "invalid_input", "A mod jar needs its Minecraft version and loader.");
    const v = validateFile(q.filename, rec, KIND_RULES[kind], { requireFabricMod: kind === "mod_jar" && q.loader === "fabric" });
    if (!v.ok) {
      await audit({ actor: actor.name, ipHash: actor.ipHash, action: "asset.upload_rejected", targetType: "release", targetId: releaseId, severity: "notice", detail: { filename: q.filename.slice(0, 128), checks: v.checks.filter((c) => !c.ok).map((c) => c.name) } });
      throw new ApiError(422, "invalid_file", "The file didn't pass validation.", { checks: v.checks });
    }
    const id = crypto.randomUUID(), key = assetKey(id, q.filename), st = await storage();
    await st.putFile(key, rec.tmpPath, v.rule!.contentType);
    try {
      const [a] = await getDb().transaction(async (tx) => {
        const cur = await getRelease(releaseId, tx); editable(cur); // re-check inside the transaction
        const row = await tx.insert(A).values({ id, releaseId, kind, platform: q.platform, arch: q.arch, filename: q.filename, size: rec.size, sha256: rec.sha256, contentType: v.rule!.contentType, storage: st.driver, storageKey: key, checksumSource: "server", mcVersion: q.mc ?? null, loader: q.loader ?? null, validation: { checks: v.checks } }).returning();
        await audit({ actor: actor.name, ipHash: actor.ipHash, action: "asset.upload", targetType: "release", targetId: releaseId, detail: { filename: q.filename, size: rec.size, sha256: rec.sha256, kind } }, tx);
        return row;
      });
      return a;
    } catch (e) { await st.delete(key).catch(() => {}); throw e; }
  } finally { await discard(rec.tmpPath); }
}

export async function deleteAsset(releaseId: string, assetId: string, actor: Actor) {
  const key = await getDb().transaction(async (tx) => {
    const r = await getRelease(releaseId, tx); editable(r);
    const [a] = await tx.select().from(A).where(and(eq(A.id, assetId), eq(A.releaseId, releaseId)));
    if (!a) throw new ApiError(404, "not_found", "No such file on this release.");
    await tx.delete(A).where(eq(A.id, assetId));
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "asset.delete", targetType: "release", targetId: releaseId, severity: "notice", detail: { filename: a.filename } }, tx);
    return a.storage === "external" ? null : a.storageKey;
  });
  if (key) await (await storage()).delete(key).catch(() => {});
}

export async function setCompat(releaseId: string, input: z.infer<typeof compatList>, actor: Actor) {
  const live = await getDb().transaction(async (tx) => {
    const r = await getRelease(releaseId, tx);
    await tx.delete(schema.compatibility).where(eq(schema.compatibility.releaseId, releaseId));
    if (input.items.length) await tx.insert(schema.compatibility).values(input.items.map((i) => ({ ...i, releaseId })));
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "release.compat", targetType: "release", targetId: releaseId, detail: { count: input.items.length } }, tx);
    return r.status === "published";
  });
  if (live) await afterPublicChange({ type: "release.updated", releaseId });
}
export async function setDependencies(releaseId: string, input: z.infer<typeof depList>, actor: Actor) {
  const live = await getDb().transaction(async (tx) => {
    const r = await getRelease(releaseId, tx);
    await tx.delete(schema.dependencies).where(eq(schema.dependencies.releaseId, releaseId));
    if (input.items.length) await tx.insert(schema.dependencies).values(input.items.map((i) => ({ ...i, url: i.url ?? null, releaseId })));
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "release.dependencies", targetType: "release", targetId: releaseId, detail: { count: input.items.length } }, tx);
    return r.status === "published";
  });
  if (live) await afterPublicChange({ type: "release.updated", releaseId });
}

export type Preflight = { ok: boolean; checks: { name: string; ok: boolean; detail: string }[] };
/** Everything that must hold before a release can go live. Shown in the dashboard and enforced by publish(). */
export async function preflight(id: string, tx?: Tx): Promise<Preflight> {
  const db = tx ?? getDb(), r = await getRelease(id, tx);
  const files = await db.select().from(A).where(eq(A.releaseId, id));
  const checks: Preflight["checks"] = [];
  checks.push({ name: "Status allows publishing", ok: r.status === "draft" || r.status === "unpublished", detail: "Currently " + r.status });
  checks.push({ name: "Has at least one file", ok: files.length > 0, detail: files.length + " file(s)" });
  if (!r.moduleId) {
    const win = files.some((f) => f.kind === "installer" && f.platform === "windows");
    checks.push({ name: "Windows installer present", ok: win, detail: win ? "The launcher updater can use this release" : "Launcher releases need the Windows installer" });
  } else {
    const [m] = await db.select().from(schema.modules).where(eq(schema.modules.id, r.moduleId));
    checks.push({ name: "Module is not disabled", ok: !!m && m.status !== "disabled", detail: m ? "Module status: " + m.status : "Module missing" });
    if (m?.isClientMod) { const jars = files.filter((f) => f.kind === "mod_jar"); checks.push({ name: "Mod jars name their Minecraft version", ok: jars.length > 0 && jars.every((j) => j.mcVersion && j.loader), detail: jars.length + " jar(s)" }); }
  }
  const st = await storage();
  for (const f of files) {
    if (f.storage === "external") {
      const host = (() => { try { const u = new URL(f.externalUrl!); return u.protocol === "https:" ? u.hostname.toLowerCase() : ""; } catch { return ""; } })();
      checks.push({ name: "File location: " + f.filename, ok: env().externalHosts.includes(host), detail: host ? "External file on " + host : "Not an https link" });
    } else {
      const s = f.storage === st.driver ? await st.stat(f.storageKey!) : null;
      checks.push({ name: "File stored: " + f.filename, ok: !!s && s.size === f.size, detail: s ? (s.size === f.size ? "Size matches (" + f.size + " bytes)" : "Stored size differs") : "Missing from storage" });
    }
    checks.push({ name: "Validation: " + f.filename, ok: f.validation.checks.every((c) => c.ok), detail: f.checksumSource === "server" ? "SHA-256 computed on upload" : "SHA-256 imported from the release's SHA256SUMS.txt" });
  }
  if (env().REQUIRE_SIGNED_MANIFEST && env().APP_ENV === "production") checks.push({ name: "Manifest signing key", ok: !!env().signingKey, detail: env().signingKey ? "Configured" : "UPDATE_SIGNING_KEY missing" });
  return { ok: checks.every((c) => c.ok), checks };
}

async function finish(id: string, type: string): Promise<HookResult[]> {
  const r = await getRelease(id);
  return afterPublicChange({ type, releaseId: id, version: r.version });
}

export async function publish(id: string, actor: Actor) {
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4242)`); // one publication at a time
    const pf = await preflight(id, tx);
    if (!pf.ok) throw new ApiError(409, "preflight_failed", "The release isn't ready to publish.", { checks: pf.checks });
    const r = await getRelease(id, tx), at = new Date();
    await tx.update(T).set({ status: "published", publishedAt: r.publishedAt ?? at, firstPublishedAt: r.firstPublishedAt ?? at, withdrawnAt: null, withdrawnReason: null, updatedAt: at }).where(eq(T.id, id));
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "release.publish", targetType: "release", targetId: id, severity: "notice", detail: { version: r.version, channel: r.channel, product: await productLabel(r, tx) } }, tx);
    await regenerateManifest(tx, "published " + r.version);
  });
  return finish(id, "release.published");
}

export async function unpublish(id: string, actor: Actor) {
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4242)`);
    const r = await getRelease(id, tx);
    if (r.status !== "published") throw new ApiError(409, "not_published", "Only a published release can be unpublished.");
    await tx.update(T).set({ status: "unpublished", updatedAt: new Date() }).where(eq(T.id, id));
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "release.unpublish", targetType: "release", targetId: id, severity: "notice", detail: { version: r.version } }, tx);
    await regenerateManifest(tx, "unpublished " + r.version);
  });
  return finish(id, "release.unpublished");
}

export async function withdraw(id: string, reason: string, actor: Actor) {
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4242)`);
    const r = await getRelease(id, tx);
    if (r.status === "draft" && !r.firstPublishedAt) throw new ApiError(409, "draft", "A draft was never public; delete it instead.");
    if (r.status === "withdrawn") throw new ApiError(409, "withdrawn", "Already withdrawn.");
    await tx.update(T).set({ status: "withdrawn", withdrawnAt: new Date(), withdrawnReason: reason, updatedAt: new Date() }).where(eq(T.id, id));
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "release.withdraw", targetType: "release", targetId: id, severity: "critical", detail: { version: r.version, reason } }, tx);
    await regenerateManifest(tx, "withdrew " + r.version);
  });
  return finish(id, "release.withdrawn");
}

/**
 * Makes an older, previously published release current again for its product and channel: the newer published
 * releases in that channel are unpublished (or withdrawn) and the target is re-published, all in one transaction.
 * Launchers never downgrade on their own (the updater only installs versions newer than the installed one).
 */
export async function rollback(currentId: string, targetId: string, opts: { withdrawCurrent: boolean; reason: string }, actor: Actor) {
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4242)`);
    const cur = await getRelease(currentId, tx), tgt = await getRelease(targetId, tx);
    if (cur.status !== "published") throw new ApiError(409, "not_published", "Roll back from the currently published release.");
    if (cur.moduleId !== tgt.moduleId || cur.channel !== tgt.channel) throw new ApiError(400, "mismatch", "The target must be the same product and channel.");
    if (compareVersions(tgt.version, cur.version) >= 0) throw new ApiError(400, "not_older", "The target must be an older version.");
    if (!tgt.firstPublishedAt || tgt.status === "withdrawn" || tgt.status === "draft") throw new ApiError(409, "not_approved", "Only a previously published, non-withdrawn release can be rolled back to.");
    if (opts.withdrawCurrent && opts.reason.trim().length < 4) throw new ApiError(400, "invalid_input", "Say why the current release is withdrawn.");
    // Every published release in this channel newer than the target stops being current.
    const sameProduct = cur.moduleId ? eq(T.moduleId, cur.moduleId) : isNull(T.moduleId);
    const newer = (await tx.select().from(T).where(and(sameProduct, eq(T.channel, cur.channel), eq(T.status, "published")))).filter((x) => compareVersions(x.version, tgt.version) > 0);
    const at = new Date();
    for (const n of newer) {
      const w = opts.withdrawCurrent && n.id === cur.id;
      await tx.update(T).set(w ? { status: "withdrawn", withdrawnAt: at, withdrawnReason: opts.reason, updatedAt: at } : { status: "unpublished", updatedAt: at }).where(eq(T.id, n.id));
    }
    await tx.update(T).set({ status: "published", publishedAt: tgt.publishedAt ?? at, updatedAt: at }).where(eq(T.id, tgt.id));
    // Retention must not hide the rollback target.
    if (!tgt.retained) await tx.update(T).set({ retained: true }).where(eq(T.id, tgt.id));
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "release.rollback", targetType: "release", targetId: tgt.id, severity: "critical", detail: { from: cur.version, to: tgt.version, channel: cur.channel, withdrewCurrent: opts.withdrawCurrent, reason: opts.reason, superseded: newer.map((n) => n.version) } }, tx);
    await regenerateManifest(tx, `rolled back ${cur.version} -> ${tgt.version}`);
  });
  return finish(targetId, "release.rolled_back");
}

/** Rebuilds the manifest from committed release rows and stores it with its signature. Runs inside the caller's transaction. */
export async function regenerateManifest(tx: Tx, reason: string) {
  const e = env();
  const mapRel = (r: R): MRelease => ({ id: r.id, version: r.version, channel: r.channel, summary: r.summary, notesMd: r.notesMd, changes: r.changes, publishedAt: r.publishedAt, minUpdaterVersion: r.minUpdaterVersion });
  const assetsOf = async (ids: string[]): Promise<MAsset[]> => ids.length ? (await tx.select().from(A).where(inArray(A.releaseId, ids))).map((a) => ({ id: a.id, releaseId: a.releaseId, kind: a.kind, platform: a.platform, arch: a.arch, filename: a.filename, size: a.size, sha256: a.sha256, mcVersion: a.mcVersion, loader: a.loader })) : [];
  const launcherRel = await tx.select().from(T).where(and(isNull(T.moduleId), eq(T.status, "published")));
  const [cm] = await tx.select().from(schema.modules).where(and(eq(schema.modules.isClientMod, true), eq(schema.modules.status, "published"))).orderBy(asc(schema.modules.createdAt)).limit(1);
  const cmRel = cm ? await tx.select().from(T).where(and(eq(T.moduleId, cm.id), eq(T.status, "published"))) : [];
  const withdrawnRows = await tx.select({ id: T.id, version: T.version, moduleId: T.moduleId }).from(T).where(eq(T.status, "withdrawn"));
  const wAssets = await assetsOf(withdrawnRows.map((w) => w.id));
  const manifest = buildManifest({
    origin: e.siteOrigin, generatedAt: new Date(),
    launcher: { releases: launcherRel.map(mapRel), assets: await assetsOf(launcherRel.map((r) => r.id)) },
    clientMod: cm ? { releases: cmRel.map(mapRel), assets: await assetsOf(cmRel.map((r) => r.id)) } : null,
    withdrawn: withdrawnRows.map((w) => ({ product: w.moduleId ? "module" : "launcher", version: w.version, sha256: wAssets.filter((a) => a.releaseId === w.id).map((a) => a.sha256) })),
  });
  const body = serialize(manifest);
  if (!e.signingKey && e.REQUIRE_SIGNED_MANIFEST && e.APP_ENV === "production") throw new ApiError(500, "signing", "The update manifest can't be signed: UPDATE_SIGNING_KEY isn't configured. Nothing was published.");
  const signature = e.signingKey ? signBytes(body, e.signingKey) : null;
  await tx.insert(schema.manifests).values({ body, sha256: sha256Hex(body), signature, reason });
  return { body, signature };
}

export async function latestManifest() {
  const [m] = await getDb().select().from(schema.manifests).orderBy(desc(schema.manifests.id)).limit(1);
  return m ?? null;
}
/** Re-runs the post-publication steps (manifest, caches, webhook) — the dashboard's "Retry sync" button. */
export async function resync(actor: Actor) {
  await getDb().transaction(async (tx) => { await tx.execute(sql`select pg_advisory_xact_lock(4242)`); await regenerateManifest(tx, "manual resync"); await audit({ actor: actor.name, ipHash: actor.ipHash, action: "system.resync", severity: "notice" }, tx); });
  return afterPublicChange({ type: "resync" });
}
