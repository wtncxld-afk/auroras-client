// Modrinth modpack (.mrpack) import: index parsing, loader detection, env filtering, path and host rejection,
// hash checks, overrides precedence and the install itself, all against real .mrpack zips built here.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const M = require("../modpack.js"), ziputil = require("../ziputil.js"), { zip } = require("./fixtures/zip.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "aur-mrpack-"));
const h = (algo, b) => crypto.createHash(algo).update(b).digest("hex");
const JARS = { sodium: Buffer.from("sodium jar bytes " + "s".repeat(500)), lithium: Buffer.from("lithium jar"), server: Buffer.from("server only"), shader: Buffer.from("optional shader pack") };
const entry = (p, buf, extra = {}) => ({ path: p, hashes: { sha1: h("sha1", buf), sha512: h("sha512", buf) }, env: { client: "required", server: "required" }, downloads: ["https://cdn.modrinth.com/data/" + path.basename(p)], fileSize: buf.length, ...extra });
const INDEX = (o = {}) => ({ formatVersion: 1, game: "minecraft", versionId: "1.2.0", name: "Aurora Pack", summary: "A test pack",
  files: [entry("mods/sodium.jar", JARS.sodium), entry("mods/lithium.jar", JARS.lithium, { downloads: ["https://github.com/x/y/releases/download/v1/lithium.jar"] }),
    entry("mods/server-utils.jar", JARS.server, { env: { client: "unsupported", server: "required" } }),
    entry("shaderpacks/pretty.zip", JARS.shader, { env: { client: "optional", server: "unsupported" } })],
  dependencies: { minecraft: "1.21.4", "fabric-loader": "0.16.10" }, ...o });
const mrpack = (index, extra = [], opts) => { const d = tmp(), f = path.join(d, "pack.mrpack"); fs.writeFileSync(f, zip([["modrinth.index.json", Buffer.from(JSON.stringify(index))], ...extra], opts)); return f; };
const fakeFetch = (map, log = []) => async (url) => { log.push(url); const b = map[url]; if (!b) throw new Error("404 " + url); return typeof b === "function" ? b() : b; };
const URLS = { "https://cdn.modrinth.com/data/sodium.jar": JARS.sodium, "https://github.com/x/y/releases/download/v1/lithium.jar": JARS.lithium, "https://cdn.modrinth.com/data/pretty.zip": JARS.shader };

