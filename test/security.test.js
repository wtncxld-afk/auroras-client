// Security: how private data is stored (securestore.js), what the friends server is allowed to show (friends.js),
// and a source scan that fails if anything RAT- or malware-like appears: unknown network hosts, eval, shell
// commands, Java networking or process launching, unpinned GitHub Actions, or the update signing key in git.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path");
const S = require("../securestore.js"), F = require("../friends.js");
const ROOT = path.join(__dirname, "..");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "auroras-sec-"));
// A stand-in for the OS encryption: reversible, but never the plain text.
const fakeCrypt = (on = true) => ({ available: () => on, encrypt: (t) => Buffer.from("ENC:" + Buffer.from(t).toString("hex")), decrypt: (b) => Buffer.from(String(b).slice(4), "hex").toString() });

test("secrets are sealed by the OS and opened back; nothing readable on disk", () => {
  const v = S.createVault(fakeCrypt()), rec = v.seal("refresh-token-123");
  assert.equal(rec.enc, true); assert.ok(!Buffer.from(rec.data, "base64").toString().includes("refresh-token-123"));
  assert.equal(v.open(rec), "refresh-token-123");
});
test("when the OS can't encrypt, seal refuses instead of writing plain text", () => {
  const v = S.createVault(fakeCrypt(false)); assert.equal(v.seal("secret"), null); assert.equal(v.available(), false);
  const broken = S.createVault({ available: () => { throw new Error("no keyring"); }, encrypt() {}, decrypt() {} }); assert.equal(broken.seal("x"), null);
});
test("old plain-text records still open once so they can be migrated; garbage opens to null", () => {
  const v = S.createVault(fakeCrypt());
  assert.equal(v.open({ enc: false, data: Buffer.from("old").toString("base64") }), "old");
  assert.equal(v.open({ enc: true, data: "!!!" }), "");
  assert.equal(v.open(null), null); assert.equal(v.open({ enc: true }), null);
  const bad = S.createVault({ available: () => true, encrypt: () => Buffer.from(""), decrypt: () => { throw new Error("wrong user"); } });
  assert.equal(bad.open({ enc: true, data: "AAAA" }), null);
});
test("private files are written atomically and owner-only", { skip: process.platform === "win32" && "POSIX modes" }, () => {
  const d = tmp(), f = path.join(d, "sub", "accounts.json");
  S.writePrivate(f, '{"a":1}'); assert.equal(fs.readFileSync(f, "utf8"), '{"a":1}');
  assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  fs.chmodSync(f, 0o644); S.writePrivate(f, '{"a":2}'); assert.equal(fs.statSync(f).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(path.dirname(f)), ["accounts.json"], "no temp files left behind");
  S.lockDir(d); assert.equal(fs.statSync(d).mode & 0o777, 0o700);
  assert.deepEqual(S.readJson(path.join(d, "missing.json")), {});
});

test("main.js never writes a secret without the vault", () => {
  const src = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
  assert.ok(!/Buffer\.from\((token|key|txt)\)\.toString\("base64"\)/.test(src), "no plain base64 fallback for secrets");
  assert.ok(!/safeStorage\.(en|de)cryptString/.test(src.replace(/const vault = [^\n]+/, "")), "all encryption goes through the vault");
  for (const f of ["settingsFile", "accFile", "spTokFile"]) assert.ok(!new RegExp("fs\\.writeFileSync\\(" + f).test(src), f + " is written with writePrivate");
  assert.match(src, /setPermissionRequestHandler\(\(_wc, _perm, cb\) => cb\(false\)\)/);
  assert.match(src, /will-attach-webview/); assert.match(src, /lockWindow\(w\)/);
  for (const m of src.matchAll(/webPreferences: \{([^}]*)\}/g)) { assert.match(m[1], /contextIsolation: true/); assert.match(m[1], /sandbox: true/); assert.match(m[1], /nodeIntegration: false/); }
});

