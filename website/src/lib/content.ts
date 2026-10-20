import "server-only";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { audit } from "./audit";
import { ApiError } from "./http";
import { afterPublicChange } from "./hooks";
import { regenerateManifest, type Actor } from "./releases";
import { storage, mediaKey } from "./storage";
import { discard, IMAGE_RULES, validateFile, type Received } from "./uploads";
import { parseSetting, SETTINGS, type SettingKey } from "./settings-schema";
import { randomToken, sha256Hex } from "./crypto";
import type { z } from "zod";
import type { announcementInput, docInput, moduleInput, moduleUpdate } from "./validation";

// Modules, site content, announcements, docs, sessions and CI tokens. Each change is validated, audited and, when it
// affects the public site, followed by cache invalidation.
const M = schema.modules;

export async function createModule(input: z.infer<typeof moduleInput>, actor: Actor) {
  const m = await getDb().transaction(async (tx) => {
    if (input.isClientMod) await assertSingleClientMod(tx, null);
    const [m] = await tx.insert(M).values({ ...input, docsUrl: input.docsUrl ?? null, sourceUrl: input.sourceUrl ?? null }).returning();
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "module.create", targetType: "module", targetId: m.id, detail: { slug: m.slug, status: m.status } }, tx);
    if (m.isClientMod && m.status === "published") await regenerateManifest(tx, "client mod module created");
    return m;
  });
  if (m.status === "published") await afterPublicChange({ type: "module.created" });
  return m;
}
async function assertSingleClientMod(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], exceptId: string | null) {
  const rows = await tx.select({ id: M.id }).from(M).where(and(eq(M.isClientMod, true), exceptId ? ne(M.id, exceptId) : sql`true`));
  if (rows.length) throw new ApiError(409, "conflict", "Another module is already marked as the Auroras client mod.");
}
export async function updateModule(id: string, input: z.infer<typeof moduleUpdate>, actor: Actor) {
  const m = await getDb().transaction(async (tx) => {
    const [cur] = await tx.select().from(M).where(eq(M.id, id));
    if (!cur) throw new ApiError(404, "not_found", "No such module.");
    if (input.isClientMod) await assertSingleClientMod(tx, id);
    const [m] = await tx.update(M).set({ ...input, ...(input.docsUrl !== undefined ? { docsUrl: input.docsUrl ?? null } : {}), ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl ?? null } : {}), updatedAt: new Date() }).where(eq(M.id, id)).returning();
    const statusChanged = input.status && input.status !== cur.status;
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: statusChanged ? "module.status" : "module.update", targetType: "module", targetId: id, severity: statusChanged ? "notice" : "info", detail: { slug: m.slug, fields: Object.keys(input), from: cur.status, to: m.status } }, tx);
    if (cur.isClientMod || m.isClientMod) await regenerateManifest(tx, "client mod module changed");
    return m;
  });
  await afterPublicChange({ type: "module.updated" });
  return m;
}
export async function deleteModule(id: string, actor: Actor) {
  const keys = await getDb().transaction(async (tx) => {
    const [cur] = await tx.select().from(M).where(eq(M.id, id));
    if (!cur) throw new ApiError(404, "not_found", "No such module.");
    const rel = await tx.select({ id: schema.releases.id }).from(schema.releases).where(eq(schema.releases.moduleId, id)).limit(1);
    if (rel.length) throw new ApiError(409, "has_releases", "This module has releases. Disable or hide it instead, so its history stays intact.");
    const media = await tx.select({ key: schema.moduleMedia.storageKey }).from(schema.moduleMedia).where(eq(schema.moduleMedia.moduleId, id));
    await tx.delete(M).where(eq(M.id, id));
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "module.delete", targetType: "module", targetId: id, severity: "notice", detail: { slug: cur.slug } }, tx);
    return media.map((x) => x.key);
  });
  const st = await storage(); for (const k of keys) await st.delete(k).catch(() => {});
  await afterPublicChange({ type: "module.deleted" });
}

export async function addModuleMedia(moduleId: string, kind: "icon" | "preview", alt: string, rec: Received, actor: Actor) {
  try {
    const [m] = await getDb().select().from(M).where(eq(M.id, moduleId));
    if (!m) throw new ApiError(404, "not_found", "No such module.");
    const ext = (rec.head[0] === 0x89 ? "png" : rec.head[0] === 0xff ? "jpg" : "webp");
    const v = validateFile("image." + ext, rec, IMAGE_RULES);
    if (!v.ok) {
      await audit({ actor: actor.name, ipHash: actor.ipHash, action: "media.upload_rejected", targetType: "module", targetId: moduleId, severity: "notice" });
      throw new ApiError(422, "invalid_file", "Only PNG, JPEG or WebP images are accepted.", { checks: v.checks });
    }
    const id = crypto.randomUUID(), key = mediaKey(id, ext), st = await storage();
    await st.putFile(key, rec.tmpPath, v.rule!.contentType);
    const row = await getDb().transaction(async (tx) => {
      if (kind === "icon") {
        const old = await tx.select().from(schema.moduleMedia).where(and(eq(schema.moduleMedia.moduleId, moduleId), eq(schema.moduleMedia.kind, "icon")));
        for (const o of old) { await tx.delete(schema.moduleMedia).where(eq(schema.moduleMedia.id, o.id)); await st.delete(o.storageKey).catch(() => {}); }
      }
      const [row] = await tx.insert(schema.moduleMedia).values({ id, moduleId, kind, storageKey: key, contentType: v.rule!.contentType, size: rec.size, sha256: rec.sha256, alt: alt.slice(0, 200) }).returning();
      await audit({ actor: actor.name, ipHash: actor.ipHash, action: "media.upload", targetType: "module", targetId: moduleId, detail: { kind, size: rec.size } }, tx);
      return row;
    });
    await afterPublicChange({ type: "module.updated" });
    return row;
  } finally { await discard(rec.tmpPath); }
}
export async function deleteModuleMedia(moduleId: string, mediaId: string, actor: Actor) {
  const [row] = await getDb().delete(schema.moduleMedia).where(and(eq(schema.moduleMedia.id, mediaId), eq(schema.moduleMedia.moduleId, moduleId))).returning();
  if (!row) throw new ApiError(404, "not_found", "No such image.");
  await (await storage()).delete(row.storageKey).catch(() => {});
  await audit({ actor: actor.name, ipHash: actor.ipHash, action: "media.delete", targetType: "module", targetId: moduleId });
  await afterPublicChange({ type: "module.updated" });
}

