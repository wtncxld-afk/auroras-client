// The launch pipeline: official metadata -> verified downloads -> one java process.
// All I/O that touches the network or starts processes is injected, so the whole flow runs in tests without Mojang.
const fs = require("fs"), path = require("path");
const lp = require("./launchplan"), inst = require("./installer");

const MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const JAVA_INDEX = "https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json";
const fabricProfileUrl = (mc, loader) => `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(mc)}/${encodeURIComponent(loader)}/profile/json`;

/** Splits the instance's extra JVM arguments. Only options (starting with "-") are accepted, so a typo can't replace the main class. */
function splitJvmArgs(s) {
  const out = []; let cur = "", has = false, q = false;
  for (const ch of String(s || "")) {
    if (ch === '"') { q = !q; has = true; } else if (!q && /\s/.test(ch)) { if (has) out.push(cur); cur = ""; has = false; } else { cur += ch; has = true; }
  }
  if (q) throw new Error("A quote in the launch arguments isn’t closed.");
  if (has) out.push(cur);
  for (const a of out) if (/^-(cp|classpath)$|^--class-path$|^-Xmx|^-Xms/.test(a)) throw new Error(`"${a}" is set by the launcher${/^-Xm/.test(a) ? ". Use the memory setting instead" : ""}.`);
  for (const a of out) if (!a.startsWith("-")) throw new Error(`Launch argument "${a}" isn’t a Java option. Options start with a dash, like -XX:+UseG1GC.`);
  return out;
}
async function json(d, url) { if (!lp.urlAllowed(url)) throw new Error("Metadata host not allowed: " + url); return d.fetchJson(url); }
/**
 * Metadata with an on-disk copy: fetched fresh when possible and saved under root/rel; when the network fails the saved
 * copy is used, so an installed version still launches offline. Returns { value, offline }.
 */
async function cachedJson(d, url, rel, what) {
  const p = inst.safeJoin(d.root, rel);
  try { const v = await json(d, url); fs.mkdirSync(path.dirname(p), { recursive: true }); const tmp = p + ".tmp" + process.pid; fs.writeFileSync(tmp, JSON.stringify(v)); fs.renameSync(tmp, p); return { value: v, offline: false }; }
  catch (e) {
    if (/not allowed/.test(e.message)) throw e;
    try { return { value: JSON.parse(fs.readFileSync(p, "utf8")), offline: true }; }
    catch { throw new Error(`Couldn’t download ${what} (${e.message}) and there’s no saved copy yet. Connect to the internet once to install it.`); }
  }
}
/** "java version \"21.0.2\"", "openjdk version \"17.0.9\"", "java version \"1.8.0_392\"" -> 21, 17, 8. null when unreadable. */
function parseJavaVersion(text) {
  const m = /version "(\d+)(?:\.(\d+))?[^"]*"/.exec(String(text || "")); if (!m) return null;
  const a = +m[1]; return a === 1 && m[2] ? +m[2] : a;
}

/** Fabric Maven artifacts often have no checksum in the profile; the .sha1 file next to each jar provides it. */
async function fillChecksums(libs, d) {
  for (const l of libs) {
    if (l.sha1) continue;
    let t; try { t = String(await d.fetchText(l.url + ".sha1")).trim().slice(0, 40); } catch { t = ""; }
    if (!/^[0-9a-f]{40}$/i.test(t)) throw new Error("Couldn’t get a checksum for " + l.name + ", so it won’t be downloaded.");
    l.sha1 = t.toLowerCase();
  }
  return libs;
}

/**
 * req  = { inst: {id, mc, loader, loaderVersion, memMb, args, java:{mode, path}}, auth: {name, uuid, token, xuid, clientId, userType} }
 * d    = { root, gameDir, env:{os, arch}, fetchJson, fetchText, fetchBytes, emit(state, pct, msg), exists(path) }
 * Returns the command to run; nothing is started here.
 */
