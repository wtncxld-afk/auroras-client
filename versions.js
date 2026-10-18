// Minecraft version metadata logic. Pure functions: network access lives in main.js, so this is testable with fixtures.
const MC = /^(\d{1,3})\.(\d{1,3})(?:\.(\d{1,3}))?$/;
/** Release ids only (1.21.4, and Mojang's year-based 26.1). Snapshots and pre-releases return null. */
const parseMc = (id) => { const m = MC.exec(String(id)); return m ? [+m[1], +m[2], +(m[3] || 0)] : null; };
function compareMc(a, b) { const x = parseMc(a), y = parseMc(b); if (!x || !y) throw new Error("Not a release version"); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; }
const atLeast121 = (id) => { const p = parseMc(id); return !!p && compareMc(id, "1.21") >= 0; };
const PRE = /^(\d{1,3}\.\d{1,3}(?:\.\d{1,3})?)-pre-?(\d+)$/, RC = /^(\d{1,3}\.\d{1,3}(?:\.\d{1,3})?)-rc-?(\d+)$/, WEEK = /^\d\dw\d\d[a-z]$/, YSNAP = /^(\d{1,3}\.\d{1,3}(?:\.\d{1,3})?)-snapshot-(\d+)$/;
/**
 * What kind of version an entry is. Mojang's manifest only says "release" or "snapshot", so pre-releases and release
 * candidates are recognised from the id. Snapshot-typed ids that match no known pattern (April Fools builds and the like)
 * are "experimental". base = the release a pre-release, RC or year-style snapshot leads to; null when the id doesn't say.
 */
function classify(v) {
  const id = String(v.id), out = (kind, base) => ({ kind, base, stable: kind === "release" });
  // Only Mojang's own "release" type is stable. A number-only id is NOT enough: the type decides.
  if (v.type === "release") return out(parseMc(id) ? "release" : "experimental", parseMc(id) ? id : null);
  if (v.type !== "snapshot") return out("old", null);
  let m;
  if ((m = PRE.exec(id))) return out("prerelease", m[1]);
  if ((m = RC.exec(id))) return out("rc", m[1]);
  if ((m = YSNAP.exec(id))) return out("snapshot", m[1]);
  if (WEEK.test(id)) return out("snapshot", null);
  if (parseMc(id)) return out("snapshot", id); // a snapshot-typed build with a release-looking id stays a snapshot
  return out("experimental", null);
}
/** Release line of a release id: "1.21.4" -> "1.21", "26.1.2" -> "26.1". */
const lineOf = (id) => { const p = parseMc(id); return p ? p[0] + "." + p[1] : null; };
const KINDS = ["release", "prerelease", "rc", "snapshot", "experimental"];

/**
 * Official manifest (version_manifest_v2.json) to a newest-first list of every version from 1.21 on. Included:
 * releases from 1.21 on; pre-releases, RCs and year-style snapshots whose target release is 1.21 or later; week-style
 * snapshots and other development builds published after 1.21 came out. Only releases unless { snapshots: true }.
 * kinds limits the result further (for the selector's filter chips).
 */
