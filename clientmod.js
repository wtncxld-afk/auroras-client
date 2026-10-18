// Ready-made downloads from this launcher's own GitHub releases, so nobody has to build anything:
//  - the Auroras mod jar for a Fabric instance (installed into mods/ before launch, kept up to date, removed when the
//    instance moves to a Minecraft version it doesn't support, because Fabric refuses to start with it there);
//  - whether a newer launcher installer exists.
// Every jar is checked against the release's SHA256SUMS.txt before it is written. Pure logic with injected network
// calls, so it is tested without Electron or the internet (test/clientmod.test.js).
const crypto = require("crypto"), fs = require("fs"), path = require("path");

const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const JAR = "auroras-client.jar", STATE = "auroras-mod.json";
/**
 * Release asset name of the mod for one Minecraft version. The release workflow names jars after their build target:
 * an exact version (auroras-client-fabric-1.21.11.jar) or, for year-numbered releases, a whole line that covers its
 * hotfixes (auroras-client-fabric-26.3.jar serves 26.3, 26.3.1, ...). candidates() lists what to look for, best first.
 */
const assetFor = (mc) => `auroras-client-fabric-${mc}.jar`;
function candidates(mc) { const out = [assetFor(mc)], m = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(String(mc)); if (m && +m[1] >= 26) out.push(assetFor(m[1] + "." + m[2])); return [...new Set(out)]; }
const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
/** "<hex>  <name>" lines (sha256sum's format) to { name: hex }. */
function parseSums(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) { const m = /^([0-9a-f]{64})\s+\*?(.+?)\s*$/i.exec(line); if (m) out[m[2]] = m[1].toLowerCase(); }
  return out;
}
/** "v0.1.12" or "0.1.12" -> [0,1,12]; anything else -> null. */
const parseVer = (v) => { const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim()); return m ? [+m[1], +m[2], +m[3]] : null; };
function newer(a, b) { const x = parseVer(a), y = parseVer(b); if (!x || !y) return false; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; }

/** Latest release through GitHub's API, remembered for ttl ms in memory (GitHub allows 60 anonymous calls an hour). */
function releaseSource(repo, getJson, { now = Date.now, ttl = 10 * 60 * 1000 } = {}) {
  if (!REPO.test(String(repo || ""))) return null;
  let cache = null;
  return async (force) => {
    if (!force && cache && now() - cache.at < ttl) return cache.rel;
    const rel = await getJson(`https://api.github.com/repos/${repo}/releases/latest`);
    if (!rel || !Array.isArray(rel.assets)) throw new Error("GitHub returned an unexpected reply");
    cache = { at: now(), rel }; return rel;
  };
}

const readState = (mods) => { try { return JSON.parse(fs.readFileSync(path.join(mods, STATE), "utf8")); } catch { return null; } };
function atomic(file, bytes) { const tmp = file + ".part"; fs.writeFileSync(tmp, bytes); fs.renameSync(tmp, file); }
function remove(mods) { for (const f of [JAR, STATE]) try { fs.unlinkSync(path.join(mods, f)); } catch {} }

/**
 * Makes sure a Fabric instance has the right Auroras mod. Never throws for network problems: launching still works
 * without the mod, and the result says why. status:
 *   installed | updated | current | removed (instance version not supported) | unavailable (no build for this version)
 *   | offline (couldn't reach GitHub; an installed copy is kept) | not-configured (this copy has no release repo).
 */
async function ensureMod({ gameDir, mc, loader, latest, getBytes, emit = () => {} }) {
  const mods = path.join(gameDir, "mods"), state = readState(mods), jarPath = path.join(mods, JAR), have = fs.existsSync(jarPath);
  if (loader !== "Fabric") {
    if (state && have) { remove(mods); return { status: "removed", reason: "The Auroras mod needs Fabric." }; }
    return { status: "unavailable", reason: "The Auroras mod needs Fabric." };
  }
  if (!latest) return { status: "not-configured" };
  let rel; try { rel = await latest(); } catch (e) { return { status: "offline", kept: have, reason: e.message }; }
  const want = candidates(mc), asset = want.map((n) => rel.assets.find((a) => a.name === n)).find(Boolean), sumsAsset = rel.assets.find((a) => a.name === "SHA256SUMS.txt");
  if (!asset) {
    // A copy we installed for another version would stop Fabric from starting, so it goes.
    if (state && have) { remove(mods); return { status: "removed", reason: `No Auroras mod for Minecraft ${mc} yet.` }; }
    return { status: "unavailable", reason: `No Auroras mod for Minecraft ${mc} yet.` };
  }
  if (!sumsAsset) return { status: have ? "current" : "unavailable", reason: "The release has no checksum file, so nothing was downloaded." };
  if (state && have && state.version === rel.tag_name && state.asset === asset.name && state.sha256 === sha256(fs.readFileSync(jarPath))) return { status: "current", version: rel.tag_name };
  try {
    emit("Downloading the Auroras mod " + rel.tag_name);
    const sums = parseSums((await getBytes(sumsAsset.browser_download_url)).toString("utf8")), want = sums[asset.name];
    if (!want) return { status: have ? "current" : "unavailable", reason: "The checksum file doesn't list " + asset.name + "." };
    const bytes = await getBytes(asset.browser_download_url);
    if (sha256(bytes) !== want) throw new Error("The downloaded Auroras mod didn't match its checksum, so it wasn't installed.");
    fs.mkdirSync(mods, { recursive: true }); atomic(jarPath, bytes);
    atomic(path.join(mods, STATE), JSON.stringify({ version: rel.tag_name, asset: asset.name, sha256: want, mc }));
    return { status: have ? "updated" : "installed", version: rel.tag_name };
  } catch (e) { return { status: "offline", kept: have, reason: e.message }; }
}

/** Is there a newer launcher? { newer, latest, url, installer } from the same release. */
async function launcherUpdate(latest, current) {
  if (!latest) return { configured: false };
  const rel = await latest(true), inst = rel.assets.find((a) => /\.exe$/i.test(a.name));
  return { configured: true, current, latest: rel.tag_name, newer: newer(rel.tag_name, current), url: rel.html_url, installer: inst ? inst.name : null };
}
module.exports = { REPO, JAR, STATE, assetFor, candidates, sha256, parseSums, parseVer, newer, releaseSource, ensureMod, launcherUpdate };