async function prepare(req, d) {
  const { inst: I, auth: A } = req, root = d.root, env = d.env, emit = d.emit || (() => {});
  if (I.loader !== "Vanilla" && I.loader !== "Fabric") throw new Error(`${I.loader} instances can’t be launched yet. Fabric and Vanilla are supported.`);
  if (I.loader === "Fabric" && !I.loaderVersion) throw new Error("This Fabric instance has no loader version. Recreate it while online.");
  emit("downloading", 0, "Reading version information");
  let offline = false, vanilla;
  const versionRel = `versions/${I.mc}/${I.mc}.json`;
  try {
    const mf = await cachedJson(d, MANIFEST, "versions/version_manifest_v2.json", "Mojang’s version list"); offline = mf.offline;
    const entry = (mf.value.versions || []).find((v) => v.id === I.mc);
    if (!entry) throw new Error(`Minecraft ${I.mc} isn’t in Mojang’s version list.`);
    const vr = await cachedJson(d, entry.url, versionRel, `the ${I.mc} version file`); vanilla = vr.value; offline = offline || vr.offline;
  } catch (e) {
    // No version list at all: an already-installed version can still start from its saved version file.
    try { vanilla = JSON.parse(fs.readFileSync(inst.safeJoin(root, versionRel), "utf8")); offline = true; } catch { throw e; }
  }
  if (vanilla.id !== I.mc) throw new Error("Mojang returned the wrong version file.");
  if (offline) emit("downloading", 0, "Offline: using the saved copy of " + I.mc);
  let profile = vanilla;
  if (I.loader === "Fabric") {
    const fab = (await cachedJson(d, fabricProfileUrl(I.mc, I.loaderVersion), `versions/fabric-loader-${I.loaderVersion}-${I.mc}/profile.json`, "the Fabric profile")).value;
    if (fab.inheritsFrom !== I.mc) throw new Error("The Fabric profile doesn’t match this Minecraft version.");
    profile = lp.mergeProfiles(vanilla, fab);
  }
  const libs = await fillChecksums(lp.libraryDownloads(profile, env), d), main = lp.mainDownloads(vanilla);
  const assetIndex = (await cachedJson(d, main.assetIndex.url, `assets/indexes/${main.assetIndex.id}.json`, "the asset index")).value, objects = lp.assetObjects(assetIndex);

  let javaPath, runtime = [], links = [];
  if (I.java && I.java.mode === "custom") {
    javaPath = String(I.java.path || ""); if (!javaPath || !d.exists(javaPath)) throw new Error("The custom Java path doesn’t exist: " + (javaPath || "(empty)"));
    // The version file says which Java it needs; refuse an older one up front instead of letting the game crash.
    const need = vanilla.javaVersion && vanilla.javaVersion.majorVersion, have = d.javaMajor ? await d.javaMajor(javaPath) : null;
    if (need && have != null && have < need) throw new Error(`Minecraft ${I.mc} needs Java ${need}, but the custom Java is Java ${have}. Choose Automatic or point to Java ${need} or newer.`);
    if (need && d.javaMajor && have == null) throw new Error(`Couldn’t tell which Java version is at ${javaPath}. Minecraft ${I.mc} needs Java ${need}.`);
  } else {
    const comp = vanilla.javaVersion && vanilla.javaVersion.component; if (!comp) throw new Error("This version doesn’t say which Java it needs. Set a custom Java path.");
    const plat = inst.runtimePlatform(env.os, env.arch), idx = (await cachedJson(d, JAVA_INDEX, "runtimes/index.json", "Mojang’s Java runtime list")).value, avail = idx[plat] && idx[plat][comp];
    if (!avail || !avail.length) throw new Error(`Mojang doesn’t provide ${comp} (Java ${vanilla.javaVersion.majorVersion || "?"}) for ${plat}. Set a custom Java path to Java ${vanilla.javaVersion.majorVersion || "of that version"} or newer.`);
    const rt = inst.runtimeFiles((await cachedJson(d, avail[0].manifest.url, `runtimes/${comp}.manifest.json`, `the ${comp} runtime`)).value), base = `runtimes/${comp}/`;
    runtime = rt.files.map((f) => ({ ...f, path: base + f.path }));
    javaPath = inst.safeJoin(root, base + inst.javaExecutable(rt.files, env.os));
    links = rt.links.map((l) => ({ path: inst.safeJoin(root, base + l.path), target: l.target }));
  }

  const clientRel = `versions/${I.mc}/${I.mc}.jar`;
  const items = [{ path: clientRel, url: main.client.url, sha1: main.client.sha1, size: main.client.size },
    ...libs.map((l) => ({ path: "libraries/" + l.path, url: l.url, sha1: l.sha1, size: l.size })),
    ...objects.map((o) => ({ path: "assets/" + o.path, url: o.url, sha1: o.hash, size: o.size, verify: "size" })), ...runtime];
  try { await inst.ensureFiles(items, { root, fetchBytes: d.fetchBytes, concurrency: 16, sleep: d.sleep, onProgress: (f) => emit("downloading", Math.floor(f * 100), "Downloading game files") }); }
  catch (e) { throw offline ? new Error("You’re offline and some files for " + I.mc + " aren’t downloaded yet. " + e.message) : e; }
  for (const l of links) { try { fs.mkdirSync(path.dirname(l.path), { recursive: true }); if (!fs.existsSync(l.path)) fs.symlinkSync(l.target, l.path); } catch {} }

  const sep = env.os === "windows" ? ";" : ":", librariesDir = path.join(root, "libraries"), nativesDir = path.join(root, "natives", I.mc);
  fs.mkdirSync(nativesDir, { recursive: true }); fs.mkdirSync(d.gameDir, { recursive: true });
  const ctx = { auth_player_name: A.name, version_name: profile.id, game_directory: d.gameDir, assets_root: path.join(root, "assets"), assets_index_name: main.assetIndex.id,
    auth_uuid: A.uuid, auth_access_token: A.token, clientid: A.clientId || "", auth_xuid: A.xuid || "", user_type: A.userType || "msa", version_type: vanilla.type || "release",
    natives_directory: nativesDir, launcher_name: "Auroras", launcher_version: d.launcherVersion || "0.1.0", classpath_separator: sep, library_directory: librariesDir,
    classpath: lp.classpath(profile, env, { librariesDir, clientJar: inst.safeJoin(root, clientRel), sep }) };
  // Join a server straight from the launcher with Minecraft's own quick play argument (1.20 and later versions list it).
  const features = {};
  if (I.server) { const a = require("./serverping.js").parseAddress(I.server); ctx.quick_play_multiplayer = a.host.includes(":") ? "[" + a.host + "]:" + a.port : a.host + ":" + a.port; features.is_quick_play_multiplayer = true; }
  const built = lp.buildArgs(profile, env, ctx, features);
  if (I.server && !built.game.includes("--quickPlayMultiplayer")) throw new Error("Minecraft " + I.mc + " can’t join a server from the launcher. Start the game and use Multiplayer instead.");
  return lp.command(javaPath, built, { memMb: I.memMb, extraJvm: splitJvmArgs(I.args) });
}

