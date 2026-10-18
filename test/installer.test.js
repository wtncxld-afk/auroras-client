const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path");
const ins = require("../installer.js");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "aur-ins-"));
const files = { a: Buffer.from("alpha"), b: Buffer.from("bravo-bravo"), c: Buffer.from("charlie") };
const U = (k) => "https://libraries.minecraft.net/x/" + k;
function fakeNet(extra = {}) {
  const calls = []; let live = 0, peak = 0;
  return { calls, peak: () => peak, fetchBytes: async (url) => { calls.push(url); live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live--;
    const k = url.split("/").pop(); if (extra[k]) return extra[k]; if (!files[k]) throw new Error("404 " + url); return files[k]; } };
}
const item = (k, over = {}) => ({ path: "lib/" + k + ".jar", url: U(k), sha1: ins.sha1(files[k]), size: files[k].length, ...over });

test("downloads, verifies and writes files; progress ends at 100%", async () => {
  const root = tmp(), net = fakeNet(), prog = [];
  const r = await ins.ensureFiles([item("a"), item("b"), item("c")], { root, fetchBytes: net.fetchBytes, concurrency: 2, onProgress: (f) => prog.push(f) });
  assert.deepStrictEqual(r, { downloaded: 3, skipped: 0 });
  for (const k of ["a", "b", "c"]) assert.strictEqual(fs.readFileSync(path.join(root, "lib", k + ".jar"), "utf8"), files[k].toString());
  assert.strictEqual(prog.at(-1), 1); assert.ok(prog.every((p, i) => i === 0 || p >= prog[i - 1]), "progress never goes backwards");
  assert.ok(net.peak() <= 2, "respects the concurrency limit");
  assert.ok(!fs.readdirSync(path.join(root, "lib")).some((f) => f.includes(".part")), "no temporary files left behind");
});
test("valid existing files are skipped; corrupted ones are replaced", async () => {
  const root = tmp(), net = fakeNet(); await ins.ensureFiles([item("a"), item("b")], { root, fetchBytes: net.fetchBytes });
  fs.writeFileSync(path.join(root, "lib", "b.jar"), "bravo-BRAVO");
  const net2 = fakeNet(), r = await ins.ensureFiles([item("a"), item("b")], { root, fetchBytes: net2.fetchBytes });
  assert.deepStrictEqual(r, { downloaded: 1, skipped: 1 }); assert.deepStrictEqual(net2.calls, [U("b")]);
  assert.strictEqual(fs.readFileSync(path.join(root, "lib", "b.jar"), "utf8"), "bravo-bravo");
});
test("size-only verification (assets) skips a same-size file without hashing it", async () => {
  const root = tmp(); fs.mkdirSync(path.join(root, "lib")); fs.writeFileSync(path.join(root, "lib", "a.jar"), "ALPHA");
  const net = fakeNet(), r = await ins.ensureFiles([item("a", { verify: "size" })], { root, fetchBytes: net.fetchBytes });
  assert.deepStrictEqual(r, { downloaded: 0, skipped: 1 }); assert.strictEqual(net.calls.length, 0);
});
test("a tampered download is rejected and nothing is written", async () => {
  const root = tmp(), net = fakeNet({ a: Buffer.from("evil!") });
  await assert.rejects(ins.ensureFiles([item("a", { size: undefined })], { root, fetchBytes: net.fetchBytes }), /Checksum mismatch/);
  assert.ok(!fs.existsSync(path.join(root, "lib", "a.jar")));
  await assert.rejects(ins.ensureFiles([item("a")], { root, fetchBytes: fakeNet({ a: Buffer.from("evil-longer") }).fetchBytes }), /Wrong size/);
});
test("missing checksums, disallowed hosts and escaping paths are refused before any download", async () => {
  const root = tmp(), net = fakeNet();
  await assert.rejects(ins.ensureFiles([item("a", { sha1: undefined })], { root, fetchBytes: net.fetchBytes }), /checksum/);
  await assert.rejects(ins.ensureFiles([item("a", { url: "https://evil.example/a" })], { root, fetchBytes: net.fetchBytes }), /not allowed/);
  for (const bad of ["../../etc/passwd", "/etc/passwd", "C:/Windows/x", "lib/../../x", "a\0b", "../x", "lib/../lib/a.jar", "lib//a.jar", "\\\\server\\share"]) await assert.rejects(ins.ensureFiles([item("a", { path: bad })], { root, fetchBytes: net.fetchBytes }), /Unsafe path/, bad);
  assert.strictEqual(net.calls.length, 0);
});
test("a failed download stops the batch and surfaces the error", async () => {
  const root = tmp(), net = fakeNet();
  await assert.rejects(ins.ensureFiles([item("a"), { path: "lib/z.jar", url: U("z"), sha1: "0".repeat(40), size: 1 }], { root, fetchBytes: net.fetchBytes }), /404/);
});
test("Java runtime manifest: files, folders, links, executable bits, unsafe entries refused", () => {
  const m = { files: { bin: { type: "directory" }, "bin/java": { type: "file", executable: true, downloads: { raw: { url: "https://piston-data.mojang.com/j", sha1: "a".repeat(40), size: 9 } } },
    "lib/libjli.so": { type: "file", downloads: { raw: { url: "https://piston-data.mojang.com/l", sha1: "b".repeat(40), size: 3 } } }, "legal/x": { type: "link", target: "../lib/x" } } };
  const r = ins.runtimeFiles(m);
  assert.deepStrictEqual(r.dirs, ["bin"]); assert.deepStrictEqual(r.links, [{ path: "legal/x", target: "../lib/x" }]);
  assert.deepStrictEqual(r.files.map((f) => [f.path, f.executable]), [["bin/java", true], ["lib/libjli.so", false]]);
  assert.throws(() => ins.runtimeFiles({ files: { "../x": { type: "directory" } } }), /Unsafe path/);
  assert.throws(() => ins.runtimeFiles({ files: { x: { type: "link", target: "/etc/passwd" } } }), /Unsafe link/);
});
test("java executable location and Mojang platform keys per OS", () => {
  const f = (...p) => p.map((path) => ({ path }));
  assert.strictEqual(ins.javaExecutable(f("bin/java.exe", "bin/javaw.exe"), "windows"), "bin/javaw.exe");
  assert.strictEqual(ins.javaExecutable(f("jre.bundle/Contents/Home/bin/java"), "osx"), "jre.bundle/Contents/Home/bin/java");
  assert.strictEqual(ins.javaExecutable(f("bin/java"), "linux"), "bin/java"); assert.throws(() => ins.javaExecutable(f("bin/other"), "linux"));
  assert.deepStrictEqual([["windows", "x86_64"], ["windows", "arm64"], ["osx", "arm64"], ["osx", "x86_64"], ["linux", "x86_64"]].map(([o, a]) => ins.runtimePlatform(o, a)), ["windows-x64", "windows-arm64", "mac-os-arm64", "mac-os", "linux"]);
});

test("downloads retry with a growing pause before giving up, and the error names the file and host", async () => {
  const root = tmp(); let calls = 0; const waits = [];
  const flaky = { fetchBytes: async (u) => { calls++; if (calls < 3) throw new Error("connection reset"); return fakeNet().fetchBytes(u); } };
  await ins.ensureFiles([item("a")], { root, fetchBytes: flaky.fetchBytes, sleep: async (ms) => waits.push(ms) });
  assert.strictEqual(calls, 3); assert.deepStrictEqual(waits, [500, 2000]); assert.ok(fs.existsSync(path.join(root, "lib", "a.jar")));
  const dead = { fetchBytes: async () => { throw new Error("libraries.minecraft.net returned 503"); } };
  await assert.rejects(ins.ensureFiles([item("a")], { root: tmp(), fetchBytes: dead.fetchBytes, sleep: async () => {} }), /Couldn’t download lib\/a\.jar from libraries\.minecraft\.net after 3 tries: libraries\.minecraft\.net returned 503/);
});
