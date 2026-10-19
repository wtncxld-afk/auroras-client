// End-to-end launch tests. Mojang and Fabric servers are replaced by an in-memory map, and Minecraft by Probe.java,
// a tiny program that records how it was started. Everything else (downloads, checksums, files, the java process) is real.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path");
const { spawn, execFileSync } = require("child_process");
const L = require("../launcher.js"), ins = require("../installer.js"), { zip } = require("./fixtures/zip.js");

const HOST = { os: process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux", arch: process.arch === "arm64" ? "arm64" : "x86_64" };
const OTHER = HOST.os === "windows" ? "osx" : "windows";
function findJava() { try { const out = execFileSync(process.platform === "win32" ? "where" : "which", ["java"]).toString().split(/\r?\n/)[0].trim(); return out || null; } catch { return null; } }
const JAVA = findJava();
let PROBE = null;
function probeClass() {
  if (PROBE) return PROBE; if (!JAVA) return null;
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "aur-probe-"));
  try { execFileSync(JAVA, [path.join(__dirname, "fixtures", "CompileProbe.java"), path.join(__dirname, "fixtures", "Probe.java"), out], { stdio: "pipe" }); } catch { return null; }
  return (PROBE = fs.readFileSync(path.join(out, "Probe.class")));
}
const MF = ["META-INF/MANIFEST.MF", Buffer.from("Manifest-Version: 1.0\r\n\r\n")];
const libJar = (n) => zip([MF, ["marker/" + n.replace(/[:.]/g, "_") + ".txt", Buffer.from(n)]]);