test("reads the index: name, Minecraft version, loader and the files to download", () => {
  const p = M.parseIndex(Buffer.from(JSON.stringify(INDEX())));
  assert.deepStrictEqual([p.name, p.versionId, p.summary, p.mc, p.loader, p.loaderVersion], ["Aurora Pack", "1.2.0", "A test pack", "1.21.4", "Fabric", "0.16.10"]);
  assert.deepStrictEqual(p.files.map((f) => f.path), ["mods/sodium.jar", "mods/lithium.jar", "shaderpacks/pretty.zip"]);
  assert.strictEqual(p.files[0].sha512, h("sha512", JARS.sodium)); assert.strictEqual(p.files[0].size, JARS.sodium.length);
  assert.strictEqual(p.totalBytes, JARS.sodium.length + JARS.lithium.length + JARS.shader.length);
  // A BOM in front of the JSON is fine.
  assert.strictEqual(M.parseIndex("\uFEFF" + JSON.stringify(INDEX())).name, "Aurora Pack");
});
test("env: server-only files are skipped, optional ones kept unless turned off, a missing env means required", () => {
  const p = M.parseIndex(INDEX());
  assert.deepStrictEqual(p.skipped, [{ path: "mods/server-utils.jar", reason: "server only" }]);
  assert.deepStrictEqual(p.files.filter((f) => f.optional).map((f) => f.path), ["shaderpacks/pretty.zip"]);
  const q = M.parseIndex(INDEX(), { optional: false }); assert.deepStrictEqual(q.files.map((f) => f.path), ["mods/sodium.jar", "mods/lithium.jar"]);
  const i = INDEX(); delete i.files[0].env; assert.strictEqual(M.parseIndex(i).files[0].optional, false);
  const bad = INDEX(); bad.files[0].env.client = "sometimes"; assert.throws(() => M.parseIndex(bad), /Unknown env value/);
});
test("loader detection: Fabric, Quilt, Forge, NeoForge or Vanilla, and nothing ambiguous", () => {
  const dep = (d) => M.parseIndex(INDEX({ dependencies: { minecraft: "1.21.1", ...d } }));
  assert.deepStrictEqual([dep({ "quilt-loader": "0.27.1" }).loader, dep({ forge: "52.0.40" }).loader, dep({ neoforge: "21.1.77" }).loader, dep({}).loader], ["Quilt", "Forge", "NeoForge", "Vanilla"]);
  assert.strictEqual(dep({}).loaderVersion, null); assert.strictEqual(dep({ neoforge: "21.1.77" }).loaderVersion, "21.1.77");
  assert.throws(() => dep({ "fabric-loader": "0.16.10", forge: "52.0.40" }), /more than one mod loader/);
  assert.throws(() => dep({ "liteloader": "1" }), /doesn’t know/);
  assert.throws(() => dep({ "fabric-loader": "0.16; rm -rf /" }), /version isn’t valid/);
  assert.throws(() => M.parseIndex(INDEX({ dependencies: { "fabric-loader": "0.16.10" } })), /which Minecraft version/);
  assert.throws(() => M.parseIndex(INDEX({ dependencies: { minecraft: "../1.21" } })), /which Minecraft version/);
  assert.throws(() => M.parseIndex(INDEX({ formatVersion: 2 })), /format version 2/);
  assert.throws(() => M.parseIndex(INDEX({ game: "terraria" })), /isn’t for Minecraft/);
  assert.throws(() => M.parseIndex("{nope"), /isn’t valid JSON/);
  assert.throws(() => M.parseIndex(INDEX({ files: "all of them" })), /no file list/);
});
test("summary warns about loaders Auroras can't launch yet and counts what will be installed", () => {
  const p = M.parseIndex(INDEX()), s = M.summarize(p, []);
  assert.deepStrictEqual([s.files, s.mods, s.optional, s.serverOnly, s.overrides, s.warnings], [3, 2, 1, 1, 0, []]);
  assert.match(M.summarize(M.parseIndex(INDEX({ dependencies: { minecraft: "1.21.1", neoforge: "21.1.77" } })), []).warnings[0], /NeoForge instances can be imported but not launched/);
});
test("paths that are absolute, climb out with .., or could be read differently on Windows are refused", () => {
  for (const p of ["/etc/passwd", "C:/Windows/x.dll", "C:x", "\\\\server\\share\\x", "mods/../../evil.jar", "../evil.jar", "..", "mods/..", "./mods/a.jar", "mods//a.jar", "mods/", "mods\\a.jar",
    "mods/a.jar:stream", "mods/CON", "nul.txt", "mods/a.jar.", "mods/a.jar ", "instance.json", "MODS.JSON", "modpack.json", "a\0b", "mods/a|b.jar", ""])
    assert.throws(() => M.checkPath(p), /Unsafe path/, JSON.stringify(p));
  for (const p of ["mods/sodium.jar", "config/sodium options.json", "resourcepacks/Faithful 32x.zip", "options.txt", "config/instance.json", ".fabric/x"]) assert.strictEqual(M.checkPath(p), p);
  for (const p of ["/abs.jar", "mods/../../../x.jar", "C:\\x.jar"]) assert.throws(() => M.parseIndex(INDEX({ files: [entry(p, JARS.lithium)] })), /Unsafe path/);
});
test("downloads only from cdn.modrinth.com, github.com, raw.githubusercontent.com and gitlab.com, over https", () => {
  const one = (urls) => M.parseIndex(INDEX({ files: [entry("mods/a.jar", JARS.lithium, { downloads: urls })] })).files[0].urls;
  assert.deepStrictEqual(one(["https://evil.example/a.jar", "https://gitlab.com/x/a.jar", "https://raw.githubusercontent.com/x/a.jar"]), ["https://gitlab.com/x/a.jar", "https://raw.githubusercontent.com/x/a.jar"]);
  assert.throws(() => one(["https://edge.forgecdn.net/files/a.jar"]), /edge\.forgecdn\.net, which modpacks aren’t allowed/);
  assert.throws(() => one(["http://cdn.modrinth.com/a.jar"]), /aren’t allowed/);
  assert.throws(() => one(["https://cdn.modrinth.com.evil.net/a.jar"]), /aren’t allowed/);
  assert.throws(() => one([]), /aren’t allowed/);
});
test("every file needs a valid hash and size, appears once, and stays under the size caps", () => {
  const f = (o) => M.parseIndex(INDEX({ files: [entry("mods/a.jar", JARS.lithium, o)] }));
  assert.throws(() => f({ hashes: { sha1: "nope", sha512: "zz" } }), /No valid checksum/);
  assert.strictEqual(f({ hashes: { sha1: h("sha1", JARS.lithium) } }).files[0].sha512, null, "SHA-1 alone is accepted, as the format allows");
  assert.throws(() => f({ fileSize: -1 }), /No valid size/); assert.throws(() => f({ fileSize: "12" }), /No valid size/);
  assert.throws(() => f({ fileSize: M.LIMITS.fileBytes + 1 }), /larger than/);
  assert.throws(() => M.parseIndex(INDEX({ files: [entry("mods/a.jar", JARS.lithium), entry("MODS/A.jar", JARS.lithium)] })), /twice/);
  assert.throws(() => M.parseIndex(INDEX({ files: Array(M.LIMITS.files + 1).fill(null) })), /limit is/);
});
test("a real .mrpack: overrides are planned, client-overrides win, server-overrides are ignored", () => {
  const f = mrpack(INDEX(), [["overrides/config/sodium.json", Buffer.from('{"from":"overrides"}')], ["overrides/options.txt", Buffer.from("gamma:1.0")], ["overrides/config/", Buffer.alloc(0)],
    ["client-overrides/config/sodium.json", Buffer.from('{"from":"client"}')], ["server-overrides/server.properties", Buffer.from("motd=x")], ["README.md", Buffer.from("hello")]], { deflate: true });
  const r = M.readPack(f);
  assert.deepStrictEqual(r.overrides.map((o) => [o.path, o.from]).sort(), [["config/sodium.json", "client-overrides"], ["options.txt", "overrides"]]);
  assert.deepStrictEqual([r.summary.name, r.summary.mc, r.summary.loader, r.summary.files, r.summary.mods, r.summary.overrides], ["Aurora Pack", "1.21.4", "Fabric", 3, 2, 2]);
  const root = tmp(); assert.strictEqual(M.extractOverrides(f, r.overrides, root), 2);
  assert.strictEqual(fs.readFileSync(path.join(root, "config", "sodium.json"), "utf8"), '{"from":"client"}');
  assert.strictEqual(fs.readFileSync(path.join(root, "options.txt"), "utf8"), "gamma:1.0");
  assert.ok(!fs.existsSync(path.join(root, "server.properties")) && !fs.existsSync(path.join(root, "README.md")));
});
test("zip-slip: a pack with an entry that climbs out of the instance is refused before anything is written", () => {
  for (const name of ["overrides/../../evil.txt", "client-overrides/../evil.txt", "../evil.txt", "overrides//etc/passwd", "overrides/C:/evil.txt", "/abs.txt", "overrides\\..\\evil.txt"]) {
    const f = mrpack(INDEX(), [[name, Buffer.from("x")]]);
    assert.throws(() => M.readPack(f), /Unsafe path/, name);
  }
  // The instance's own files can't be replaced by overrides either.
  assert.throws(() => M.readPack(mrpack(INDEX(), [["overrides/mods.json", Buffer.from("{}")]])), /Unsafe path/);
});
test("not a modpack, damaged, or no index: clear errors", () => {
  const d = tmp(), f = path.join(d, "x.mrpack"); fs.writeFileSync(f, "hello"); assert.throws(() => M.readPack(f), /isn’t a Modrinth modpack/);
  const g = path.join(d, "y.mrpack"); fs.writeFileSync(g, zip([["mods/a.jar", Buffer.from("x")]])); assert.throws(() => M.readPack(g), /modrinth\.index\.json is missing/);
  assert.throws(() => M.readPack(d), /isn’t a file/);
});
test("override sizes are capped, and inflating stops at the cap (zip bombs)", () => {
  const big = Buffer.alloc(M.LIMITS.overrideBytes + 1);
  assert.throws(() => M.planOverrides([{ name: "overrides/big.bin", usize: big.length, csize: 10 }]), /larger than/);
  const f = mrpack(INDEX(), [["overrides/a.txt", Buffer.alloc(5000, 1)]], { deflate: true }), z = ziputil.open(f);
  try { const e = z.entries.find((x) => x.name === "overrides/a.txt"); assert.throws(() => z.read(e, 100), /too large/); assert.strictEqual(z.read(e, 5000).length, 5000); } finally { z.close(); }
});
test("install: every file downloaded, checked against SHA-512 and SHA-1, written inside the instance", async () => {
  const { pack, overrides } = M.readPack(mrpack(INDEX(), [["overrides/options.txt", Buffer.from("x")]])), root = tmp(), log = [], prog = [];
  const r = await M.downloadFiles(pack.files, { root, fetch: fakeFetch(URLS, log), onProgress: (p) => prog.push(p) });
  assert.deepStrictEqual(r, { downloaded: 3, kept: 0 });
  assert.deepStrictEqual(fs.readFileSync(path.join(root, "mods", "sodium.jar")), JARS.sodium);
  assert.deepStrictEqual(fs.readFileSync(path.join(root, "shaderpacks", "pretty.zip")), JARS.shader);
  assert.ok(!fs.existsSync(path.join(root, "mods", "server-utils.jar")), "server-only file not downloaded");
  assert.strictEqual(prog.at(-1), 1); assert.ok(prog.every((p, i) => !i || p >= prog[i - 1]));
  assert.ok(log.every((u) => M.allowedUrl(u)));
  assert.deepStrictEqual(fs.readdirSync(path.join(root, "mods")).sort(), ["lithium.jar", "sodium.jar"], "no temporary files left");
  // Again: files already there with the right hash are kept, nothing is fetched.
  const again = []; assert.deepStrictEqual(await M.downloadFiles(pack.files, { root, fetch: fakeFetch(URLS, again) }), { downloaded: 0, kept: 3 }); assert.deepStrictEqual(again, []);
  M.extractOverrides(mrpack(INDEX(), [["overrides/options.txt", Buffer.from("x")]]), overrides, root); assert.ok(fs.existsSync(path.join(root, "options.txt")));
});
test("install: a tampered download fails the checksum and nothing is written; a second mirror is used when the first fails", async () => {
  const p = M.parseIndex(INDEX({ files: [entry("mods/sodium.jar", JARS.sodium, { downloads: ["https://cdn.modrinth.com/data/sodium.jar", "https://github.com/m/sodium.jar"] })] }));
  const root = tmp(), sleep = async () => {};
  const evil = Buffer.from(JARS.sodium); evil[3] ^= 1;
  await assert.rejects(M.downloadFiles(p.files, { root, sleep, fetch: fakeFetch({ "https://cdn.modrinth.com/data/sodium.jar": evil, "https://github.com/m/sodium.jar": evil }) }), /Checksum mismatch for mods\/sodium\.jar/);
  assert.deepStrictEqual(fs.readdirSync(path.join(root, "mods")), [], "no file and no leftovers");
  const log = []; await M.downloadFiles(p.files, { root, sleep, fetch: fakeFetch({ "https://github.com/m/sodium.jar": JARS.sodium }, log) });
  assert.deepStrictEqual(fs.readFileSync(path.join(root, "mods", "sodium.jar")), JARS.sodium); assert.deepStrictEqual(log, ["https://cdn.modrinth.com/data/sodium.jar", "https://cdn.modrinth.com/data/sodium.jar", "https://cdn.modrinth.com/data/sodium.jar", "https://github.com/m/sodium.jar"]);
  // SHA-1 is checked too when the pack gives both.
  const q = M.parseIndex(INDEX({ files: [entry("mods/x.jar", JARS.lithium, { hashes: { sha512: h("sha512", JARS.lithium), sha1: "0".repeat(40) } })] }));
  await assert.rejects(M.downloadFiles(q.files, { root, sleep, fetch: fakeFetch({ "https://cdn.modrinth.com/data/x.jar": JARS.lithium }) }), /Checksum mismatch/);
});
test("install: a download larger than the pack says is cut off while streaming; disallowed hosts are never contacted", async () => {
  const p = M.parseIndex(INDEX({ files: [entry("mods/lithium.jar", JARS.lithium)] })), root = tmp(); let chunks = 0;
  const endless = async function* () { for (;;) { chunks++; yield Buffer.alloc(4, 1); } };
  await assert.rejects(M.downloadFiles(p.files, { root, retries: 1, fetch: async () => endless() }), /bigger than the modpack says/);
  assert.ok(chunks < 10, "stopped right after the declared size");
  const log = []; const f = [{ ...p.files[0], urls: ["https://evil.example/lithium.jar"] }];
  await assert.rejects(M.downloadFiles(f, { root, retries: 1, fetch: fakeFetch({}, log) }), /not allowed/); assert.deepStrictEqual(log, []);
  await assert.rejects(M.downloadFiles([{ ...p.files[0], path: "../escape.jar" }], { root, fetch: fakeFetch({}, log) }), /Unsafe path/);
  await assert.rejects(M.downloadFiles(p.files, { root, retries: 1, cancelled: () => true, fetch: fakeFetch(URLS) }), /cancelled/);
});
test("mods.json entries: Modrinth projects by hash, the rest under the file name; non-mods ignored", () => {
  const { pack, overrides } = M.readPack(mrpack(INDEX(), [["overrides/mods/local-only.jar", Buffer.from("x")], ["overrides/mods/sodium.jar", Buffer.from("x")]]));
  const man = M.modManifest(pack, overrides, { [h("sha512", JARS.sodium)]: { project_id: "AANobbMI", version_number: "0.6.0" }, [h("sha512", JARS.shader)]: { project_id: "bad id!" } });
  assert.deepStrictEqual(man, { "m:AANobbMI": { filename: "sodium.jar", version: "0.6.0", modpack: "Aurora Pack" }, "pack:lithium.jar": { filename: "lithium.jar", version: "from modpack", modpack: "Aurora Pack" }, "pack:local-only.jar": { filename: "local-only.jar", version: "from modpack", modpack: "Aurora Pack" } });
});
test("ziputil lists every entry and reads several from one open file", () => {
  const f = mrpack(INDEX(), [["overrides/a.txt", Buffer.from("A")], ["overrides/b/", Buffer.alloc(0)]]);
  assert.deepStrictEqual(ziputil.listEntries(f).map((e) => [e.name, e.dir]), [["modrinth.index.json", false], ["overrides/a.txt", false], ["overrides/b/", true]]);
  assert.strictEqual(ziputil.readEntry(f, "overrides/a.txt").toString(), "A");
});