test("a hostile friends server can't inject anything into the launcher", () => {
  const evil = '"><img src=x onerror=alert(1)>';
  const o = F.cleanOverview({ me: { uuid: "a".repeat(32), name: "Steve" },
    friends: [{ uuid: "b".repeat(32), name: "Alex", state: "playing", server: "vexvanilla.net:25565", instance: "Main" },
      { uuid: evil, name: "Bad", state: "online" }, { uuid: "c".repeat(32), name: evil, state: "online" },
      { uuid: "d".repeat(32), name: "Dan", state: "playing", server: evil }, { uuid: "e".repeat(32), name: "Eve", state: "hacking", lastSeen: "nope" }],
    incoming: [{ uuid: "f".repeat(32), name: "Fay" }, { uuid: "1", name: "x" }], outgoing: "not a list",
    invites: [{ uuid: "b".repeat(32), name: "Alex", server: "play.example.net" }, { uuid: "b".repeat(32), name: "Alex", server: "javascript:alert(1)" }] });
  assert.deepEqual(o.friends.map((f) => f.name), ["Alex", "Dan", "Eve"]);
  assert.equal(o.friends[0].server, "vexvanilla.net:25565"); assert.equal(o.friends[1].server, null);
  assert.equal(o.friends[2].state, "offline"); assert.equal(o.friends[2].lastSeen, null);
  assert.deepEqual(o.incoming.map((r) => r.name), ["Fay"]); assert.deepEqual(o.outgoing, []);
  assert.deepEqual(o.invites.map((v) => v.server), ["play.example.net"]);
  assert.ok(!JSON.stringify(o).includes("<"));
  assert.throws(() => F.cleanOverview({ me: { uuid: "x", name: "y" } }), /couldn’t read/);
});

// ---------- Source scan ----------
// .claude holds local agent worktrees (other checkouts of this repo), not shipped code.
const walk = (dir, ok, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (["node_modules", ".git", "out", "dist", "build", "vendor", ".gradle", "test-results", ".claude"].includes(e.name)) continue; const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, ok, out); else if (ok(p)) out.push(p); } return out; };
const appJs = () => [...walk(ROOT, (p) => /\.js$/.test(p) && !p.includes(path.sep + "test" + path.sep) && !p.includes(path.sep + "scripts" + path.sep)), ...walk(path.join(ROOT, "renderer-src"), (p) => /\.(js|html)$/.test(p))];
// Every place the launcher, its UI or the friends server may talk to. Anything new must be added here on purpose.
const HOSTS = new Set(["api.modrinth.com", "modrinth.com", "cdn.modrinth.com", "api.curseforge.com", "api.minecraftservices.com", "sessionserver.mojang.com",
  "piston-meta.mojang.com", "launchermeta.mojang.com", "libraries.minecraft.net", "resources.download.minecraft.net", "meta.fabricmc.net", "maven.fabricmc.net",
  "maven.neoforged.net", "files.minecraftforge.net", "maven.minecraftforge.net", "meta.quiltmc.org", "login.microsoftonline.com", "login.live.com", "user.auth.xboxlive.com",
  "xsts.auth.xboxlive.com", "auth.xboxlive.com", "accounts.spotify.com", "api.spotify.com", "api.github.com", "github.com", "cdnjs.cloudflare.com",
  "fonts.googleapis.com", "fonts.gstatic.com", "portal.azure.com", "127.0.0.1", "localhost", "www.w3.org", "example.com", "friends.example.net", "x", "textures.minecraft.net", "crafatar.com", "www.skinmc.net", "skinmc.net", "mc-heads.net", "minotar.net",
  // Modrinth modpacks (.mrpack) may only download from the hosts the format allows (checked in modpack.js, see the test below).
  "raw.githubusercontent.com", "gitlab.com"]);
