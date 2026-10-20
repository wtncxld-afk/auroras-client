// Starts a production build (`next start`) against a throwaway database and storage directory, with a fresh owner
// account, so API and browser tests exercise the real server. Requires `next build` and a reachable PostgreSQL
// (TEST_DATABASE_URL, a database the tests may wipe). The database is wiped.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";

export const ROOT = path.resolve(process.cwd());
export const PORT = Number(process.env.TEST_PORT || 3100);
export const ORIGIN = `http://localhost:${PORT}`;
export const DB_URL = process.env.TEST_DATABASE_URL || "";
if (!DB_URL) throw new Error("Set TEST_DATABASE_URL to a PostgreSQL database the tests may wipe, e.g. postgres://user:pass@127.0.0.1:5432/auroras_test");
export const UA = "auroras-tests/1.0";
export const OWNER = { username: "owner-test", password: "correct horse battery staple 42" };

function b32decode(s: string) { const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const c of s.replace(/[\s=]/g, "")) bits += a.indexOf(c).toString(2).padStart(5, "0"); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); }
export function totpNow(secret: string, ms = Date.now()) { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(Math.floor(ms / 30000))); const h = crypto.createHmac("sha1", b32decode(secret)).update(b).digest(); const o = h[h.length - 1] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, "0"); }

type Env = Record<string, string | undefined>;
export type Ctx = { env: Env; totpSecret: string; recovery: string[]; publicKeyPem: string; storageDir: string; server: ChildProcess; sql: postgres.Sql; logs: string[] };

export async function start(opts: { releases?: boolean } = {}): Promise<Ctx> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "auroras-test-"));
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const env: Env = {
    PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    APP_ENV: "development", SITE_URL: ORIGIN, DATABASE_URL: DB_URL, DATABASE_SSL: "disable",
    AUTH_SECRET: crypto.randomBytes(32).toString("base64url"), DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
    STORAGE_DRIVER: "local", STORAGE_LOCAL_DIR: path.join(tmp, "storage"), MAX_UPLOAD_MB: "2", MAX_IMAGE_MB: "1",
    UPDATE_SIGNING_KEY: Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" }) as string).toString("base64"),
  };
  const sql = postgres(DB_URL, { max: 2, onnotice: () => {} });
  await sql.unsafe("drop schema if exists drizzle cascade; drop schema if exists public cascade; create schema public;");
  const run = (args: string[], extra: Env = {}) => {
    const r = spawnSync(process.execPath, args, { cwd: ROOT, env: { ...env, ...extra } as NodeJS.ProcessEnv, encoding: "utf8" });
    if (r.status !== 0) throw new Error(`${args.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
    return r.stdout;
  };
  run(["--import", "tsx", "scripts/migrate.ts"]);
  run(["--conditions=react-server", "--import", "tsx", "scripts/seed.ts", ...(opts.releases ? [] : ["--no-releases"])]);
  const out = run(["--conditions=react-server", "--import", "tsx", "scripts/owner.ts", "create", "--username", OWNER.username], { OWNER_PASSWORD: OWNER.password });
  const totpSecret = /Secret: ([A-Z2-7 ]+)/.exec(out)![1].replace(/ /g, "");
  const recovery = [...out.matchAll(/^\s+([A-Z0-9x]{4}-[A-Z0-9x]{4}-[A-Z0-9x]{4})$/gim)].map((m) => m[1]);
  // Next keeps unstable_cache entries on disk across restarts; clear them so a wiped database isn't masked by
  // pages cached from an earlier run.
  fs.rmSync(path.join(ROOT, ".next/cache/fetch-cache"), { recursive: true, force: true });
  const logs: string[] = [];
  const server = spawn(process.execPath, [path.join(ROOT, "node_modules/next/dist/bin/next"), "start", "-p", String(PORT)], { cwd: ROOT, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout!.on("data", (d) => logs.push(String(d))); server.stderr!.on("data", (d) => logs.push(String(d)));
  for (let i = 0; i < 120; i++) { try { const r = await fetch(ORIGIN + "/api/health"); if (r.ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
  return { env, totpSecret, recovery, publicKeyPem: publicKey.export({ type: "spki", format: "pem" }) as string, storageDir: path.join(tmp, "storage"), server, sql, logs };
}
export async function stop(c: Ctx) { c.server.kill("SIGTERM"); await c.sql.end(); }

/** A signed-in owner client: keeps the session cookie and sends the CSRF token and Origin like the dashboard does. */
export class Owner {
  cookie = ""; csrf = "";
  static async login(c: Ctx, code?: string) {
    const o = new Owner();
    const r = await fetch(ORIGIN + "/api/owner/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN, "User-Agent": UA }, body: JSON.stringify({ ...OWNER, code: code ?? c.recovery.shift() }) });
    if (r.status !== 200) throw new Error("login failed " + r.status + " " + (await r.text()));
    o.cookie = (r.headers.get("set-cookie") || "").split(";")[0];
    const page = await (await fetch(ORIGIN + "/owner", { headers: { Cookie: o.cookie, "User-Agent": UA } })).text();
    o.csrf = /<meta name="csrf-token" content="([^"]+)"/.exec(page)![1];
    return o;
  }
  req(p: string, init: { method?: string; json?: unknown; body?: BodyInit; headers?: Record<string, string> } = {}) {
    return fetch(ORIGIN + p, { method: init.method ?? (init.json !== undefined ? "POST" : "GET"), redirect: "manual", headers: { Cookie: this.cookie, "X-CSRF-Token": this.csrf, Origin: ORIGIN, "User-Agent": UA, ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers }, body: init.json !== undefined ? JSON.stringify(init.json) : init.body });
  }
  async j<T = any>(p: string, init: Parameters<Owner["req"]>[1] = {}, expect = [200, 201]): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const r = await this.req(p, init); const t = await r.text();
    if (!expect.includes(r.status)) throw new Error(`${init.method ?? "GET"} ${p} -> ${r.status} ${t}`);
    return (t ? JSON.parse(t) : null) as T;
  }
}

/** Minimal files whose magic bytes pass validation (contents are otherwise meaningless test data). */
export function fakeExe(extra = 1000) { const b = Buffer.concat([Buffer.alloc(256), crypto.randomBytes(extra)]); b.write("MZ", 0, "latin1"); b.writeUInt32LE(0x80, 0x3c); b.write("PE\0\0", 0x80, "latin1"); return b; }
export function fakeJar() { return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), crypto.randomBytes(500), Buffer.from("fabric.mod.json"), crypto.randomBytes(100)]); }
export const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
export const page = async (p: string) => (await fetch(ORIGIN + p, { headers: { "User-Agent": UA } })).text();
