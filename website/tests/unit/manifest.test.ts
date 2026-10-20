import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { buildManifest, serialize, signBytes, type MAsset, type MRelease } from "../../src/lib/manifest-core";
const updater = createRequire(import.meta.url)("../../../updater.js");

const rel = (id: string, version: string, channel: MRelease["channel"]): MRelease => ({ id, version, channel, summary: `Release ${version}`, notesMd: "", changes: { added: ["A"], improved: [], fixed: ["F"], breaking: [] }, publishedAt: new Date("2026-10-01T00:00:00Z"), minUpdaterVersion: null });
const asset = (id: string, releaseId: string, filename: string, kind = "installer", extra: Partial<MAsset> = {}): MAsset => ({ id, releaseId, kind, platform: "windows", arch: "x64", filename, size: 100, sha256: crypto.createHash("sha256").update(id).digest("hex"), mcVersion: null, loader: null, ...extra });
const origin = "https://auroras.example";
const input = () => ({
  origin, generatedAt: new Date("2026-10-20T00:00:00Z"),
  launcher: { releases: [rel("r1", "0.1.8", "stable"), rel("r2", "0.1.9", "stable"), rel("r3", "0.2.0-beta.1", "beta"), rel("r4", "0.3.0", "experimental")], assets: [asset("a1", "r1", "AurorasClientSetup-0.1.8.exe"), asset("a2", "r2", "AurorasClientSetup-0.1.9.exe"), asset("a3", "r3", "AurorasClientSetup-0.2.0-beta.1.exe"), asset("a4", "r4", "AurorasClientSetup-0.3.0.exe")] },
  clientMod: { releases: [rel("m1", "0.1.9", "stable")], assets: [asset("j1", "m1", "auroras-0.1.9-mc1.21.11.jar", "mod_jar", { platform: "any", mcVersion: "1.21.11", loader: "fabric" }), asset("j2", "m1", "auroras-0.1.9-mc26.3.jar", "mod_jar", { platform: "any", mcVersion: "26.3", loader: "fabric" })] },
  withdrawn: [],
});

test("manifest is schema 1, signed, and verifies with the launcher's updater.js", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const body = serialize(buildManifest(input()));
  const sig = signBytes(body, privateKey);
  const pem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const m = updater.verifyManifest(Buffer.from(body), sig, pem);
  assert.equal(m.schema, 1);
  assert.throws(() => updater.verifyManifest(Buffer.from(body.replace("0.1.9", "0.1.7")), sig, pem));
  const other = crypto.generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" });
  assert.throws(() => updater.verifyManifest(Buffer.from(body), sig, other));
});
test("updater selects the newest stable launcher; preview channel gets beta; experimental never offered", () => {
  const m = buildManifest(input());
  const s = updater.selectLauncherUpdate(m, "0.1.8", "stable");
  assert.equal(s.version, "0.1.9");
  assert.equal(s.url, `${origin}/api/download/a2`);
  assert.match(s.sha256, /^[0-9a-f]{64}$/);
  assert.equal(updater.selectLauncherUpdate(m, "0.1.8", "preview").version, "0.2.0-beta.1");
  assert.equal(updater.selectLauncherUpdate(m, "0.1.9", "stable"), null);
  assert.equal(m.launcher.experimental && (m.launcher.experimental as { version: string }).version, "0.3.0");
});
test("missing channels are omitted, not empty (updater would reject {})", () => {
  const i = input(); i.launcher.releases = i.launcher.releases.filter((r) => r.channel === "stable");
  const m = buildManifest(i);
  assert.deepEqual(Object.keys(m.launcher).sort(), ["stable"]);
  assert.equal(updater.selectLauncherUpdate(m, "0.0.1", "preview").version, "0.1.9");
  const none = buildManifest({ ...i, launcher: { releases: [], assets: [] } });
  assert.deepEqual(none.launcher, {});
  assert.equal(updater.selectLauncherUpdate(none, "0.0.1", "stable"), null);
});
test("a release without a Windows installer is skipped for the launcher entry", () => {
  const i = input(); i.launcher.assets = i.launcher.assets.filter((a) => a.id !== "a2");
  assert.equal(buildManifest(i).launcher.stable && (buildManifest(i).launcher.stable as { version: string }).version, "0.1.8");
});
test("client builds are selected per Minecraft version by the launcher", () => {
  const m = buildManifest(input());
  const b = updater.selectClientBuild(m, { mc: "26.3", loader: "fabric", channel: "stable", installed: "0.1.8" });
  assert.equal(b.status, "available"); assert.equal(b.build.url, `${origin}/api/download/j2`);
  assert.equal(updater.selectClientBuild(m, { mc: "1.20.1", loader: "fabric", channel: "stable" }).status, "unsupported");
  assert.equal(updater.selectClientBuild(m, { mc: "1.21.11", loader: "fabric", channel: "stable", installed: "0.1.9" }).status, "up-to-date");
});
test("all URLs are https and serialization is deterministic", () => {
  const a = serialize(buildManifest(input())), b = serialize(buildManifest(input()));
  assert.equal(a, b);
  for (const u of a.match(/"url": "[^"]+"/g) ?? []) assert.match(u, /"https:\/\//);
  assert.ok(a.endsWith("\n"));
});