/**
 * Runs the game and reports its life cycle. Resolves with the exit code. A non-zero exit becomes an "error" state
 * with the last log lines, so a crash on start is explained instead of silently returning to Ready.
 */
/**
 * Just Minecraft's own game jar for one version, from Mojang (checked against Mojang's SHA-1), into the same place a
 * launch puts it. No sign-in needed: Totem Studio reads the vanilla totem texture from it before you've played.
 */
async function fetchClientJar(mc, d) {
  const mf = await cachedJson(d, MANIFEST, "versions/version_manifest_v2.json", "Mojang’s version list");
  const entry = (mf.value.versions || []).find((v) => v.id === mc); if (!entry) throw new Error(`Minecraft ${mc} isn’t in Mojang’s version list.`);
  const v = (await cachedJson(d, entry.url, `versions/${mc}/${mc}.json`, `the ${mc} version file`)).value;
  if (v.id !== mc || !v.downloads || !v.downloads.client) throw new Error("Mojang returned the wrong version file.");
  const c = v.downloads.client, rel = `versions/${mc}/${mc}.jar`;
  await inst.ensureFiles([{ path: rel, url: c.url, sha1: c.sha1, size: c.size }], { root: d.root, fetchBytes: d.fetchBytes, concurrency: 1, sleep: d.sleep, onProgress: d.onProgress || (() => {}) });
  return path.join(d.root, rel);
}
function supervise(child, { logFile, emit }) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.createWriteStream(logFile), tail = [];
  const take = (b) => { log.write(b); for (const line of String(b).split(/\r?\n/)) if (line.trim()) { tail.push(line); if (tail.length > 12) tail.shift(); } };
  child.stdout && child.stdout.on("data", take); child.stderr && child.stderr.on("data", take);
  emit("playing", 0, "");
  return new Promise((resolve) => {
    let settled = false; const end = (code, err) => { if (settled) return; settled = true; log.end();
      if (err) emit("error", 0, "Java couldn’t start: " + err.message);
      else if (code === 0) emit("ready", 0, "");
      else emit("error", 0, `Minecraft closed with exit code ${code}. Last log lines:\n` + tail.slice(-6).join("\n"));
      resolve(err ? -1 : code); };
    child.on("error", (e) => end(null, e)); child.on("exit", (c) => end(c == null ? -1 : c));
  });
}
module.exports = { MANIFEST, JAVA_INDEX, fabricProfileUrl, splitJvmArgs, parseJavaVersion, prepare, fetchClientJar, supervise };