/** Builds a fake Mojang/Fabric world: URL -> bytes. */
function world({ vanillaMain = "Probe", fabricLibSha = true } = {}) {
  const bytes = new Map(), put = (u, b) => { bytes.set(u, Buffer.isBuffer(b) ? b : Buffer.from(typeof b === "string" ? b : JSON.stringify(b))); return bytes.get(u); };
  const client = put("https://piston-data.mojang.com/v1/objects/c1/client.jar", zip([MF, ["Probe.class", probeClass() || Buffer.from("x")]]));
  const lib = (name, rel, rules) => { const b = put("https://libraries.minecraft.net/" + rel, libJar(name)); return { name, downloads: { artifact: { path: rel, url: "https://libraries.minecraft.net/" + rel, sha1: ins.sha1(b), size: b.length } }, ...(rules ? { rules } : {}) }; };
  const a1 = Buffer.from("asset-one"), a2 = Buffer.from("asset-two-two"), h1 = ins.sha1(a1), h2 = ins.sha1(a2);
  put(`https://resources.download.minecraft.net/${h1.slice(0, 2)}/${h1}`, a1); put(`https://resources.download.minecraft.net/${h2.slice(0, 2)}/${h2}`, a2);
  const idx = put("https://piston-meta.mojang.com/v1/packages/i19/19.json", { objects: { "minecraft/sounds/a.ogg": { hash: h1, size: a1.length }, "icons/icon.png": { hash: h2, size: a2.length } } });
  const vanilla = { id: "1.21.4", type: "release", mainClass: vanillaMain, javaVersion: { component: "java-runtime-delta", majorVersion: 21 },
    downloads: { client: { url: "https://piston-data.mojang.com/v1/objects/c1/client.jar", sha1: ins.sha1(client), size: client.length } },
    assetIndex: { id: "19", url: "https://piston-meta.mojang.com/v1/packages/i19/19.json", sha1: ins.sha1(idx), size: idx.length },
    libraries: [lib("com.mojang:logging:1.3.0", "com/mojang/logging/1.3.0/logging-1.3.0.jar"), lib("org.ow2.asm:asm:9.3", "org/ow2/asm/asm/9.3/asm-9.3.jar"),
      lib(`org.lwjgl:lwjgl:3.3.3:natives-${HOST.os}`, `org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-${HOST.os}.jar`, [{ action: "allow", os: { name: HOST.os } }]),
      lib(`org.lwjgl:lwjgl:3.3.3:natives-${OTHER}`, `org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-${OTHER}.jar`, [{ action: "allow", os: { name: OTHER } }])],
    arguments: { game: ["--username", "${auth_player_name}", "--version", "${version_name}", "--gameDir", "${game_directory}", "--assetsDir", "${assets_root}", "--assetIndex", "${assets_index_name}", "--uuid", "${auth_uuid}",
      "--accessToken", "${auth_access_token}", "--clientId", "${clientid}", "--xuid", "${auth_xuid}", "--userType", "${user_type}", "--versionType", "${version_type}",
      { rules: [{ action: "allow", features: { is_demo_user: true } }], value: "--demo" }, { rules: [{ action: "allow", features: { has_quick_plays_support: true } }], value: ["--quickPlayPath", "${quickPlayPath}"] }, { rules: [{ action: "allow", features: { is_quick_play_multiplayer: true } }], value: ["--quickPlayMultiplayer", "${quick_play_multiplayer}"] }],
      jvm: ["-Djava.library.path=${natives_directory}", "-Dminecraft.launcher.brand=${launcher_name}", "-Dminecraft.launcher.version=${launcher_version}", "-cp", "${classpath}"] } };
  put("https://piston-meta.mojang.com/v1/packages/v/1.21.4.json", vanilla);
  put(L.MANIFEST, { latest: { release: "1.21.4" }, versions: [{ id: "1.21.4", type: "release", url: "https://piston-meta.mojang.com/v1/packages/v/1.21.4.json", releaseTime: "2024-12-03T10:00:00Z" }] });
  const fl = put("https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.16.10/fabric-loader-0.16.10.jar", libJar("fabric-loader"));
  const asm = put("https://maven.fabricmc.net/org/ow2/asm/asm/9.7/asm-9.7.jar", libJar("asm97"));
  if (fabricLibSha) { put("https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.16.10/fabric-loader-0.16.10.jar.sha1", ins.sha1(fl)); put("https://maven.fabricmc.net/org/ow2/asm/asm/9.7/asm-9.7.jar.sha1", ins.sha1(asm) + "  asm-9.7.jar\n"); }
  put(L.fabricProfileUrl("1.21.4", "0.16.10"), { id: "fabric-loader-0.16.10-1.21.4", inheritsFrom: "1.21.4", mainClass: "Probe", arguments: { game: [], jvm: ["-DFabricMcEmu=net.minecraft.client.main.Main"] },
    libraries: [{ name: "net.fabricmc:fabric-loader:0.16.10", url: "https://maven.fabricmc.net/" }, { name: "org.ow2.asm:asm:9.7", url: "https://maven.fabricmc.net/" }] });
  const jbin = put("https://piston-data.mojang.com/v1/objects/jj/java", "#!/bin/sh\necho fake java\n"), jlib = put("https://piston-data.mojang.com/v1/objects/jl/lib", "lib");
  put("https://piston-meta.mojang.com/v1/packages/jm/manifest.json", { files: { bin: { type: "directory" },
    [HOST.os === "windows" ? "bin/javaw.exe" : HOST.os === "osx" ? "jre.bundle/Contents/Home/bin/java" : "bin/java"]: { type: "file", executable: true, downloads: { raw: { url: "https://piston-data.mojang.com/v1/objects/jj/java", sha1: ins.sha1(jbin), size: jbin.length } } },
    "lib/libjvm.so": { type: "file", downloads: { raw: { url: "https://piston-data.mojang.com/v1/objects/jl/lib", sha1: ins.sha1(jlib), size: jlib.length } } }, "legal/LICENSE": { type: "link", target: "../lib/libjvm.so" } } });
  put(L.JAVA_INDEX, { [ins.runtimePlatform(HOST.os, HOST.arch)]: { "java-runtime-delta": [{ manifest: { url: "https://piston-meta.mojang.com/v1/packages/jm/manifest.json" }, version: { name: "21.0.7" } }] } });
  const calls = [], get = (u) => { calls.push(u); const b = bytes.get(u); if (!b) throw new Error("404 " + u); return b; };
  return { bytes, calls, put, fetchJson: async (u) => JSON.parse(get(u).toString()), fetchText: async (u) => get(u).toString(), fetchBytes: async (u) => get(u) };
}
function setup(over = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aur-root-")), gameDir = path.join(root, "instances", "7"), w = world(over.world), states = [];
  const d = { root, gameDir, env: HOST, fetchJson: w.fetchJson, fetchText: w.fetchText, fetchBytes: w.fetchBytes, exists: (p) => fs.existsSync(p), emit: (s, p, m) => states.push([s, p, m]) };
  const out = path.join(root, "probe.txt");
  const req = { inst: { id: 7, mc: "1.21.4", loader: "Vanilla", loaderVersion: null, memMb: 1024, args: `-Dprobe.out="${out}"`, java: { mode: "custom", path: JAVA }, ...(over.inst || {}) },
    auth: { name: "Steve", uuid: "uuid-123", token: "TOKEN-abc", xuid: "2535", clientId: "client-id", userType: "msa" } };
  return { root, gameDir, w, d, req, states, out };
}
const run = async (cmd, gameDir, logFile, emit) => L.supervise(spawn(cmd.file, cmd.args, { cwd: gameDir }), { logFile, emit });
const probeOut = (f) => { const lines = fs.readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean); return { lines, args: lines.filter((l) => l.startsWith("arg=")).map((l) => l.slice(4)), get: (k) => (lines.find((l) => l.startsWith(k + "=")) || "").slice(k.length + 1) }; };
const needJava = { skip: !JAVA || !probeClass() ? "no java with a compiler on PATH" : false };

