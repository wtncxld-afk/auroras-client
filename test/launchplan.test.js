const test = require("node:test"), assert = require("node:assert");
const lp = require("../launchplan.js");

const art = (n, p) => ({ name: n, downloads: { artifact: { path: p, url: "https://libraries.minecraft.net/" + p, sha1: "s".repeat(40), size: 5 } } });
const vanilla = () => ({ id: "1.21.4", mainClass: "net.minecraft.client.main.Main", javaVersion: { component: "java-runtime-delta", majorVersion: 21 },
  assetIndex: { id: "19", url: "https://piston-meta.mojang.com/v1/packages/abc/19.json", sha1: "a".repeat(40), size: 1 }, downloads: { client: { url: "https://piston-data.mojang.com/v1/objects/aaa/client.jar", sha1: "b".repeat(40), size: 9 } },
  libraries: [art("com.mojang:logging:1.3.0", "com/mojang/logging/1.3.0/logging-1.3.0.jar"),
    { ...art("org.lwjgl:lwjgl:3.3.3:natives-windows", "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar"), rules: [{ action: "allow", os: { name: "windows" } }] },
    { ...art("org.lwjgl:lwjgl:3.3.3:natives-windows-x86", "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows-x86.jar"), rules: [{ action: "allow", os: { name: "windows", arch: "x86" } }] },
    { ...art("org.lwjgl:lwjgl:3.3.3:natives-macos", "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-macos.jar"), rules: [{ action: "allow", os: { name: "osx" } }] },
    art("net.java.dev.jna:jna:5.14.0", "net/java/dev/jna/jna/5.14.0/jna-5.14.0.jar"), art("org.ow2.asm:asm:9.3", "org/ow2/asm/asm/9.3/asm-9.3.jar")],
  arguments: { game: ["--username", "${auth_player_name}", "--version", "${version_name}", "--gameDir", "${game_directory}", "--assetsDir", "${assets_root}", "--assetIndex", "${assets_index_name}", "--uuid", "${auth_uuid}", "--accessToken", "${auth_access_token}", "--userType", "${user_type}",
      { rules: [{ action: "allow", features: { has_custom_resolution: true } }], value: ["--width", "${resolution_width}", "--height", "${resolution_height}"] }],
    jvm: [{ rules: [{ action: "allow", os: { name: "windows" } }], value: "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump" }, { rules: [{ action: "allow", os: { name: "osx" } }], value: ["-XstartOnFirstThread"] }, "-Djava.library.path=${natives_directory}", "-Dminecraft.launcher.brand=${launcher_name}", "-cp", "${classpath}"] } });
const fabric = () => ({ id: "fabric-loader-0.16.10-1.21.4", inheritsFrom: "1.21.4", mainClass: "net.fabricmc.loader.impl.launch.knot.KnotClient", arguments: { game: [], jvm: ["-DFabricMcEmu=net.minecraft.client.main.Main"] },
  libraries: [{ name: "net.fabricmc:fabric-loader:0.16.10", url: "https://maven.fabricmc.net/" }, { name: "org.ow2.asm:asm:9.7", url: "https://maven.fabricmc.net/" }, { name: "net.fabricmc:intermediary:1.21.4", url: "https://maven.fabricmc.net/" }] });
const WIN = { os: "windows", arch: "x86_64" }, MAC = { os: "osx", arch: "arm64" };
const ctx = { auth_player_name: "Steve", version_name: "fabric-loader-0.16.10-1.21.4", game_directory: "C:/g", assets_root: "C:/a", assets_index_name: "19", auth_uuid: "u", auth_access_token: "tok", user_type: "msa", natives_directory: "C:/n", launcher_name: "Auroras", classpath: "CP" };

