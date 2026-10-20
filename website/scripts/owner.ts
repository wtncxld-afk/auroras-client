// Owner provisioning and recovery. Runs on the server (shell access is the recovery factor); there is no web sign-up.
//   npm run owner:create -- --username <name>        create the single owner (password prompted, TOTP enrolled)
//   npm run owner:reset-password -- --username <name> set a new password; signs out every session
//   npm run owner:reset-mfa                            new TOTP secret and recovery codes; signs out every session
//   npm run owner:revoke-sessions                      sign out everywhere
//   npm run ci-token:create -- --name <name> [--allow-publish]   token for the release pipeline (shown once)
// For automation, OWNER_PASSWORD can supply the password instead of the prompt.
import readline from "node:readline";
import { eq, sql } from "drizzle-orm";
import { getDb, schema, closeDb } from "@/db";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { generateTotpSecret, otpauthUri } from "@/lib/auth/totp";
import { encrypt, randomToken } from "@/lib/crypto";
import { recoveryHash } from "@/lib/auth/login";
import { revokeAllSessions } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { createCiToken } from "@/lib/content";

const args = process.argv.slice(2), cmd = args[0];
const opt = (n: string) => { const i = args.indexOf("--" + n); return i > 0 ? args[i + 1] : undefined; };
async function askHidden(q: string): Promise<string> {
  if (process.env.OWNER_PASSWORD) return process.env.OWNER_PASSWORD;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  let muted = false; out._writeToOutput = (s: string) => { if (!muted) out.output.write(s); };
  return new Promise((res) => { rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); res(a); }); muted = true; });
}
async function newPassword() {
  const pw = await askHidden("New owner password: ");
  const p = passwordProblem(pw); if (p) throw new Error(p);
  if (!process.env.OWNER_PASSWORD && (await askHidden("Repeat it: ")) !== pw) throw new Error("The passwords don't match.");
  return pw;
}
async function enrollMfa(ownerId: string, username: string) {
  const secret = generateTotpSecret();
  const codes = Array.from({ length: 10 }, () => randomToken(9).replace(/[^A-Za-z0-9]/g, "x").toUpperCase().slice(0, 12).replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3"));
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.update(schema.owners).set({ totpSecretEnc: encrypt(secret), totpEnabled: true, totpLastStep: null }).where(eq(schema.owners.id, ownerId));
    await tx.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.ownerId, ownerId));
    await tx.insert(schema.recoveryCodes).values(codes.map((c) => ({ ownerId, codeHash: recoveryHash(c) })));
  });
  console.log("\nAdd this account to your authenticator app (scan or paste the URI):\n  " + otpauthUri(secret, username));
  console.log("  Secret: " + secret.replace(/(.{4})/g, "$1 ").trim());
  console.log("\nRecovery codes (each works once instead of a code; store them offline):");
  for (const c of codes) console.log("  " + c);
}
async function owner(username?: string) {
  const db = getDb();
  const [o] = username ? await db.select().from(schema.owners).where(sql`lower(${schema.owners.username}) = ${username.toLowerCase()}`) : await db.select().from(schema.owners).limit(1);
  if (!o) throw new Error("No owner found" + (username ? " named " + username : "") + ".");
  return o;
}
async function main() {
  const db = getDb();
  if (cmd === "create") {
    const username = opt("username");
    if (!username || !/^[A-Za-z0-9._-]{3,64}$/.test(username)) throw new Error("Give --username (3-64 letters, digits, . _ -).");
    const [existing] = await db.select({ id: schema.owners.id }).from(schema.owners).limit(1);
    if (existing) throw new Error("An owner already exists. There can only be one; use owner:reset-password or owner:reset-mfa.");
    const [o] = await db.insert(schema.owners).values({ username, passwordHash: await hashPassword(await newPassword()) }).returning();
    await enrollMfa(o.id, username);
    await audit({ actor: "cli", action: "owner.create", severity: "critical", detail: { username } });
    console.log("\nOwner created. Sign in at /owner/login.");
  } else if (cmd === "reset-password") {
    const o = await owner(opt("username"));
    await db.update(schema.owners).set({ passwordHash: await hashPassword(await newPassword()), passwordChangedAt: new Date() }).where(eq(schema.owners.id, o.id));
    await revokeAllSessions(o.id, "password reset");
    await db.delete(schema.loginAttempts);
    await audit({ actor: "cli", action: "owner.password_reset", severity: "critical" });
    console.log("Password changed. All sessions were signed out and sign-in limits cleared.");
  } else if (cmd === "reset-mfa") {
    const o = await owner(opt("username"));
    await enrollMfa(o.id, o.username); await revokeAllSessions(o.id, "mfa reset");
    await audit({ actor: "cli", action: "owner.mfa_reset", severity: "critical" });
    console.log("\nTwo-factor sign-in was reset. All sessions were signed out.");
  } else if (cmd === "revoke-sessions") {
    const o = await owner(opt("username")); await revokeAllSessions(o.id, "revoked from CLI");
    await audit({ actor: "cli", action: "auth.sessions_revoked", severity: "notice" }); console.log("All sessions signed out.");
  } else if (cmd === "ci-token") {
    const name = opt("name"); if (!name) throw new Error("Give --name.");
    const { token, row } = await createCiToken(name, args.includes("--allow-publish") ? ["releases:draft", "releases:publish"] : ["releases:draft"], { name: "cli" });
    console.log("CI token (shown once; store it as the AURORAS_SITE_CI_TOKEN secret):\n  " + token + "\nScopes: " + row.scopes.join(", "));
  } else {
    console.log("Commands: create, reset-password, reset-mfa, revoke-sessions, ci-token"); process.exitCode = 2;
  }
}
main().then(closeDb).catch(async (e) => { console.error("Error:", e.message); await closeDb(); process.exit(1); });