test("vanilla: downloads, verifies, and starts a real java process with the right identity and arguments", needJava, async () => {
  const t = setup(); const cmd = await L.prepare(t.req, t.d);
  const code = await run(cmd, t.gameDir, path.join(t.gameDir, "logs", "launcher.log"), t.d.emit);
  assert.strictEqual(code, 0);
  const p = probeOut(t.out), arg = (k) => p.args[p.args.indexOf(k) + 1];
  assert.strictEqual(p.get("main"), "Probe");
  assert.deepStrictEqual([arg("--username"), arg("--uuid"), arg("--accessToken"), arg("--clientId"), arg("--xuid"), arg("--userType"), arg("--versionType"), arg("--assetIndex"), arg("--version")],
    ["Steve", "uuid-123", "TOKEN-abc", "client-id", "2535", "msa", "release", "19", "1.21.4"]);
  assert.strictEqual(path.resolve(arg("--gameDir")), path.resolve(t.gameDir)); assert.strictEqual(fs.realpathSync(p.get("cwd")), fs.realpathSync(t.gameDir));
  assert.ok(!p.args.includes("--demo") && !p.args.includes("--quickPlayPath"), "feature-gated arguments stay off");
  const mem = +p.get("maxMemMb"); assert.ok(mem > 700 && mem <= 1024, "memory setting applied: " + mem);
  const cp = p.get("classpath").split(path.delimiter);
  assert.ok(cp.at(-1).endsWith(path.join("versions", "1.21.4", "1.21.4.jar")), "client jar is last");
  assert.ok(cp.some((e) => e.includes(`natives-${HOST.os}`)) && !cp.some((e) => e.includes(`natives-${OTHER}`)), "only this OS's natives");
  for (const rel of ["versions/1.21.4/1.21.4.jar", "libraries/com/mojang/logging/1.3.0/logging-1.3.0.jar", "assets/indexes/19.json"]) assert.ok(fs.existsSync(path.join(t.root, rel)), rel);
  assert.strictEqual(fs.readdirSync(path.join(t.root, "assets", "objects")).length, 2);
  const seq = t.states.map((s) => s[0]); assert.strictEqual(seq[0], "downloading"); assert.deepStrictEqual(seq.slice(-2), ["playing", "ready"]);
  const pcts = t.states.filter((s) => s[0] === "downloading").map((s) => s[1]); assert.strictEqual(pcts.at(-1), 100); assert.ok(pcts.every((v, i) => !i || v >= pcts[i - 1]));
  assert.match(fs.readFileSync(path.join(t.gameDir, "logs", "launcher.log"), "utf8"), /\[Probe\] started/);
});
test("fabric: loader profile is merged, its jars get checksums from Maven, its main class runs", needJava, async () => {
  const t = setup({ world: { vanillaMain: "net.minecraft.client.main.Main" }, inst: { loader: "Fabric", loaderVersion: "0.16.10" } });
  const cmd = await L.prepare(t.req, t.d); assert.strictEqual(await run(cmd, t.gameDir, path.join(t.root, "l.log"), () => {}), 0);
  const p = probeOut(t.out), cp = p.get("classpath");
  assert.strictEqual(p.get("main"), "Probe"); assert.ok(cp.includes("fabric-loader-0.16.10.jar") && cp.includes("asm-9.7.jar") && !cp.includes("asm-9.3.jar"));
  assert.ok(t.w.calls.some((u) => u.endsWith("fabric-loader-0.16.10.jar.sha1")));
  assert.ok(cmd.args.indexOf("-DFabricMcEmu=net.minecraft.client.main.Main") > cmd.args.indexOf("-cp"));
  assert.strictEqual(p.args[p.args.indexOf("--version") + 1], "fabric-loader-0.16.10-1.21.4");
});
test("second launch reuses verified files and downloads nothing", needJava, async () => {
  const t = setup(); await L.prepare(t.req, t.d); const before = t.w.calls.length;
  await L.prepare(t.req, t.d);
  const again = t.w.calls.slice(before).filter((u) => !u.endsWith(".json"));
  assert.deepStrictEqual(again, [], "only metadata is re-read");
});
test("a crash on start becomes an error with the last log lines", needJava, async () => {
  const t = setup(); t.req.inst.args += " -Dprobe.exit=3"; const cmd = await L.prepare(t.req, t.d);
  assert.strictEqual(await run(cmd, t.gameDir, path.join(t.root, "c.log"), t.d.emit), 3);
  const last = t.states.at(-1); assert.strictEqual(last[0], "error"); assert.match(last[2], /exit code 3/); assert.match(last[2], /simulated crash/);
});
test("a java binary that can't start is reported, not hung", async () => {
  const states = []; const child = spawn(path.join(os.tmpdir(), "definitely-not-java-" + process.pid), []);
  assert.strictEqual(await L.supervise(child, { logFile: path.join(os.tmpdir(), "aur-nj-" + process.pid + ".log"), emit: (s, p, m) => states.push([s, m]) }), -1);
  assert.strictEqual(states.at(-1)[0], "error"); assert.match(states.at(-1)[1], /Java couldn’t start/);
});
test("automatic Java: Mojang runtime is installed with executable bits and links, and used for launch", async () => {
  const t = setup({ inst: { java: { mode: "auto" } } }); const cmd = await L.prepare(t.req, t.d);
  const exe = HOST.os === "windows" ? "bin/javaw.exe" : HOST.os === "osx" ? "jre.bundle/Contents/Home/bin/java" : "bin/java";
  assert.strictEqual(cmd.file, path.join(t.root, "runtimes", "java-runtime-delta", ...exe.split("/")));
  assert.ok(fs.existsSync(cmd.file));
  if (HOST.os !== "windows") { assert.ok(fs.statSync(cmd.file).mode & 0o100, "executable"); assert.ok(fs.lstatSync(path.join(t.root, "runtimes", "java-runtime-delta", "legal", "LICENSE")).isSymbolicLink()); }
});
test("refusals: unsupported loader, unknown version, missing Java, mismatched or unverifiable Fabric files, tampered client", async () => {
  const t = setup(); const go = (inst, d = t.d) => L.prepare({ ...t.req, inst: { ...t.req.inst, ...inst } }, d);
  await assert.rejects(go({ loader: "NeoForge", loaderVersion: "21.4.88" }), /can’t be launched yet/);
  await assert.rejects(go({ mc: "9.9.9" }), /isn’t in Mojang’s version list/);
  await assert.rejects(go({ java: { mode: "custom", path: "/no/such/java" } }), /custom Java path doesn’t exist/);
  await assert.rejects(go({ loader: "Fabric", loaderVersion: null }), /no loader version/);
  const t2 = setup({ world: { fabricLibSha: false } });
  await assert.rejects(L.prepare({ ...t2.req, inst: { ...t2.req.inst, loader: "Fabric", loaderVersion: "0.16.10" } }, t2.d), /Couldn’t get a checksum/);
  const t3 = setup(); t3.w.put(L.fabricProfileUrl("1.21.4", "0.16.10"), { id: "x", inheritsFrom: "1.20.1", mainClass: "X", libraries: [] });
  await assert.rejects(L.prepare({ ...t3.req, inst: { ...t3.req.inst, loader: "Fabric", loaderVersion: "0.16.10" } }, t3.d), /doesn’t match/);
  const t4 = setup(); t4.w.put("https://piston-data.mojang.com/v1/objects/c1/client.jar", Buffer.alloc(t4.w.bytes.get("https://piston-data.mojang.com/v1/objects/c1/client.jar").length, 1));
  await assert.rejects(L.prepare(t4.req, t4.d), /Checksum mismatch/);
  assert.ok(!fs.existsSync(path.join(t4.root, "versions", "1.21.4", "1.21.4.jar")));
});
test("extra JVM arguments: quotes kept together, non-options and launcher-owned flags refused", () => {
  assert.deepStrictEqual(L.splitJvmArgs(' -XX:+UseG1GC  "-Dmy.path=C:\\Program Files\\x" -Dflag=1 '), ["-XX:+UseG1GC", "-Dmy.path=C:\\Program Files\\x", "-Dflag=1"]);
  assert.deepStrictEqual(L.splitJvmArgs(""), []);
  assert.deepStrictEqual(L.splitJvmArgs('-Dk="a b"  -Dx=""'), ["-Dk=a b", "-Dx="], "quotes in the middle of an option group words and are removed");
  assert.throws(() => L.splitJvmArgs('-Dk="open'), /isn’t closed/);
  assert.throws(() => L.splitJvmArgs("-Xss4m evil.Main"), /isn’t a Java option/);
  for (const bad of ["-Xmx8G", "-cp x", "-classpath x", "-Xms1G"]) assert.throws(() => L.splitJvmArgs(bad), /set by the launcher/, bad);
});

