CREATE TYPE "public"."announcement_level" AS ENUM('info', 'success', 'warning', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."asset_kind" AS ENUM('installer', 'portable', 'package', 'disk_image', 'archive', 'mod_jar', 'module_package');--> statement-breakpoint
CREATE TYPE "public"."release_channel" AS ENUM('stable', 'beta', 'experimental');--> statement-breakpoint
CREATE TYPE "public"."checksum_source" AS ENUM('server', 'imported');--> statement-breakpoint
CREATE TYPE "public"."compat_status" AS ENUM('tested', 'partial', 'experimental', 'unsupported');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('icon', 'preview');--> statement-breakpoint
CREATE TYPE "public"."module_category" AS ENUM('hud', 'visuals', 'skies', 'emotes', 'cosmetics', 'utilities', 'experimental');--> statement-breakpoint
CREATE TYPE "public"."module_status" AS ENUM('draft', 'published', 'hidden', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('windows', 'linux', 'macos', 'any');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('draft', 'published', 'unpublished', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."audit_severity" AS ENUM('info', 'notice', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."storage_driver" AS ENUM('local', 's3', 'external');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"level" "announcement_level" DEFAULT 'info' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"release_id" uuid,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"platform" "platform" NOT NULL,
	"arch" text DEFAULT 'x64' NOT NULL,
	"filename" text NOT NULL,
	"size" bigint NOT NULL,
	"sha256" char(64) NOT NULL,
	"content_type" text NOT NULL,
	"storage" "storage_driver" NOT NULL,
	"storage_key" text,
	"external_url" text,
	"checksum_source" "checksum_source" DEFAULT 'server' NOT NULL,
	"signature_info" text,
	"mc_version" text,
	"loader" text,
	"validation" jsonb DEFAULT '{"checks":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_sha256_hex" CHECK ("assets"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "assets_location" CHECK (("assets"."storage" = 'external' and "assets"."external_url" is not null) or ("assets"."storage" <> 'external' and "assets"."storage_key" is not null)),
	CONSTRAINT "assets_size_positive" CHECK ("assets"."size" > 0)
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"ip_hash" text,
	"severity" "audit_severity" DEFAULT 'info' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ci_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" char(64) NOT NULL,
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "ci_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "compatibility" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"mc_version" text NOT NULL,
	"loader" text NOT NULL,
	"status" "compat_status" NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"name" text NOT NULL,
	"module_id" uuid,
	"version_range" text DEFAULT '' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "doc_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"section" text DEFAULT 'Guides' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"body_md" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doc_pages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "doc_slug_format" CHECK ("doc_pages"."slug" ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);
--> statement-breakpoint
CREATE TABLE "download_counts" (
	"asset_id" uuid NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "download_counts_asset_id_day_pk" PRIMARY KEY("asset_id","day")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text NOT NULL,
	"username_hash" text NOT NULL,
	"success" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manifests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"body" text NOT NULL,
	"sha256" char(64) NOT NULL,
	"signature" text,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "module_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"sha256" char(64) NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description_md" text DEFAULT '' NOT NULL,
	"category" "module_category" NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"install_md" text DEFAULT '' NOT NULL,
	"requirements_md" text DEFAULT '' NOT NULL,
	"known_issues_md" text DEFAULT '' NOT NULL,
	"author" text DEFAULT 'Auroras Client' NOT NULL,
	"docs_url" text,
	"source_url" text,
	"status" "module_status" DEFAULT 'draft' NOT NULL,
	"is_client_mod" boolean DEFAULT false NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modules_slug_unique" UNIQUE("slug"),
	CONSTRAINT "modules_slug_format" CHECK ("modules"."slug" ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"totp_last_step" bigint,
	"role" text DEFAULT 'owner' NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_role_owner" CHECK ("owners"."role" = 'owner')
);
--> statement-breakpoint
CREATE TABLE "owner_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid,
	"version" text NOT NULL,
	"channel" "release_channel" DEFAULT 'stable' NOT NULL,
	"status" "release_status" DEFAULT 'draft' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"notes_md" text DEFAULT '' NOT NULL,
	"changes" jsonb DEFAULT '{"added":[],"improved":[],"fixed":[],"breaking":[]}'::jsonb NOT NULL,
	"compat_notes" text DEFAULT '' NOT NULL,
	"min_updater_version" text,
	"retained" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'dashboard' NOT NULL,
	"published_at" timestamp with time zone,
	"first_published_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "releases_version_semver" CHECK ("releases"."version" ~ '^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$'),
	CONSTRAINT "releases_published_has_date" CHECK ("releases"."status" <> 'published' or "releases"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" char(64) PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"csrf_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text,
	"ip_hash" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compatibility" ADD CONSTRAINT "compatibility_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_counts" ADD CONSTRAINT "download_counts_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_media" ADD CONSTRAINT "module_media_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_recovery_codes" ADD CONSTRAINT "owner_recovery_codes_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_release_filename_uq" ON "assets" USING btree ("release_id","filename");--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_events" USING btree ("action","at");--> statement-breakpoint
CREATE UNIQUE INDEX "compat_release_mc_loader_uq" ON "compatibility" USING btree ("release_id","mc_version","loader");--> statement-breakpoint
CREATE INDEX "dependencies_release_idx" ON "dependencies" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("ip_hash","at");--> statement-breakpoint
CREATE INDEX "login_attempts_user_idx" ON "login_attempts" USING btree ("username_hash","at");--> statement-breakpoint
CREATE INDEX "module_media_module_idx" ON "module_media" USING btree ("module_id");--> statement-breakpoint
CREATE UNIQUE INDEX "owners_username_uq" ON "owners" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "owners_singleton_uq" ON "owners" USING btree ((true));--> statement-breakpoint
CREATE INDEX "recovery_owner_idx" ON "owner_recovery_codes" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "releases_launcher_version_uq" ON "releases" USING btree ("version") WHERE "releases"."module_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "releases_module_version_uq" ON "releases" USING btree ("module_id","version") WHERE "releases"."module_id" is not null;--> statement-breakpoint
CREATE INDEX "releases_status_idx" ON "releases" USING btree ("status","channel");--> statement-breakpoint
CREATE INDEX "sessions_owner_idx" ON "sessions" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");