export async function readSettingForOwner<K extends SettingKey>(key: K) {
  const [row] = await getDb().select().from(schema.siteSettings).where(eq(schema.siteSettings.key, key));
  return parseSetting(key, row?.value);
}
export async function saveSetting(key: SettingKey, value: unknown, actor: Actor) {
  const parsed = (SETTINGS[key] as z.ZodTypeAny).parse(value);
  await getDb().transaction(async (tx) => {
    await tx.insert(schema.siteSettings).values({ key, value: parsed }).onConflictDoUpdate({ target: schema.siteSettings.key, set: { value: parsed, updatedAt: new Date() } });
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: "settings.update", targetType: "setting", targetId: key, severity: "notice" }, tx);
  });
  await afterPublicChange({ type: "settings.updated" });
  return parsed;
}

const toDate = (s: string | null | undefined) => (s ? new Date(s) : null);
export async function upsertAnnouncement(id: string | null, input: z.infer<typeof announcementInput>, actor: Actor) {
  const values = { ...input, startsAt: toDate(input.startsAt), endsAt: toDate(input.endsAt), updatedAt: new Date() };
  const row = await getDb().transaction(async (tx) => {
    const [row] = id ? await tx.update(schema.announcements).set(values).where(eq(schema.announcements.id, id)).returning() : await tx.insert(schema.announcements).values(values).returning();
    if (!row) throw new ApiError(404, "not_found", "No such announcement.");
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: id ? "announcement.update" : "announcement.create", targetType: "announcement", targetId: row.id, detail: { active: row.active } }, tx);
    return row;
  });
  await afterPublicChange({ type: "announcement" });
  return row;
}
export async function deleteAnnouncement(id: string, actor: Actor) {
  const [row] = await getDb().delete(schema.announcements).where(eq(schema.announcements.id, id)).returning();
  if (!row) throw new ApiError(404, "not_found", "No such announcement.");
  await audit({ actor: actor.name, ipHash: actor.ipHash, action: "announcement.delete", targetType: "announcement", targetId: id });
  await afterPublicChange({ type: "announcement" });
}
export async function upsertDoc(id: string | null, input: z.infer<typeof docInput>, actor: Actor) {
  const row = await getDb().transaction(async (tx) => {
    const [row] = id ? await tx.update(schema.docPages).set({ ...input, updatedAt: new Date() }).where(eq(schema.docPages.id, id)).returning() : await tx.insert(schema.docPages).values(input).returning();
    if (!row) throw new ApiError(404, "not_found", "No such page.");
    await audit({ actor: actor.name, ipHash: actor.ipHash, action: id ? "doc.update" : "doc.create", targetType: "doc", targetId: row.id, detail: { slug: row.slug, published: row.published } }, tx);
    return row;
  });
  await afterPublicChange({ type: "docs" });
  return row;
}
export async function deleteDoc(id: string, actor: Actor) {
  const [row] = await getDb().delete(schema.docPages).where(eq(schema.docPages.id, id)).returning();
  if (!row) throw new ApiError(404, "not_found", "No such page.");
  await audit({ actor: actor.name, ipHash: actor.ipHash, action: "doc.delete", targetType: "doc", targetId: id, detail: { slug: row.slug } });
  await afterPublicChange({ type: "docs" });
}

export async function createCiToken(name: string, scopes: string[], actor: Actor) {
  const token = "aur_ci_" + randomToken(32);
  const [row] = await getDb().insert(schema.ciTokens).values({ name, tokenHash: sha256Hex(token), scopes }).returning();
  await audit({ actor: actor.name, ipHash: actor.ipHash, action: "ci_token.create", targetType: "ci_token", targetId: row.id, severity: "notice", detail: { name, scopes } });
  return { token, row };
}
export async function revokeCiToken(id: string, actor: Actor) {
  const [row] = await getDb().update(schema.ciTokens).set({ revokedAt: new Date() }).where(and(eq(schema.ciTokens.id, id), isNull(schema.ciTokens.revokedAt))).returning();
  if (!row) throw new ApiError(404, "not_found", "No such active token.");
  await audit({ actor: actor.name, ipHash: actor.ipHash, action: "ci_token.revoke", targetType: "ci_token", targetId: id, severity: "notice", detail: { name: row.name } });
}
