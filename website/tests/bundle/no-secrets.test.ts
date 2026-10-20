import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Everything under .next/static is sent to browsers. It must not contain server secrets, their env names, database
// URLs or key material. Run after `next build`. Values from a local .env.local (if present) are checked too.
const STATIC = path.join(process.cwd(), ".next/static");
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

test("client bundles contain no secrets", () => {
  assert.ok(fs.existsSync(STATIC), "run `next build` first");
  const files = walk(STATIC).filter((f) => /\.(js|css|json|map|txt|html)$/.test(f));
  assert.ok(files.length > 10);
  const names = ["AUTH_SECRET", "DATA_ENCRYPTION_KEY", "UPDATE_SIGNING_KEY", "DATABASE_URL", "S3_SECRET_ACCESS_KEY", "S3_ACCESS_KEY_ID", "RELEASE_WEBHOOK_SECRET", "CLOUDFLARE_API_TOKEN"];
  const patterns = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /postgres(ql)?:\/\/[^"'\s]+@/, /aur_ci_[A-Za-z0-9_-]{43}/, /argon2id\$/];
  const values: string[] = [];
  const envFile = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.+)$/.exec(line.trim()); if (m && names.includes(m[1]) && m[2].length >= 12) values.push(m[2].replace(/^["']|["']$/g, "")); }
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8"), rel = path.relative(process.cwd(), f);
    for (const n of names) assert.ok(!src.includes(n), `${rel} mentions ${n}`);
    for (const p of patterns) assert.ok(!p.test(src), `${rel} matches ${p}`);
    for (const v of values) assert.ok(!src.includes(v.slice(0, 24)), `${rel} contains a configured secret value`);
  }
});
test("no server-only modules are bundled for the browser", () => {
  const all = walk(STATIC).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(f, "utf8")).join("\n");
  for (const marker of ["@node-rs/argon2", "drizzle-orm/pg-core", "pg_advisory_xact_lock", "createCipheriv"]) assert.ok(!all.includes(marker), marker);
});
