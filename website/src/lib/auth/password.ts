import "server-only";
import { hash, verify } from "@node-rs/argon2";

// argon2id with OWASP's recommended minimum (19 MiB, 2 iterations, 1 lane). Algorithm 2 = Argon2id.
const OPTS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;
export const MIN_PASSWORD_LENGTH = 14;
export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (pw.length > 256) return "Use at most 256 characters.";
  if (new Set(pw).size < 6) return "Use a less repetitive password.";
  return null;
}
export const hashPassword = (pw: string) => hash(pw, OPTS);
// Verified against when the username is unknown, so both paths take the same time.
let dummy: Promise<string> | null = null;
export async function verifyPassword(stored: string | null, pw: string): Promise<boolean> {
  if (!stored) { dummy ??= hash("not-a-real-password-" + Math.random(), OPTS); await verify(await dummy, pw).catch(() => false); return false; }
  try { return await verify(stored, pw); } catch { return false; }
}
