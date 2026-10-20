import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { env } from "../env";
import { audit } from "../audit";
import { decrypt, keyedHash, safeEqual } from "../crypto";
import { verifyPassword } from "./password";
import { verifyTotp } from "./totp";
import { loginBlocked, recordAttempt } from "./ratelimit";
import { createSession } from "./session";

export const recoveryHash = (code: string) => keyedHash("recovery", code.replace(/[^A-Za-z0-9]/g, "").toUpperCase());
export type LoginResult = { ok: true; token: string; maxAge: number } | { ok: false; status: number; message: string; retryAfter?: number };
const GENERIC = "That username, password or code isn't right.";

export async function attemptLogin(input: { username: string; password: string; code: string }, meta: { ipHash: string; userAgent: string }): Promise<LoginResult> {
  const uHash = keyedHash("user", input.username.toLowerCase());
  const block = await loginBlocked(meta.ipHash, uHash);
  if (block.blocked) {
    await audit({ actor: "anonymous", action: "auth.login_blocked", severity: "warning", ipHash: meta.ipHash, detail: { retryAfterSec: block.retryAfterSec } });
    return { ok: false, status: 429, message: `Too many attempts. Try again in ${Math.ceil(block.retryAfterSec / 60)} minute(s).`, retryAfter: block.retryAfterSec };
  }
  const db = getDb();
  const [owner] = await db.select().from(schema.owners).where(sql`lower(${schema.owners.username}) = ${input.username.toLowerCase()}`).limit(1);
  const pwOk = await verifyPassword(owner?.passwordHash ?? null, input.password);
  let reason = !owner ? "unknown user" : !pwOk ? "wrong password" : owner.disabled ? "disabled" : "";
  let usedStep: number | null = null, usedRecovery: string | null = null;
  if (!reason && owner) {
    if (owner.totpEnabled && owner.totpSecretEnc) {
      const code = input.code.replace(/\s+/g, "");
      if (/^\d{6}$/.test(code)) { usedStep = verifyTotp(decrypt(owner.totpSecretEnc), code, owner.totpLastStep ?? null); if (usedStep === null) reason = "wrong or reused code"; }
      else if (code.length >= 12) {
        const h = recoveryHash(code);
        const codes = await db.select().from(schema.recoveryCodes).where(and(eq(schema.recoveryCodes.ownerId, owner.id), isNull(schema.recoveryCodes.usedAt)));
        const hit = codes.find((c) => safeEqual(c.codeHash, h));
        if (hit) usedRecovery = hit.id; else reason = "wrong recovery code";
      } else reason = "missing code";
    } else if (env().APP_ENV === "production") reason = "mfa not enrolled";
  }
  if (reason || !owner) {
    await recordAttempt(meta.ipHash, uHash, false);
    await audit({ actor: "anonymous", action: "auth.login_failed", severity: reason === "unknown user" || reason === "wrong password" ? "notice" : "warning", ipHash: meta.ipHash, detail: { reason } });
    const msg = reason === "mfa not enrolled" ? "Two-factor sign-in isn't set up for the owner. Run `npm run owner:reset-mfa` on the server." : GENERIC;
    return { ok: false, status: 401, message: msg };
  }
  await recordAttempt(meta.ipHash, uHash, true);
  if (usedRecovery) {
    await db.update(schema.recoveryCodes).set({ usedAt: new Date() }).where(eq(schema.recoveryCodes.id, usedRecovery));
    await audit({ actor: "owner:" + owner.username, action: "auth.recovery_code_used", severity: "critical", ipHash: meta.ipHash });
  }
  await db.update(schema.owners).set({ lastLoginAt: new Date(), ...(usedStep !== null ? { totpLastStep: usedStep } : {}) }).where(eq(schema.owners.id, owner.id));
  const s = await createSession(owner.id, meta);
  await audit({ actor: "owner:" + owner.username, action: "auth.login", severity: "info", ipHash: meta.ipHash, detail: { mfa: usedStep !== null ? "totp" : usedRecovery ? "recovery" : "none" } });
  return { ok: true, token: s.token, maxAge: s.maxAge };
}
