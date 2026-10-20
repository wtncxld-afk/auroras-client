import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { loadEnv, parseSigningKey } from "../../src/lib/env";
import { classify } from "../../src/lib/importer";

const base = { DATABASE_URL: "postgres://u:p@localhost/db", AUTH_SECRET: "x".repeat(40), DATA_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"), SITE_URL: "http://localhost:3000" };
const key = () => crypto.generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }) as string;
test("development config loads", () => { assert.equal(loadEnv({ ...base } as unknown as NodeJS.ProcessEnv).APP_ENV, "development"); });
test("production refuses http, missing signing key, placeholder secrets", () => {
  const prod = { ...base, APP_ENV: "production", SITE_URL: "https://auroras.example", UPDATE_SIGNING_KEY: key() };
  assert.ok(loadEnv(prod as unknown as NodeJS.ProcessEnv).signingKey);
  assert.throws(() => loadEnv({ ...prod, SITE_URL: "http://auroras.example" } as unknown as NodeJS.ProcessEnv), /https/);
  assert.throws(() => loadEnv({ ...prod, UPDATE_SIGNING_KEY: "" } as unknown as NodeJS.ProcessEnv), /UPDATE_SIGNING_KEY/);
  assert.throws(() => loadEnv({ ...prod, AUTH_SECRET: "change-me-change-me-change-me-change-me" } as unknown as NodeJS.ProcessEnv), /placeholder/);
  assert.throws(() => loadEnv({ ...base, AUTH_SECRET: "short" } as unknown as NodeJS.ProcessEnv));
});
test("signing key: PEM, escaped PEM and base64 PEM; only Ed25519", () => {
  const pem = key();
  assert.ok(parseSigningKey(pem)); assert.ok(parseSigningKey(pem.replace(/\n/g, "\\n"))); assert.ok(parseSigningKey(Buffer.from(pem).toString("base64")));
  const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  assert.throws(() => parseSigningKey(rsa));
  assert.equal(parseSigningKey(""), null);
});
test("importer classifies commit subjects", () => {
  const c = classify(["Add Modrinth import", "Fix crash on start", "HUD redesign", "Merge branch 'x'"]);
  assert.deepEqual(c.added, ["Add Modrinth import"]); assert.deepEqual(c.fixed, ["Fix crash on start"]); assert.ok(c.improved.includes("HUD redesign"));
});