// The .mrpack format allows exactly these download hosts. A modpack file can't add any other.
const MODPACK_HOSTS = ["cdn.modrinth.com", "github.com", "raw.githubusercontent.com", "gitlab.com"];
test("modpacks download only from the hosts the .mrpack format allows", () => {
  const M = require("../modpack.js");
  assert.deepEqual([...M.HOSTS].sort(), [...MODPACK_HOSTS].sort());
  for (const h of MODPACK_HOSTS) assert.ok(HOSTS.has(h), h + " is a known host");
  for (const u of ["http://cdn.modrinth.com/x.jar", "https://cdn.modrinth.com.evil.net/x.jar", "https://evil.net/cdn.modrinth.com/x.jar", "https://user@cdn.modrinth.com/x.jar", "https://cdn.modrinth.com:8443/x.jar", "https://edge.forgecdn.net/x.jar", "file:///etc/passwd", "javascript:alert(1)"])
    assert.equal(M.allowedUrl(u), false, u);
  // main.js streams modpack files only through packStream, which checks the host before connecting.
  assert.match(fs.readFileSync(path.join(ROOT, "main.js"), "utf8"), /async function\* packStream\(url, \{ maxBytes \}\) \{\n  if \(!modpack\.allowedUrl\(url\)\) throw/);
});

test("the launcher only talks to known, legitimate hosts", () => {
  const bad = [];
  for (const f of appJs()) for (const m of fs.readFileSync(f, "utf8").matchAll(/\b(?:https?|wss?):\/\/([a-zA-Z0-9.-]+)/g)) if (!HOSTS.has(m[1].toLowerCase())) bad.push(path.relative(ROOT, f) + ": " + m[0]);
  assert.deepEqual(bad, []);
});
test("no eval, no shell commands, no hidden downloads-and-run", () => {
  const bad = [];
  for (const f of appJs()) { const src = fs.readFileSync(f, "utf8"), rel = path.relative(ROOT, f);
    if (/\beval\s*\(|new Function\s*\(/.test(src)) bad.push(rel + ": eval");
    if (/child_process/.test(src) && rel !== "main.js") bad.push(rel + ": child_process");
    // Allowed (execFile, no shell): asking a Java install its version, and Windows' tasklist for the Spotify window title.
    if (/\b(exec|execSync|execFile|execFileSync)\s*\(/.test(src.replace(/\.exec\(/g, "").replace('require("child_process").execFile(p, ["-version"], {', "").replace('require("child_process").execFile("tasklist", ["/v", "/fo", "csv", "/nh", "/fi", "imagename eq Spotify.exe"], {', ""))) bad.push(rel + ": exec");
    if (/shell:\s*true/.test(src)) bad.push(rel + ": shell:true");
    if (/\b(keylog|clipboard\.read|desktopCapturer|webhook|discord(app)?\.com\/api)/i.test(src)) bad.push(rel + ": suspicious API");
  }
  // The only process the launcher starts is Java, to run Minecraft.
  const main = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
  assert.deepEqual([...main.matchAll(/\bspawn\(([^,]+),/g)].map((m) => m[1]), ["updReady.file", "cmd.file"]);
  assert.match(main, /selfupdate.fetchInstaller\(p, /, "the update installer only runs after its checksum is verified");
  assert.deepEqual(bad, []);
});
test("the Java mod has no networking, no process launching, no class loading from outside", () => {
  const bad = [];
  for (const f of walk(path.join(ROOT, "client-mod"), (p) => p.endsWith(".java"))) { const src = fs.readFileSync(f, "utf8"), rel = path.relative(ROOT, f);
    if (/java\.net\.|HttpClient|Socket\b|URLConnection/.test(src)) bad.push(rel + ": network");
    if (/ProcessBuilder|Runtime\.getRuntime\(\)\.exec/.test(src)) bad.push(rel + ": process");
    if (/URLClassLoader|defineClass|ScriptEngine|System\.load(Library)?\(/.test(src)) bad.push(rel + ": code loading");
    for (const m of src.matchAll(/Class\.forName\("([^"]+)"/g)) if (!/^(net\.minecraft|com\.mojang)\./.test(m[1])) bad.push(rel + ": reflection on " + m[1]);
  }
  assert.deepEqual(bad, []);
});
test("no binaries or scripts hidden in the project", () => {
  const bad = walk(ROOT, (p) => /\.(exe|dll|so|dylib|scr|ps1|vbs|msi|jar|class|cmd|sh)$/i.test(p) && !/gradlew$/.test(p)).map((p) => path.relative(ROOT, p));
  assert.deepEqual(bad, []);
  assert.match(fs.readFileSync(path.join(ROOT, "Run Auroras.bat"), "utf8").replace(/\r/g, ""), /^@echo off\n(.*\n)*.*npm/i);
});
test("signing key is never committed, actions are pinned, dependencies are known open source", () => {
  assert.match(fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8"), /^update-private-key\.pem$/m);
  for (const f of walk(path.join(ROOT, ".github"), (p) => /\.ya?ml$/.test(p))) for (const m of fs.readFileSync(f, "utf8").matchAll(/uses:\s*(\S+)/g)) assert.match(m[1], /@[0-9a-f]{40}$/, m[1] + " must be pinned to a commit");
  const pkg = require("../package.json");
  assert.deepEqual(Object.keys(pkg.dependencies || {}), []);
  assert.deepEqual(Object.keys(pkg.devDependencies).sort(), ["electron", "electron-builder", "jszip", "three"]);
  assert.deepEqual(Object.keys(require("../friends-server/package.json").dependencies || {}), []);
  const scripts = Object.entries(pkg.scripts).filter(([k]) => /install/.test(k)); assert.deepEqual(scripts, [["postinstall", "node scripts/vendor.js"]]);
});
test("every module main.js loads ships in the installer", () => {
  const files = require("../package.json").build.files, main = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");
  const req = [...new Set([...main.matchAll(/require\("\.\/([\w.-]+?)(?:\.js)?"\)/g)].map((m) => m[1] + ".js"))];
  assert.deepEqual(req.filter((r) => !files.includes(r)), []);
});
