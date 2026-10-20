// RFC 6238 TOTP (SHA-1, 6 digits, 30 s), the scheme every authenticator app supports. No dependency needed.
import crypto from "node:crypto";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += ALPHA[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += ALPHA[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0, value = 0; const out: number[] = [];
  for (const ch of clean) { const i = ALPHA.indexOf(ch); if (i < 0) throw new Error("Invalid base32"); value = (value << 5) | i; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
export const generateTotpSecret = () => base32Encode(crypto.randomBytes(20));
export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", secret).update(msg).digest(), o = h[h.length - 1] & 15;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 10 ** digits).padStart(digits, "0");
}
export const totpStep = (ms = Date.now()) => Math.floor(ms / 1000 / 30);
export const totp = (secretB32: string, ms = Date.now()) => hotp(base32Decode(secretB32), totpStep(ms));
/**
 * Checks a code against the current step ±1 (clock drift). Returns the matched step, or null.
 * The caller stores the step and rejects any step <= the last one used, so a code can't be replayed.
 */
export function verifyTotp(secretB32: string, code: string, lastStep: number | null, ms = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32Decode(secretB32), now = totpStep(ms);
  for (const s of [now - 1, now, now + 1]) {
    const want = hotp(key, s);
    if (crypto.timingSafeEqual(Buffer.from(want), Buffer.from(code)) && (lastStep === null || s > lastStep)) return s;
  }
  return null;
}
export const otpauthUri = (secretB32: string, account: string, issuer = "Auroras Client") =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
