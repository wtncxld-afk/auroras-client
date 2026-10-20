import "server-only";
import crypto from "node:crypto";
import { z } from "zod";

/**
 * Server configuration, validated once on first use (never at build time, so `next build` needs no secrets).
 * Nothing here is exposed to the browser: only NEXT_PUBLIC_* variables reach client bundles, and none are used.
 */
const bool = (def: boolean) => z.enum(["true", "false", "1", "0"]).optional().transform((v) => (v === undefined ? def : v === "true" || v === "1"));
const schema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  SITE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(["require", "prefer", "disable"]).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  DATA_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, "base64").length === 32, "DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded"),
  SESSION_TTL_HOURS: z.coerce.number().min(1).max(72).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().min(5).max(1440).default(120),
  TRUST_PROXY_HEADERS: bool(false),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool(false),
  DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(4096).default(512),
  MAX_IMAGE_MB: z.coerce.number().int().min(1).max(25).default(5),
  EXTERNAL_ASSET_HOSTS: z.string().default("github.com"),
  UPDATE_SIGNING_KEY: z.string().optional(),
  REQUIRE_SIGNED_MANIFEST: bool(true),
  RELEASE_WEBHOOK_URL: z.string().url().optional(),
  RELEASE_WEBHOOK_SECRET: z.string().min(16).optional(),
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof schema> & { siteOrigin: string; signingKey: crypto.KeyObject | null; publicKeyPem: string | null; externalHosts: string[] };
let cached: Env | null = null;

/** Accepts a PEM (literal newlines or "\n" escapes) or the PEM base64-encoded once, as CI secrets often are. */
export function parseSigningKey(raw: string | undefined): crypto.KeyObject | null {
  if (!raw || !raw.trim()) return null;
  let pem = raw.trim().replace(/\\n/g, "\n");
  if (!pem.includes("BEGIN")) pem = Buffer.from(pem, "base64").toString("utf8");
  const key = crypto.createPrivateKey(pem);
  if (key.asymmetricKeyType !== "ed25519") throw new Error("UPDATE_SIGNING_KEY must be an Ed25519 private key (scripts/gen-update-keys.js)");
  return key;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = schema.safeParse(source);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error("Invalid server configuration: " + issues);
  }
  const e = r.data;
  const problems: string[] = [];
  const site = new URL(e.SITE_URL);
  let signingKey: crypto.KeyObject | null = null;
  try { signingKey = parseSigningKey(e.UPDATE_SIGNING_KEY); } catch (x) { problems.push("UPDATE_SIGNING_KEY: " + (x as Error).message); }
  if (e.APP_ENV === "production") {
    if (site.protocol !== "https:") problems.push("SITE_URL must use https in production");
    if (e.DATABASE_SSL === "disable") problems.push("DATABASE_SSL=disable is not allowed in production");
    if (e.REQUIRE_SIGNED_MANIFEST && !signingKey) problems.push("UPDATE_SIGNING_KEY is required in production (or set REQUIRE_SIGNED_MANIFEST=false deliberately)");
    if (/change-me|example|placeholder/i.test(e.AUTH_SECRET)) problems.push("AUTH_SECRET still has its placeholder value");
  }
  if (e.STORAGE_DRIVER === "s3") for (const k of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) if (!e[k]) problems.push(`${k} is required when STORAGE_DRIVER=s3`);
  if (e.RELEASE_WEBHOOK_URL && !e.RELEASE_WEBHOOK_SECRET) problems.push("RELEASE_WEBHOOK_SECRET is required with RELEASE_WEBHOOK_URL");
  if (e.RELEASE_WEBHOOK_URL && new URL(e.RELEASE_WEBHOOK_URL).protocol !== "https:") problems.push("RELEASE_WEBHOOK_URL must be https");
  if (problems.length) throw new Error("Invalid server configuration: " + problems.join("; "));
  const publicKeyPem = signingKey ? (crypto.createPublicKey(signingKey).export({ type: "spki", format: "pem" }) as string) : null;
  return { ...e, siteOrigin: site.origin, signingKey, publicKeyPem, externalHosts: e.EXTERNAL_ASSET_HOSTS.split(",").map((h) => h.trim().toLowerCase()).filter(Boolean) };
}

export function env(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}
/** Tests only: forget the cached configuration. */
export function resetEnvForTests() { cached = null; }
