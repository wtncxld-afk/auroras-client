// Turns official version JSON (plus a loader profile) into downloads, a classpath and a launch command. Pure and testable.
const path = require("path");

function ruleMatches(r, env, features) {
  if (r.os) {
    if (r.os.name && r.os.name !== env.os) return false;
    if (r.os.arch && r.os.arch !== env.arch) return false;
    if (r.os.version && !new RegExp(r.os.version).test(env.osVersion || "")) return false;
  }
  if (r.features) for (const k of Object.keys(r.features)) if (!!features[k] !== r.features[k]) return false;
  return true;
}
/** Mojang semantics: no rules means allowed; otherwise the last matching rule decides, default deny. */
function allowed(rules, env, features = {}) { if (!rules || !rules.length) return true; let ok = false; for (const r of rules) if (ruleMatches(r, env, features)) ok = r.action === "allow"; return ok; }

const libKey = (name) => { const [g, a, , c] = name.split(":"); return [g, a, c].filter(Boolean).join(":"); };
function mavenPath(name) { const [g, a, v, c] = name.split(":"); return `${g.replace(/\./g, "/")}/${a}/${v}/${a}-${v}${c ? "-" + c : ""}.jar`; }

/** Resolve inheritsFrom: loader profile (child) on top of the vanilla JSON (parent). Child libraries replace parent ones with the same group:artifact. */
function mergeProfiles(parent, child) {
  const libs = new Map(); for (const l of parent.libraries || []) libs.set(libKey(l.name), l); for (const l of child.libraries || []) libs.set(libKey(l.name), l);
  const a = (p, c) => ({ game: [...((p && p.game) || []), ...((c && c.game) || [])], jvm: [...((p && p.jvm) || []), ...((c && c.jvm) || [])] });
  return { ...parent, ...child, id: child.id || parent.id, mainClass: child.mainClass || parent.mainClass, libraries: [...libs.values()], arguments: a(parent.arguments, child.arguments),
    assetIndex: child.assetIndex || parent.assetIndex, assets: child.assets || parent.assets, downloads: child.downloads || parent.downloads, javaVersion: child.javaVersion || parent.javaVersion, inheritsFrom: undefined };
}

const HOSTS = new Set(["piston-data.mojang.com", "piston-meta.mojang.com", "libraries.minecraft.net", "resources.download.minecraft.net", "launchermeta.mojang.com", "maven.fabricmc.net", "meta.fabricmc.net", "maven.neoforged.net", "maven.minecraftforge.net", "repo1.maven.org"]);
function urlAllowed(u) { try { const x = new URL(u); return x.protocol === "https:" && HOSTS.has(x.hostname); } catch { return false; } }

/** Libraries allowed on this machine, each with a relative path under libraries/ and a download URL. Throws on a URL that is not on the allowlist. */
function libraryDownloads(v, env, features = {}) {
  const out = [];
  for (const l of v.libraries || []) {
    if (!allowed(l.rules, env, features)) continue;
    const art = l.downloads && l.downloads.artifact;
    const rel = art ? art.path : mavenPath(l.name), url = art ? art.url : (l.url || "https://libraries.minecraft.net/").replace(/\/?$/, "/") + rel;
    if (!urlAllowed(url)) throw new Error(`Library ${l.name} uses a download host that isn’t allowed: ${url}`);
    out.push({ name: l.name, path: rel, url, sha1: (art && art.sha1) || l.sha1 || null, size: (art && art.size) || l.size || null });
  }
  return out;
}
/** Modern (1.19+) natives are ordinary libraries with a natives-* classifier and go on the classpath like any other jar. */
function classpath(v, env, { librariesDir, clientJar, sep }) {
  const seen = new Set(), parts = [];
  for (const l of libraryDownloads(v, env)) { if (seen.has(l.path)) continue; seen.add(l.path); parts.push(path.join(librariesDir, ...l.path.split("/"))); }
  parts.push(clientJar); return parts.join(sep);
}
function expand(list, env, features, ctx, missing) {
  const out = [];
  for (const a of list || []) {
    let vals; if (typeof a === "string") vals = [a]; else { if (!allowed(a.rules, env, features)) continue; vals = Array.isArray(a.value) ? a.value : [a.value]; }
    for (const s of vals) out.push(String(s).replace(/\$\{([^}]+)\}/g, (_m, k) => { if (k in ctx) return ctx[k]; missing.add(k); return ""; }));
  }
  return out;
}
/** Builds {jvm, mainClass, game}. Refuses to produce a command with unresolved placeholders. */
function buildArgs(v, env, ctx, features = {}) {
  const missing = new Set(), jvm = expand(v.arguments && v.arguments.jvm, env, features, ctx, missing), game = expand(v.arguments && v.arguments.game, env, features, ctx, missing);
  if (missing.size) throw new Error("Launch arguments reference unknown values: " + [...missing].join(", "));
  if (!v.mainClass) throw new Error("Version has no main class");
  return { jvm, mainClass: v.mainClass, game };
}
/** Final argv for spawning Java (no shell involved). memMb and extraJvm come from the instance settings. */
function command(javaPath, built, { memMb, extraJvm = [] }) {
  if (!Number.isInteger(memMb) || memMb < 512 || memMb > 65536) throw new Error("Memory must be between 512 MB and 64 GB");
  return { file: javaPath, args: [`-Xmx${memMb}M`, `-Xms${Math.min(512, memMb)}M`, ...built.jvm, ...extraJvm, built.mainClass, ...built.game] };
}
function assetObjects(index) {
  return Object.entries(index.objects || {}).map(([name, o]) => { if (!/^[0-9a-f]{40}$/.test(o.hash)) throw new Error("Bad asset hash for " + name); const p = o.hash.slice(0, 2); return { name, hash: o.hash, size: o.size, path: `objects/${p}/${o.hash}`, url: `https://resources.download.minecraft.net/${p}/${o.hash}` }; });
}
function mainDownloads(v) {
  const c = v.downloads && v.downloads.client, ai = v.assetIndex; if (!c || !ai) throw new Error("Version JSON has no client download or asset index");
  for (const u of [c.url, ai.url]) if (!urlAllowed(u)) throw new Error("Download host not allowed: " + u);
  return { client: { url: c.url, sha1: c.sha1, size: c.size }, assetIndex: { id: ai.id, url: ai.url, sha1: ai.sha1, size: ai.size } };
}
module.exports = { allowed, mavenPath, mergeProfiles, urlAllowed, libraryDownloads, classpath, buildArgs, command, assetObjects, mainDownloads };
