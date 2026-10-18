const test = require("node:test"), assert = require("node:assert"), crypto = require("crypto"), fs = require("fs"), os = require("os"), path = require("path");
const u = require("../updater.js");

test("version comparison follows semver precedence", () => {
  const lt = (a, b) => assert.strictEqual(u.compareVersions(a, b), -1, `${a} < ${b}`);
  lt("1.0.0", "1.0.1"); lt("1.9.0", "1.10.0"); lt("0.9.9", "1.0.0"); lt("1.0.0-preview.2", "1.0.0"); lt("1.0.0-preview.2", "1.0.0-preview.10"); lt("1.0.0-alpha", "1.0.0-beta");
  assert.strictEqual(u.compareVersions("2.0.0", "2.0.0"), 0); assert.strictEqual(u.compareVersions("2.0.0+build5", "2.0.0"), 0);
  assert.throws(() => u.compareVersions("banana", "1.0.0"));
});

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const pub = publicKey.export({ type: "spki", format: "pem" });
const manifestObj = { schema: 1, launcher: { stable: { version: "1.2.0", url: "https://example.com/l.exe", sha256: "a".repeat(64), notes: "n" }, preview: { version: "1.3.0-preview.1", url: "https://example.com/p.exe", sha256: "b".repeat(64) } },
  client: [{ version: "1.0.0", mc: "1.21.4", loader: "fabric", channel: "stable", url: "https://example.com/c1.jar", sha256: "c".repeat(64) }, { version: "1.1.0", mc: "1.21.4", loader: "fabric", channel: "stable", url: "https://example.com/c2.jar", sha256: "d".repeat(64) },
    { version: "1.2.0-preview.1", mc: "1.21.4", loader: "fabric", channel: "preview", url: "https://example.com/c3.jar", sha256: "e".repeat(64) }, { version: "9.0.0", mc: "1.20.1", loader: "fabric", channel: "stable", url: "https://example.com/c4.jar", sha256: "f".repeat(64) }] };
const bytes = Buffer.from(JSON.stringify(manifestObj)), sig = crypto.sign(null, bytes, privateKey).toString("base64");

test("signed manifest verifies; tampering and wrong keys are rejected", () => {
  assert.strictEqual(u.verifyManifest(bytes, sig, pub).schema, 1);
  assert.throws(() => u.verifyManifest(Buffer.from(bytes.toString().replace("1.2.0", "9.9.9")), sig, pub), /signature/);
  assert.throws(() => u.verifyManifest(bytes, sig, crypto.generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" })), /signature/);
  assert.throws(() => u.verifyManifest(bytes, "AAAA", pub));
});
test("integrity check accepts the right hash only", () => {
  const b = Buffer.from("hello"); assert.ok(u.verifyBytes(b, u.sha256(b)));
  assert.throws(() => u.verifyBytes(b, "0".repeat(64)), /integrity/); assert.throws(() => u.verifyBytes(b, "xyz"), /valid sha256/);
});
test("launcher update selection by channel", () => {
  assert.strictEqual(u.selectLauncherUpdate(manifestObj, "1.1.0", "stable").version, "1.2.0");
  assert.strictEqual(u.selectLauncherUpdate(manifestObj, "1.2.0", "stable"), null);
  assert.strictEqual(u.selectLauncherUpdate(manifestObj, "1.2.0", "preview").version, "1.3.0-preview.1");
  assert.strictEqual(u.selectLauncherUpdate(manifestObj, "1.3.0-preview.1", "preview"), null);
  const bad = { launcher: { stable: { version: "9.0.0", url: "http://insecure.example/x.exe", sha256: "a".repeat(64) } } };
  assert.throws(() => u.selectLauncherUpdate(bad, "1.0.0", "stable"), /https/);
});
test("client build selection matches Minecraft version and loader", () => {
  assert.strictEqual(u.selectClientBuild(manifestObj, { mc: "1.21.4", loader: "fabric", channel: "stable", installed: "1.0.0" }).build.version, "1.1.0");
  assert.strictEqual(u.selectClientBuild(manifestObj, { mc: "1.21.4", loader: "fabric", channel: "stable", installed: "1.1.0" }).status, "up-to-date");
  assert.strictEqual(u.selectClientBuild(manifestObj, { mc: "1.21.4", loader: "fabric", channel: "preview", installed: "1.1.0" }).build.version, "1.2.0-preview.1");
  assert.strictEqual(u.selectClientBuild(manifestObj, { mc: "1.21.4", loader: "forge", channel: "stable" }).status, "unsupported");
  assert.strictEqual(u.selectClientBuild(manifestObj, { mc: "1.19.4", loader: "fabric", channel: "stable" }).status, "unsupported");
});
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "aur-")); }
test("applyFile installs a verified file, backs up the old one, and reports success only after re-verification", () => {
  const d = tmp(), target = path.join(d, "client.jar"); fs.writeFileSync(target, "old");
  const nb = Buffer.from("new-build"), r = u.applyFile({ targetPath: target, newBytes: nb, expectedSha256: u.sha256(nb), backupDir: path.join(d, "bak") });
  assert.ok(r.ok); assert.strictEqual(fs.readFileSync(target, "utf8"), "new-build"); assert.strictEqual(fs.readFileSync(r.backup, "utf8"), "old"); assert.ok(!fs.existsSync(target + ".new"));
});
test("applyFile refuses a corrupt download and leaves the old file untouched", () => {
  const d = tmp(), target = path.join(d, "client.jar"); fs.writeFileSync(target, "old");
  assert.throws(() => u.applyFile({ targetPath: target, newBytes: Buffer.from("tampered"), expectedSha256: u.sha256(Buffer.from("real")), backupDir: path.join(d, "bak") }), /integrity/);
  assert.strictEqual(fs.readFileSync(target, "utf8"), "old");
});
test("applyFile rolls back when the install step fails midway", () => {
  const d = tmp(), target = path.join(d, "client.jar"); fs.writeFileSync(target, "old");
  const nb = Buffer.from("new-build"), flaky = { ...fs, renameSync() { fs.writeFileSync(target, "half-written"); throw new Error("disk error"); } };
  const r = u.applyFile({ targetPath: target, newBytes: nb, expectedSha256: u.sha256(nb), backupDir: path.join(d, "bak"), fsImpl: flaky });
  assert.strictEqual(r.ok, false); assert.ok(r.restored); assert.strictEqual(fs.readFileSync(target, "utf8"), "old");
});
test("applyFile detects a post-install verification failure and restores", () => {
  const d = tmp(), target = path.join(d, "client.jar"); fs.writeFileSync(target, "old");
  const nb = Buffer.from("new-build"); let reads = 0;
  const lying = { ...fs, readFileSync(p, ...a) { reads++; return reads === 2 ? fs.readFileSync(p, ...a) : fs.readFileSync(p, ...a); }, renameSync(a, b) { fs.renameSync(a, b); fs.writeFileSync(b, "corrupted"); } };
  const r = u.applyFile({ targetPath: target, newBytes: nb, expectedSha256: u.sha256(nb), backupDir: path.join(d, "bak"), fsImpl: lying });
  assert.strictEqual(r.ok, false); assert.strictEqual(fs.readFileSync(target, "utf8"), "old");
});
