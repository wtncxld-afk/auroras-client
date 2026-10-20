import { sql } from "drizzle-orm";
import {
  bigint, bigserial, boolean, char, check, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const now = (name: string) => ts(name).notNull().defaultNow();

export const channelEnum = pgEnum("release_channel", ["stable", "beta", "experimental"]);
export const releaseStatusEnum = pgEnum("release_status", ["draft", "published", "unpublished", "withdrawn"]);
export const platformEnum = pgEnum("platform", ["windows", "linux", "macos", "any"]);
export const assetKindEnum = pgEnum("asset_kind", ["installer", "portable", "package", "disk_image", "archive", "mod_jar", "module_package"]);
export const storageEnum = pgEnum("storage_driver", ["local", "s3", "external"]);
export const checksumSourceEnum = pgEnum("checksum_source", ["server", "imported"]);
export const compatStatusEnum = pgEnum("compat_status", ["tested", "partial", "experimental", "unsupported"]);
export const moduleStatusEnum = pgEnum("module_status", ["draft", "published", "hidden", "disabled"]);
export const moduleCategoryEnum = pgEnum("module_category", ["hud", "visuals", "skies", "emotes", "cosmetics", "utilities", "experimental"]);
export const announcementLevelEnum = pgEnum("announcement_level", ["info", "success", "warning", "maintenance"]);
export const severityEnum = pgEnum("audit_severity", ["info", "notice", "warning", "critical"]);
export const mediaKindEnum = pgEnum("media_kind", ["icon", "preview"]);

/** The single owner. A CHECK keeps role pinned to 'owner': there is no other role to promote to or from. */
export const owners = pgTable("owners", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  totpLastStep: bigint("totp_last_step", { mode: "number" }),
  role: text("role").notNull().default("owner"),
  disabled: boolean("disabled").notNull().default(false),
  passwordChangedAt: now("password_changed_at"),
  lastLoginAt: ts("last_login_at"),
  createdAt: now("created_at"),
}, (t) => [
  uniqueIndex("owners_username_uq").on(sql`lower(${t.username})`),
  check("owners_role_owner", sql`${t.role} = 'owner'`),
  // At most one owner row can ever exist.
  uniqueIndex("owners_singleton_uq").on(sql`(true)`),
]);

export const recoveryCodes = pgTable("owner_recovery_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => owners.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  usedAt: ts("used_at"),
  createdAt: now("created_at"),
}, (t) => [index("recovery_owner_idx").on(t.ownerId)]);

/** Server-side sessions. The id is the SHA-256 of the cookie token, so a database leak can't be replayed as a cookie. */
export const sessions = pgTable("sessions", {
  id: char("id", { length: 64 }).primaryKey(),
  ownerId: uuid("owner_id").notNull().references(() => owners.id, { onDelete: "cascade" }),
  csrfToken: text("csrf_token").notNull(),
  createdAt: now("created_at"),
  lastSeenAt: now("last_seen_at"),
  expiresAt: ts("expires_at").notNull(),
  revokedAt: ts("revoked_at"),
  revokeReason: text("revoke_reason"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
}, (t) => [index("sessions_owner_idx").on(t.ownerId), index("sessions_expires_idx").on(t.expiresAt)]);

export const loginAttempts = pgTable("login_attempts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: now("at"),
  ipHash: text("ip_hash").notNull(),
  usernameHash: text("username_hash").notNull(),
  success: boolean("success").notNull(),
}, (t) => [index("login_attempts_ip_idx").on(t.ipHash, t.at), index("login_attempts_user_idx").on(t.usernameHash, t.at)]);

/** Credentials for the release pipeline (CI). Scoped, hashed, revocable; they can never use owner routes. */
export const ciTokens = pgTable("ci_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tokenHash: char("token_hash", { length: 64 }).notNull().unique(),
  scopes: text("scopes").array().notNull(),
  createdAt: now("created_at"),
  lastUsedAt: ts("last_used_at"),
  revokedAt: ts("revoked_at"),
});

export const modules = pgTable("modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  descriptionMd: text("description_md").notNull().default(""),
  category: moduleCategoryEnum("category").notNull(),
  features: jsonb("features").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  installMd: text("install_md").notNull().default(""),
  requirementsMd: text("requirements_md").notNull().default(""),
  knownIssuesMd: text("known_issues_md").notNull().default(""),
  author: text("author").notNull().default("Auroras Client"),
  docsUrl: text("docs_url"),
  sourceUrl: text("source_url"),
  status: moduleStatusEnum("status").notNull().default("draft"),
  /** The Auroras Fabric mod itself: its releases feed the "client" list of the launcher's update manifest. */
  isClientMod: boolean("is_client_mod").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (t) => [check("modules_slug_format", sql`${t.slug} ~ '^[a-z0-9][a-z0-9-]{1,62}$'`)]);

export const moduleMedia = pgTable("module_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  kind: mediaKindEnum("kind").notNull(),
  storageKey: text("storage_key").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  sha256: char("sha256", { length: 64 }).notNull(),
  alt: text("alt").notNull().default(""),
  sort: integer("sort").notNull().default(0),
  createdAt: now("created_at"),
}, (t) => [index("module_media_module_idx").on(t.moduleId)]);

