const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path");
const C = require("../clientmod.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "aur-mod-"));
const JAR1 = Buffer.from("PK fake jar v1"), JAR2 = Buffer.from("PK fake jar v2");
const rel = (tag, jar, extra = {}) => ({ tag_name: tag, html_url: "https://github.com/me/auroras/releases/tag/" + tag,
  assets: [{ name: "AurorasClientSetup.exe", browser_download_url: "https://x/setup.exe" }, { name: "auroras-client-fabric-1.21.4.jar", browser_download_url: "https://x/" + tag + ".jar" },
    { name: "SHA256SUMS.txt", browser_download_url: "https://x/" + tag + ".sums" }], ...extra, _jar: jar });
function net(release) {
  const calls = []; return { calls, latest: async () => { if (release.fail) throw new Error("getaddrinfo ENOTFOUND api.github.com"); calls.push("latest"); return release.r; },
    getBytes: async (url) => { calls.push(url); if (url.endsWith(".sums")) return Buffer.from(C.sha256(release.r._jar) + "  auroras-client-fabric-1.21.4.jar\n" + "a".repeat(64) + "  AurorasClientSetup.exe\n"); return release.tamper || release.r._jar; } };
}

test("installs the mod for a supported Fabric instance, then leaves it alone while it's current", async () => {
  const d = tmp(), R = { r: rel("v0.1.3", JAR1) }, n = net(R), msgs = [];
  const r1 = await C.ensureMod({ gameDir: d, mc: "1.21.4", loader: "Fabric", latest: n.latest, getBytes: n.getBytes, emit: (m) => msgs.push(m) });
  assert.deepStrictEqual(r1, { status: "installed", version: "v0.1.3" }); assert.deepStrictEqual(fs.readFileSync(path.join(d, "mods", "auroras-client.jar")), JAR1);
  assert.match(msgs[0], /Downloading the Auroras mod v0\.1\.3/);
  const before = n.calls.length, r2 = await C.ensureMod({ gameDir: d, mc: "1.21.4", loader: "Fabric", latest: n.latest, getBytes: n.getBytes });
  assert.strictEqual(r2.status, "current"); assert.strictEqual(n.calls.length - before, 1, "only the release was checked, nothing downloaded");
  assert.ok(!fs.readdirSync(path.join(d, "mods")).some((f) => f.endsWith(".part")));
});

test("updates when a new release comes out, and repairs a changed jar", async () => {
  const d = tmp(), R = { r: rel("v0.1.3", JAR1) }, n = net(R);
  await C.ensureMod({ gameDir: d, mc: "1.21.4", loader: "Fabric", latest: n.latest, getBytes: n.getBytes });
  R.r = rel("v0.1.4", JAR2); assert.deepStrictEqual(await C.ensureMod({ gameDir: d, mc: "1.21.4", loader: "Fabric", latest: n.latest, getBytes: n.getBytes }), { status: "updated", version: "v0.1.4" });
  assert.deepStrictEqual(fs.readFileSync(path.join(d, "mods", "auroras-client.jar")), JAR2);
  fs.writeFileSync(path.join(d, "mods", "auroras-client.jar"), "broken");
  assert.strictEqual((await C.ensureMod({ gameDir: d, mc: "1.21.4", loader: "Fabric", latest: n.latest, getBytes: n.getBytes })).status, "updated");
  assert.deepStrictEqual(fs.readFileSync(path.join(d, "mods", "auroras-client.jar")), JAR2);
});

test("a download that doesn't match the checksum is refused and the old jar stays", async () => {
  const d = tmp(), R = { r: rel("v0.1.3", JAR1) }, n = net(R);
  await C.ensureMod({ gameDir: d, mc: "1.21.4", loader: "Fabric", latest: n.latest, getBytes: n.getBytes });
  R.r = rel("v0.1.4", JAR2); R.tamper = Buffer.from("evil");
  const r = await C.ensureMod({ gameDir: d, mc: "1.21.4", loader: "Fabric", latest: n.latest, getBytes: n.getBytes });
  assert.strictEqual(r.status, "offline"); assert.match(r.reason, /didn't match its checksum/); assert.deepStrictEqual(fs.readFileSync(path.join(d, "mods", "auroras-client.jar")), JAR1);
});

test("no build for this Minecraft version: nothing is installed, and a copy we installed earlier is removed so Fabric can start", async () => {
  const d = tmp(), R = { r: rel("v0.1.3", JAR1) }, n = net(R);
  assert.strictEqual((await C.ensureMod({ gameDir: d, mc: "1.21.5", loader: "Fabric", latest: n.latest, getBytes: n.getBytes })).status, "unavailable");
  assert.ok(!fs.existsSync(path.join(d, "mods", "auroras-client.jar")));
  await C.ensureMod({ gameDir: d, mc: "1.21.4", loader: "Fabric", latest: n.latest, getBytes: n.getBytes });
  const r = await C.ensureMod({ gameDir: d, mc: "1.21.5", loader: "Fabric", latest: n.latest, getBytes: n.getBytes });
  assert.strictEqual(r.status, "removed"); assert.ok(!fs.existsSync(path.join(d, "mods", "auroras-client.jar")));
  const v = tmp(); fs.mkdirSync(path.join(v, "mods")); fs.writeFileSync(path.join(v, "mods", "auroras-client.jar"), "someone else's"); // not ours: left alone
  assert.strictEqual((await C.ensureMod({ gameDir: v, mc: "1.21.5", loader: "Fabric", latest: n.latest, getBytes: n.getBytes })).status, "unavailable"); assert.ok(fs.existsSync(path.join(v, "mods", "auroras-client.jar")));
});

test("offline keeps the installed copy and says so; Vanilla instances never get the mod; no repo means not configured", async () => {
  const d = tmp(), R = { r: rel("v0.1.3", JAR1) }, n = net(R);
  await C.ensureMod({ gameDir: d, mc: "1.21.4", loader: "Fabric", latest: n.latest, getBytes: n.getBytes }); R.fail = true;
  const r = await C.ensureMod({ gameDir: d, mc: "1.21.4", loader: "Fabric", latest: n.latest, getBytes: n.getBytes });
  assert.deepStrictEqual([r.status, r.kept], ["offline", true]); assert.ok(fs.existsSync(path.join(d, "mods", "auroras-client.jar")));
  assert.strictEqual((await C.ensureMod({ gameDir: tmp(), mc: "1.21.4", loader: "Vanilla", latest: n.latest, getBytes: n.getBytes })).status, "unavailable");
  assert.strictEqual((await C.ensureMod({ gameDir: tmp(), mc: "1.21.4", loader: "Fabric", latest: null, getBytes: n.getBytes })).status, "not-configured");
  assert.strictEqual(C.releaseSource("", async () => ({})), null); assert.strictEqual(C.releaseSource("not a repo", async () => ({})), null);
});

test("release lookups are cached; launcher updates compare versions properly", async () => {
  let t = 0, calls = 0; const src = C.releaseSource("me/auroras", async (u) => { calls++; assert.strictEqual(u, "https://api.github.com/repos/me/auroras/releases/latest"); return rel("v0.1.10", JAR1); }, { now: () => t });
  await src(); await src(); assert.strictEqual(calls, 1); t = 11 * 60 * 1000; await src(); assert.strictEqual(calls, 2);
  const u = await C.launcherUpdate(src, "0.1.9"); assert.deepStrictEqual([u.newer, u.latest, u.installer], [true, "v0.1.10", "AurorasClientSetup.exe"]);
  assert.strictEqual((await C.launcherUpdate(src, "0.1.10")).newer, false); assert.strictEqual((await C.launcherUpdate(src, "0.2.0")).newer, false);
  assert.deepStrictEqual(await C.launcherUpdate(null, "0.1.0"), { configured: false });
  assert.deepStrictEqual(C.parseSums("ABCDEF" + "0".repeat(58) + " *x.jar\r\nbad line\n"), { "x.jar": "abcdef" + "0".repeat(58) });
});

test("year-numbered releases use the jar built for their line; 1.21.x versions need an exact build", async () => {
  assert.deepStrictEqual(C.candidates("26.3.1"), ["auroras-client-fabric-26.3.1.jar", "auroras-client-fabric-26.3.jar"]);
  assert.deepStrictEqual(C.candidates("26.3"), ["auroras-client-fabric-26.3.jar"]); assert.deepStrictEqual(C.candidates("1.21.11"), ["auroras-client-fabric-1.21.11.jar"]);
  const d = tmp(), r = { tag_name: "v0.1.5", assets: [{ name: "auroras-client-fabric-26.3.jar", browser_download_url: "https://x/a.jar" }, { name: "SHA256SUMS.txt", browser_download_url: "https://x/s.sums" }] };
  const getBytes = async (u) => u.endsWith(".sums") ? Buffer.from(C.sha256(JAR1) + "  auroras-client-fabric-26.3.jar\n") : JAR1;
  assert.strictEqual((await C.ensureMod({ gameDir: d, mc: "26.3.1", loader: "Fabric", latest: async () => r, getBytes })).status, "installed");
  assert.strictEqual((await C.ensureMod({ gameDir: tmp(), mc: "1.21.10", loader: "Fabric", latest: async () => r, getBytes })).status, "unavailable");
});