test("Join: the launch carries Minecraft's quick play argument for the server, and only when asked", needJava, async () => {
  let t = setup({ inst: { server: "play.example.net" } }); let cmd = await L.prepare(t.req, t.d);
  assert.deepStrictEqual(cmd.args.slice(cmd.args.indexOf("--quickPlayMultiplayer"), cmd.args.indexOf("--quickPlayMultiplayer") + 2), ["--quickPlayMultiplayer", "play.example.net:25565"]);
  assert.ok(!cmd.args.includes("--quickPlayPath") && !cmd.args.includes("--demo"));
  t = setup(); cmd = await L.prepare(t.req, t.d); assert.ok(!cmd.args.includes("--quickPlayMultiplayer"));
  t = setup({ inst: { server: "bad address" } }); await assert.rejects(L.prepare(t.req, t.d), /server address/);
});

test("offline: an installed version launches from its saved metadata; a version that was never installed explains why it can't", needJava, async () => {
  const t = setup(); await L.prepare(t.req, t.d);
  const off = async () => { throw new Error("getaddrinfo ENOTFOUND piston-meta.mojang.com"); };
  const d2 = { ...t.d, fetchJson: off, fetchText: off, fetchBytes: off }, states = []; d2.emit = (s, p, m) => states.push(m);
  const cmd = await L.prepare(t.req, d2); assert.ok(cmd.args.includes("Probe")); assert.ok(states.some((m) => /Offline: using the saved copy of 1\.21\.4/.test(m || "")));
  const fresh = setup(); const d3 = { ...fresh.d, fetchJson: off, fetchText: off, fetchBytes: off };
  await assert.rejects(L.prepare(fresh.req, d3), /no saved copy yet\. Connect to the internet once/);
});
test("Java: a custom Java older than the version needs is refused before launch, with both versions named", needJava, async () => {
  let t = setup(); t.d.javaMajor = async () => 17; await assert.rejects(L.prepare(t.req, t.d), /Minecraft 1\.21\.4 needs Java 21, but the custom Java is Java 17/);
  t = setup(); t.d.javaMajor = async () => null; await assert.rejects(L.prepare(t.req, t.d), /Couldn’t tell which Java version/);
  t = setup(); t.d.javaMajor = async () => 21; assert.ok(await L.prepare(t.req, t.d));
  assert.deepStrictEqual(['openjdk version "21.0.2" 2024-01-16', 'java version "1.8.0_392"', 'openjdk version "17" 2021-09-14', "garbage"].map(L.parseJavaVersion), [21, 8, 17, null]);
});
test("a snapshot launches through the same pipeline with its own metadata and is reported as a snapshot", needJava, async () => {
  const t = setup(); const v = JSON.parse(t.w.bytes.get("https://piston-meta.mojang.com/v1/packages/v/1.21.4.json").toString());
  t.w.put("https://piston-meta.mojang.com/v1/packages/v/26.1-snapshot-1.json", { ...v, id: "26.1-snapshot-1", type: "snapshot", javaVersion: { component: "java-runtime-delta", majorVersion: 21 } });
  t.w.put(L.MANIFEST, { latest: { release: "1.21.4", snapshot: "26.1-snapshot-1" }, versions: [{ id: "26.1-snapshot-1", type: "snapshot", url: "https://piston-meta.mojang.com/v1/packages/v/26.1-snapshot-1.json", releaseTime: "2026-01-13T10:00:00Z" }, { id: "1.21.4", type: "release", url: "https://piston-meta.mojang.com/v1/packages/v/1.21.4.json", releaseTime: "2024-12-03T10:00:00Z" }] });
  const cmd = await L.prepare({ ...t.req, inst: { ...t.req.inst, mc: "26.1-snapshot-1" } }, t.d), a = cmd.args;
  assert.strictEqual(a[a.indexOf("--version") + 1], "26.1-snapshot-1"); assert.strictEqual(a[a.indexOf("--versionType") + 1], "snapshot");
});

test("fetchClientJar: only the game jar, from Mojang's version file, checked against its SHA-1; no sign-in", async () => {
  const t = setup(); const jar = await L.fetchClientJar("1.21.4", { root: t.root, fetchJson: t.w.fetchJson, fetchBytes: t.w.fetchBytes });
  assert.strictEqual(jar, path.join(t.root, "versions", "1.21.4", "1.21.4.jar")); assert.ok(fs.existsSync(jar));
  assert.ok(!fs.existsSync(path.join(t.root, "libraries")) && !fs.existsSync(path.join(t.root, "assets", "objects")), "nothing but the jar");
  await assert.rejects(L.fetchClientJar("9.9.9", { root: t.root, fetchJson: t.w.fetchJson, fetchBytes: t.w.fetchBytes }), /isn’t in Mojang’s version list/);
});