test("rule engine: default allow, OS and arch matching, last matching rule wins, features", () => {
  assert.ok(lp.allowed(undefined, WIN) && lp.allowed([], WIN));
  assert.ok(lp.allowed([{ action: "allow", os: { name: "windows" } }], WIN) && !lp.allowed([{ action: "allow", os: { name: "osx" } }], WIN));
  assert.ok(!lp.allowed([{ action: "allow", os: { name: "windows", arch: "x86" } }], WIN), "64-bit Windows must not match the 32-bit rule");
  assert.ok(!lp.allowed([{ action: "allow" }, { action: "disallow", os: { name: "windows" } }], WIN) && lp.allowed([{ action: "allow" }, { action: "disallow", os: { name: "windows" } }], MAC));
  assert.ok(lp.allowed([{ action: "allow", features: { has_custom_resolution: true } }], WIN, { has_custom_resolution: true }) && !lp.allowed([{ action: "allow", features: { has_custom_resolution: true } }], WIN, {}));
});
test("libraries are filtered per operating system", () => {
  const names = (env) => lp.libraryDownloads(vanilla(), env).map((l) => l.name);
  assert.deepStrictEqual(names(WIN), ["com.mojang:logging:1.3.0", "org.lwjgl:lwjgl:3.3.3:natives-windows", "net.java.dev.jna:jna:5.14.0", "org.ow2.asm:asm:9.3"]);
  assert.ok(names(MAC).includes("org.lwjgl:lwjgl:3.3.3:natives-macos") && !names(MAC).includes("org.lwjgl:lwjgl:3.3.3:natives-windows"));
});
test("download hosts are allowlisted and https only", () => {
  const bad = vanilla(); bad.libraries.push({ name: "evil:lib:1", downloads: { artifact: { path: "e/l/1/l-1.jar", url: "https://evil.example/l.jar" } } });
  assert.throws(() => lp.libraryDownloads(bad, WIN), /isn’t allowed/);
  const http = vanilla(); http.libraries[0].downloads.artifact.url = "http://libraries.minecraft.net/x.jar"; assert.throws(() => lp.libraryDownloads(http, WIN), /isn’t allowed/);
  assert.ok(lp.urlAllowed("https://maven.fabricmc.net/x") && !lp.urlAllowed("ftp://x") && !lp.urlAllowed("not a url"));
  const v = vanilla(); v.downloads.client.url = "https://evil.example/c.jar"; assert.throws(() => lp.mainDownloads(v), /not allowed/);
  assert.deepStrictEqual(Object.keys(lp.mainDownloads(vanilla())), ["client", "assetIndex"]);
});
test("Fabric profile merges onto vanilla: main class, library override, argument order", () => {
  const m = lp.mergeProfiles(vanilla(), fabric());
  assert.strictEqual(m.mainClass, "net.fabricmc.loader.impl.launch.knot.KnotClient"); assert.strictEqual(m.id, "fabric-loader-0.16.10-1.21.4"); assert.strictEqual(m.inheritsFrom, undefined);
  assert.deepStrictEqual(m.libraries.filter((l) => l.name.includes("asm")).map((l) => l.name), ["org.ow2.asm:asm:9.7"]);
  assert.ok(m.libraries.some((l) => l.name === "net.fabricmc:fabric-loader:0.16.10")); assert.strictEqual(m.javaVersion.majorVersion, 21); assert.strictEqual(m.assetIndex.id, "19"); assert.ok(m.downloads.client);
  assert.strictEqual(m.arguments.jvm.at(-1), "-DFabricMcEmu=net.minecraft.client.main.Main");
  const dl = lp.libraryDownloads(m, WIN).find((l) => l.name === "net.fabricmc:fabric-loader:0.16.10");
  assert.strictEqual(dl.path, "net/fabricmc/fabric-loader/0.16.10/fabric-loader-0.16.10.jar"); assert.strictEqual(dl.url, "https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.16.10/fabric-loader-0.16.10.jar"); assert.strictEqual(dl.sha1, null);
});
test("classpath: libraries once each, client jar last, correct separator", () => {
  const cp = lp.classpath(lp.mergeProfiles(vanilla(), fabric()), WIN, { librariesDir: "C:\\L", clientJar: "C:\\V\\1.21.4.jar", sep: ";" }).split(";");
  assert.strictEqual(cp.at(-1), "C:\\V\\1.21.4.jar"); assert.strictEqual(new Set(cp).size, cp.length);
  assert.ok(cp.some((p) => p.includes("natives-windows.jar")) && !cp.some((p) => p.includes("natives-macos")) && cp.some((p) => p.includes("asm-9.7")) && !cp.some((p) => p.includes("asm-9.3")));
});
test("launch arguments: placeholders, OS rules, feature gating, unresolved values are refused", () => {
  const m = lp.mergeProfiles(vanilla(), fabric()), w = lp.buildArgs(m, WIN, ctx), mac = lp.buildArgs(m, MAC, ctx);
  assert.deepStrictEqual(w.game.slice(0, 4), ["--username", "Steve", "--version", "fabric-loader-0.16.10-1.21.4"]); assert.ok(w.game.includes("tok") && !w.game.includes("--width"));
  assert.ok(w.jvm.some((a) => a.startsWith("-XX:HeapDumpPath")) && !w.jvm.includes("-XstartOnFirstThread") && mac.jvm.includes("-XstartOnFirstThread") && !mac.jvm.some((a) => a.startsWith("-XX:HeapDumpPath")));
  assert.ok(w.jvm.indexOf("-DFabricMcEmu=net.minecraft.client.main.Main") > w.jvm.indexOf("-cp"), "loader JVM arguments come after the vanilla ones");
  assert.strictEqual(w.jvm[w.jvm.indexOf("-cp") + 1], "CP"); assert.strictEqual(w.mainClass, "net.fabricmc.loader.impl.launch.knot.KnotClient");
  const sized = lp.buildArgs(m, WIN, { ...ctx, resolution_width: 1280, resolution_height: 720 }, { has_custom_resolution: true }); assert.deepStrictEqual(sized.game.slice(-4), ["--width", "1280", "--height", "720"]);
  const { auth_access_token, ...partial } = ctx; assert.throws(() => lp.buildArgs(m, WIN, partial), /auth_access_token/);
  assert.throws(() => lp.buildArgs({ ...m, mainClass: undefined }, WIN, ctx), /main class/);
});
test("command: argv array (no shell), memory bounds, usernames with spaces stay one argument", () => {
  const built = lp.buildArgs(lp.mergeProfiles(vanilla(), fabric()), WIN, { ...ctx, auth_player_name: "a b; rm -rf /" });
  const c = lp.command("C:/java/bin/javaw.exe", built, { memMb: 4096, extraJvm: ["-XX:+UseG1GC"] });
  assert.strictEqual(c.file, "C:/java/bin/javaw.exe"); assert.strictEqual(c.args[0], "-Xmx4096M"); assert.ok(c.args.includes("a b; rm -rf /") && c.args.includes("-XX:+UseG1GC"));
  assert.ok(c.args.indexOf("net.fabricmc.loader.impl.launch.knot.KnotClient") < c.args.indexOf("--username"));
  assert.throws(() => lp.command("j", built, { memMb: 100 }), /Memory/); assert.throws(() => lp.command("j", built, { memMb: "4096" }), /Memory/);
});
test("command: tuned G1 flags by default, the heap starts at its maximum, and your own GC arguments replace ours", () => {
  const built = lp.buildArgs(lp.mergeProfiles(vanilla(), fabric()), WIN, ctx);
  const d = lp.command("j", built, { memMb: 4096 });
  assert.deepStrictEqual(d.args.slice(0, 2), ["-Xmx4096M", "-Xms4096M"]);
  assert.ok(d.args.includes("-XX:+UseG1GC") && d.args.includes("-XX:MaxGCPauseMillis=40"));
  assert.ok(d.args.indexOf("-XX:+UseG1GC") < d.args.indexOf(built.mainClass), "JVM options come before the main class");
  const z = lp.command("j", built, { memMb: 4096, extraJvm: ["-XX:+UseZGC"] });
  assert.ok(!z.args.includes("-XX:+UseG1GC") && z.args.includes("-XX:+UseZGC"), "a collector you chose is not overridden");
  const g = lp.command("j", built, { memMb: 4096, extraJvm: ["-XX:G1HeapRegionSize=16M"] });
  assert.ok(!g.args.includes("-XX:G1HeapRegionSize=8M") && g.args.includes("-XX:G1HeapRegionSize=16M"));
  assert.strictEqual(new Set(d.args.filter((a) => a.startsWith("-XX"))).size, d.args.filter((a) => a.startsWith("-XX")).length, "no duplicate flags");
});
test("asset index to downloadable objects, with hash validation", () => {
  const hash = "ab" + "c".repeat(38), o = lp.assetObjects({ objects: { "icons/icon.png": { hash, size: 100 } } })[0];
  assert.strictEqual(o.path, `objects/ab/${hash}`); assert.strictEqual(o.url, `https://resources.download.minecraft.net/ab/${hash}`);
  assert.throws(() => lp.assetObjects({ objects: { x: { hash: "../../etc/passwd", size: 1 } } }), /Bad asset hash/);
});