const FILTERS = ["latest", "releases", "dev"];
function listVersions(manifest, { snapshots = false, kinds = null, filter = null } = {}) {
  if (filter === "dev") { snapshots = true; kinds = kinds || ["prerelease", "rc", "snapshot", "experimental"]; } else if (filter === "releases" || filter === "latest") { snapshots = false; }
  const floorEntry = manifest.versions.find((v) => v.id === "1.21"), floor = floorEntry ? Date.parse(floorEntry.releaseTime) : Date.parse("2024-06-13T00:00:00Z");
  const out = [], seen = new Set();
  for (const v of manifest.versions) {
    if (seen.has(v.id)) continue; seen.add(v.id);
    const c = classify(v), t = Date.parse(v.releaseTime);
    if (c.kind === "old" || (c.kind !== "release" && !snapshots)) continue;
    const inRange = c.kind === "release" ? atLeast121(v.id) : c.base && parseMc(c.base) ? atLeast121(c.base) : t >= floor;
    if (!inRange || (kinds && !kinds.includes(c.kind))) continue;
    out.push({ id: v.id, kind: c.kind, stable: c.stable, base: c.base, line: c.stable ? lineOf(v.id) : null, releaseTime: v.releaseTime, url: v.url });
  }
  out.sort((a, b) => Date.parse(b.releaseTime) - Date.parse(a.releaseTime));
  const latest = (manifest.latest || {}), newestInLine = new Map();
  for (const v of out) if (v.stable && (!newestInLine.has(v.line) || compareMc(v.id, newestInLine.get(v.line)) > 0)) newestInLine.set(v.line, v.id);
  for (const v of out) { v.latestInLine = v.stable && newestInLine.get(v.line) === v.id; v.latest = v.id === latest.release || v.id === latest.snapshot; }
  // Latest releases: the newest patch of every release line (1.21.x, 26.1.x, ...), newest line first.
  return filter === "latest" ? out.filter((v) => v.latestInLine) : out;
}
function javaFor(versionJson) { const j = versionJson && versionJson.javaVersion; return j && Number.isInteger(j.majorVersion) ? { major: j.majorVersion, component: j.component || null } : null; }

const newestStable = (list) => { const s = list.filter((x) => x.stable !== false); return (s[0] || list[0] || {}).version || null; };
/** Fabric Meta: games = /v2/versions/game, loaders = /v2/versions/loader (newest first). */
function fabricFor(mc, games, loaders) { return games.some((g) => g.version === mc) ? { available: true, loaderVersion: newestStable(loaders) } : { available: false }; }
/** NeoForge numbers 1.X.Y as X.Y.build (1.21 is 21.0.x). Other schemes are not mapped, so they report unavailable instead of guessing. */
function neoforgeFor(mc, versions) {
  const p = parseMc(mc); if (!p || p[0] !== 1) return { available: false, reason: "NeoForge version scheme for this release isn’t mapped yet" };
  const prefix = `${p[1]}.${p[2]}.`, list = versions.filter((v) => v.startsWith(prefix));
  if (!list.length) return { available: false };
  const stable = list.filter((v) => !/-/.test(v)), pick = (stable.length ? stable : list).sort((a, b) => cmpBuild(b, a))[0];
  return { available: true, loaderVersion: pick, beta: !stable.length };
}
const cmpBuild = (a, b) => { const x = a.split(/[.-]/), y = b.split(/[.-]/); for (let i = 0; i < Math.max(x.length, y.length); i++) { const p = +x[i], q = +y[i]; if (p !== q && !(isNaN(p) && isNaN(q))) return (isNaN(q) || p > q) ? 1 : -1; } return 0; };
/** Forge promotions_slim.json: { promos: { "1.21.1-latest": "52.0.40" } } */
function forgeFor(mc, promos) { const v = promos && promos.promos && (promos.promos[mc + "-recommended"] || promos.promos[mc + "-latest"]); return v ? { available: true, loaderVersion: v } : { available: false }; }

/** "validated" only if the matrix (validated.json) says a real test pass happened. Everything else that exists is "untested". */
function compat(mc, loader, loaderInfo, validated) {
  if (loader === "Vanilla") return "vanilla";
  if (!loaderInfo || !loaderInfo.available) return "unavailable";
  return (validated.validated || []).some((e) => e.mc === mc && e.loader === loader.toLowerCase()) ? "validated" : "untested";
}
function loadersFor(mc, data, validated) {
  const f = fabricFor(mc, data.fabricGames || [], data.fabricLoaders || []), n = neoforgeFor(mc, data.neoforge || []), g = forgeFor(mc, data.forge);
  return { Vanilla: { available: true, compat: "vanilla" }, Fabric: { ...f, compat: compat(mc, "Fabric", f, validated) }, NeoForge: { ...n, compat: compat(mc, "NeoForge", n, validated) }, Forge: { ...g, compat: compat(mc, "Forge", g, validated) } };
}
module.exports = { parseMc, compareMc, atLeast121, classify, lineOf, KINDS, FILTERS, listVersions, javaFor, fabricFor, neoforgeFor, forgeFor, compat, loadersFor };
