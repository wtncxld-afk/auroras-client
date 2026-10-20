import "server-only";
import crypto from "node:crypto";
import { env } from "./env";

export const sha256Hex = (data: crypto.BinaryLike) => crypto.createHash("sha256").update(data).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
/** Keyed hash for values we must compare but should not store readably (IPs, usernames in rate-limit rows). */
export const keyedHash = (purpose: string, value: string) => crypto.createHmac("sha256", env().AUTH_SECRET).update(purpose + "\0" + value).digest("hex").slice(0, 32);
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
/** AES-256-GCM with DATA_ENCRYPTION_KEY, for secrets the server must read back (the owner's TOTP seed). */
export function encrypt(plain: string): string {
  const key = Buffer.from(env().DATA_ENCRYPTION_KEY, "base64"), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv), body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}
export function decrypt(sealed: string): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1") throw new Error("Unknown encryption format");
  const d = crypto.createDecipheriv("aes-256-gcm", Buffer.from(env().DATA_ENCRYPTION_KEY, "base64"), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}