/** Launcher releases (moduleId null) and module releases share one table and one publishing workflow. */
export const releases = pgTable("releases", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id").references(() => modules.id, { onDelete: "restrict" }),
  version: text("version").notNull(),
  channel: channelEnum("channel").notNull().default("stable"),
  status: releaseStatusEnum("status").notNull().default("draft"),
  title: text("title").notNull().default(""),
  summary: text("summary").notNull().default(""),
  notesMd: text("notes_md").notNull().default(""),
  changes: jsonb("changes").$type<{ added: string[]; improved: string[]; fixed: string[]; breaking: string[] }>().notNull()
    .default(sql`'{"added":[],"improved":[],"fixed":[],"breaking":[]}'::jsonb`),
  compatNotes: text("compat_notes").notNull().default(""),
  minUpdaterVersion: text("min_updater_version"),
  retained: boolean("retained").notNull().default(true),
  source: text("source").notNull().default("dashboard"),
  publishedAt: ts("published_at"),
  firstPublishedAt: ts("first_published_at"),
  withdrawnAt: ts("withdrawn_at"),
  withdrawnReason: text("withdrawn_reason"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
}, (t) => [
  uniqueIndex("releases_launcher_version_uq").on(t.version).where(sql`${t.moduleId} is null`),
  uniqueIndex("releases_module_version_uq").on(t.moduleId, t.version).where(sql`${t.moduleId} is not null`),
  index("releases_status_idx").on(t.status, t.channel),
  check("releases_version_semver", sql`${t.version} ~ '^[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z.-]+)?$'`),
  check("releases_published_has_date", sql`${t.status} <> 'published' or ${t.publishedAt} is not null`),
]);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id").notNull().references(() => releases.id, { onDelete: "cascade" }),
  kind: assetKindEnum("kind").notNull(),
  platform: platformEnum("platform").notNull(),
  arch: text("arch").notNull().default("x64"),
  filename: text("filename").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  sha256: char("sha256", { length: 64 }).notNull(),
  contentType: text("content_type").notNull(),
  storage: storageEnum("storage").notNull(),
  storageKey: text("storage_key"),
  externalUrl: text("external_url"),
  checksumSource: checksumSourceEnum("checksum_source").notNull().default("server"),
  signatureInfo: text("signature_info"),
  mcVersion: text("mc_version"),
  loader: text("loader"),
  validation: jsonb("validation").$type<{ checks: { name: string; ok: boolean; detail?: string }[] }>().notNull().default(sql`'{"checks":[]}'::jsonb`),
  createdAt: now("created_at"),
}, (t) => [
  uniqueIndex("assets_release_filename_uq").on(t.releaseId, t.filename),
  check("assets_sha256_hex", sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
  check("assets_location", sql`(${t.storage} = 'external' and ${t.externalUrl} is not null) or (${t.storage} <> 'external' and ${t.storageKey} is not null)`),
  check("assets_size_positive", sql`${t.size} > 0`),
]);

export const compatibility = pgTable("compatibility", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id").notNull().references(() => releases.id, { onDelete: "cascade" }),
  mcVersion: text("mc_version").notNull(),
  loader: text("loader").notNull(),
  status: compatStatusEnum("status").notNull(),
  notes: text("notes").notNull().default(""),
}, (t) => [uniqueIndex("compat_release_mc_loader_uq").on(t.releaseId, t.mcVersion, t.loader)]);

export const dependencies = pgTable("dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id").notNull().references(() => releases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
  versionRange: text("version_range").notNull().default(""),
  required: boolean("required").notNull().default(true),
  url: text("url"),
}, (t) => [index("dependencies_release_idx").on(t.releaseId)]);

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull().default(""),
  level: announcementLevelEnum("level").notNull().default("info"),
  active: boolean("active").notNull().default(false),
  releaseId: uuid("release_id").references(() => releases.id, { onDelete: "set null" }),
  startsAt: ts("starts_at"),
  endsAt: ts("ends_at"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at"),
});

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: now("updated_at"),
});

export const docPages = pgTable("doc_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  section: text("section").notNull().default("Guides"),
  summary: text("summary").notNull().default(""),
  bodyMd: text("body_md").notNull().default(""),
  sort: integer("sort").notNull().default(0),
  published: boolean("published").notNull().default(false),
  updatedAt: now("updated_at"),
}, (t) => [check("doc_slug_format", sql`${t.slug} ~ '^[a-z0-9][a-z0-9-]{1,62}$'`)]);

export const auditEvents = pgTable("audit_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: now("at"),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  ipHash: text("ip_hash"),
  severity: severityEnum("severity").notNull().default("info"),
  detail: jsonb("detail").notNull().default(sql`'{}'::jsonb`),
}, (t) => [index("audit_at_idx").on(t.at), index("audit_action_idx").on(t.action, t.at)]);

/** Privacy-conscious download counting: one counter per file per day. No IPs, no user agents, no identifiers. */
export const downloadCounts = pgTable("download_counts", {
  assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  day: date("day", { mode: "string" }).notNull(),
  count: integer("count").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.assetId, t.day] })]);

/** Every generated launcher update manifest, exactly as served and signed. The newest row is the live one. */
export const manifests = pgTable("manifests", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  createdAt: now("created_at"),
  body: text("body").notNull(),
  sha256: char("sha256", { length: 64 }).notNull(),
  signature: text("signature"),
  reason: text("reason").notNull(),
});
