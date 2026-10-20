// Modrinth modpacks (.mrpack): reading, checking and installing them into an instance folder.
// Format: Modrinth's "Modrinth Modpack Format (.mrpack)" support article.
// A pack is a zip with modrinth.index.json (what to download, with hashes) plus overrides/ and client-overrides/
// folders copied into the instance. Everything here is strict: only the download hosts the format allows, every file
// checked against its SHA-512 (and SHA-1), no path may leave the instance folder, and sizes are capped.
// No Electron here: network access is injected (fetch), so the whole flow is tested offline.
const crypto = require("crypto"), fs = require("fs"), path = require("path");
const ziputil = require("./ziputil");
const { safeJoin } = require("./installer");

/** The only hosts a modpack may download from (the ones the .mrpack format allows). */
const HOSTS = new Set(["cdn.modrinth.com", "github.com", "raw.githubusercontent.com", "gitlab.com"]);
const LOADERS = { "fabric-loader": "Fabric", "quilt-loader": "Quilt", forge: "Forge", neoforge: "NeoForge" };
const MiB = 1024 * 1024;
const LIMITS = { packBytes: 2048 * MiB, indexBytes: 16 * MiB, files: 5000, fileBytes: 1024 * MiB, totalBytes: 8192 * MiB, overrides: 20000, overrideBytes: 512 * MiB, overrideTotal: 4096 * MiB };
/** Files the launcher itself keeps in an instance folder; a pack can't replace them. */
const RESERVED = new Set(["instance.json", "mods.json", "modpack.json"]);
const WIN_DEVICE = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

const fail = (m) => { throw new Error(m); };
/**
 * A path inside the instance, written with forward slashes. Refuses anything absolute, with "..", ".", empty parts,
 * backslashes, colons (drive letters, Windows streams), Windows device names, parts ending in a dot or space (Windows
 * drops those, so two names could collide), and the launcher's own files. Returns the normalised path.
 */
function checkPath(rel) {
  if (typeof rel !== "string" || !rel || rel.length > 400) fail("Unsafe path in modpack: " + String(rel).slice(0, 80));
  const bad = () => fail("Unsafe path in modpack: " + rel.slice(0, 120));
  if (/[\0\\:]/.test(rel) || rel.startsWith("/") || /[\x00-\x1f]/.test(rel)) bad();
  const segs = rel.split("/");
  for (const s of segs) if (!s || s === "." || s === ".." || /[. ]$/.test(s) || WIN_DEVICE.test(s) || /[<>"|?*]/.test(s)) bad();
  if (segs.length === 1 && RESERVED.has(segs[0].toLowerCase())) bad();
  safeJoin("/instance", rel); // and the resolved path must stay inside
  return rel;
}
const HEX = { sha1: /^[0-9a-f]{40}$/, sha512: /^[0-9a-f]{128}$/ };
function allowedUrl(u) { try { const x = new URL(u); return x.protocol === "https:" && HOSTS.has(x.hostname) && !x.username && !x.password && !x.port; } catch { return false; } }

/**
 * modrinth.index.json (Buffer, string or object) -> a checked pack.
 * Files whose env.client is "unsupported" are server-only and skipped; "optional" ones are kept unless
 * { optional: false }. Throws a plain-language Error for anything malformed or unsafe.
 */
function parseIndex(raw, { optional = true } = {}) {
  let j = raw;
  if (Buffer.isBuffer(raw) || typeof raw === "string") { const s = String(raw).replace(/^﻿/, ""); if (s.length > LIMITS.indexBytes) fail("The modpack index is too large."); try { j = JSON.parse(s); } catch { fail("The modpack index (modrinth.index.json) isn’t valid JSON."); } }
  if (!j || typeof j !== "object" || Array.isArray(j)) fail("The modpack index is empty or damaged.");
  if (j.formatVersion !== 1) fail(`This modpack uses format version ${JSON.stringify(j.formatVersion)}; Auroras reads version 1.`);
  if (j.game !== "minecraft") fail("This modpack isn’t for Minecraft.");
  const str = (v, max) => typeof v === "string" ? v.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, max) : "";
  const name = str(j.name, 64) || "Modpack", versionId = str(j.versionId, 64), summary = str(j.summary, 300);
  const deps = j.dependencies;
  if (!deps || typeof deps !== "object" || Array.isArray(deps)) fail("The modpack doesn’t say which Minecraft version it needs.");
  const mc = deps.minecraft;
  if (typeof mc !== "string" || !/^[\w.\-]{1,32}$/.test(mc)) fail("The modpack doesn’t say which Minecraft version it needs.");
  let loader = "Vanilla", loaderVersion = null;
  for (const [k, v] of Object.entries(deps)) {
    if (k === "minecraft") continue;
    if (!LOADERS[k]) fail(`The modpack needs “${String(k).slice(0, 40)}”, which Auroras doesn’t know.`);
    if (loader !== "Vanilla") fail("The modpack lists more than one mod loader.");
    if (typeof v !== "string" || !/^[\w.+\-]{1,64}$/.test(v)) fail(`The modpack’s ${LOADERS[k]} version isn’t valid.`);
    loader = LOADERS[k]; loaderVersion = v;
  }
  if (!Array.isArray(j.files)) fail("The modpack index has no file list.");
  if (j.files.length > LIMITS.files) fail(`The modpack lists ${j.files.length} files; the limit is ${LIMITS.files}.`);
  const files = [], skipped = [], seen = new Set(); let totalBytes = 0;
  for (const f of j.files) {
    if (!f || typeof f !== "object") fail("The modpack index has a damaged file entry.");
    const p = checkPath(f.path), key = p.toLowerCase();
    if (seen.has(key)) fail("The modpack lists " + p + " twice."); seen.add(key);
    const env = f.env && typeof f.env === "object" ? f.env : {}, client = env.client || "required";
    if (!["required", "optional", "unsupported"].includes(client)) fail(`Unknown env value for ${p}: ${String(client).slice(0, 20)}`);
    if (client === "unsupported") { skipped.push({ path: p, reason: "server only" }); continue; }
    if (client === "optional" && !optional) { skipped.push({ path: p, reason: "optional" }); continue; }
    const h = f.hashes && typeof f.hashes === "object" ? f.hashes : {}, sha1 = String(h.sha1 || "").toLowerCase(), sha512 = String(h.sha512 || "").toLowerCase();
    if (!HEX.sha512.test(sha512) && !HEX.sha1.test(sha1)) fail("No valid checksum for " + p + " in the modpack.");
    if (!Number.isSafeInteger(f.fileSize) || f.fileSize < 0) fail("No valid size for " + p + " in the modpack.");
    if (f.fileSize > LIMITS.fileBytes) fail(`${p} is larger than ${LIMITS.fileBytes / MiB} MB.`);
    const urls = Array.isArray(f.downloads) ? f.downloads.filter((u) => typeof u === "string") : [];
    const ok = urls.filter(allowedUrl);
    if (!ok.length) { const host = (() => { try { return new URL(urls[0]).hostname; } catch { return "no download address"; } })(); fail(`${p} would download from ${host}, which modpacks aren’t allowed to use. Allowed: ${[...HOSTS].join(", ")}.`); }
    totalBytes += f.fileSize;
    files.push({ path: p, urls: ok, sha1: HEX.sha1.test(sha1) ? sha1 : null, sha512: HEX.sha512.test(sha512) ? sha512 : null, size: f.fileSize, optional: client === "optional" });
  }
  if (totalBytes > LIMITS.totalBytes) fail(`The modpack downloads ${Math.round(totalBytes / MiB)} MB; the limit is ${LIMITS.totalBytes / MiB} MB.`);
  return { name, versionId, summary, mc, loader, loaderVersion, files, skipped, totalBytes };
}

/**
 * Zip entries -> the override files to copy: [{ path, entry, from }]. client-overrides/ wins over overrides/ for the
 * same path; server-overrides/ is ignored (this is a client). Refuses unsafe paths and too much data.
 */
function planOverrides(entries) {
  const out = new Map(); let total = 0, count = 0;
  for (const from of ["overrides", "client-overrides"]) for (const e of entries) {
    if (e.dir || !e.name.startsWith(from + "/")) continue;
    const rel = checkPath(e.name.slice(from.length + 1));
    if (e.usize > LIMITS.overrideBytes) fail(`${rel} in the modpack is larger than ${LIMITS.overrideBytes / MiB} MB.`);
    const prev = out.get(rel.toLowerCase()); if (prev) total -= prev.entry.usize; else count++;
    total += e.usize; out.set(rel.toLowerCase(), { path: rel, entry: e, from });
  }
  if (count > LIMITS.overrides) fail(`The modpack has ${count} override files; the limit is ${LIMITS.overrides}.`);
  if (total > LIMITS.overrideTotal) fail(`The modpack’s overrides unpack to ${Math.round(total / MiB)} MB; the limit is ${LIMITS.overrideTotal / MiB} MB.`);
  // Anything outside overrides/ must be a known part of the format, or a stray entry we just ignore; but an entry whose
  // name tries to climb out is a sign of a hostile file, so the whole pack is refused.
  for (const e of entries) if (/(^|[\\/])\.\.([\\/]|$)/.test(e.name) || /^([a-zA-Z]:|[\\/])/.test(e.name)) fail("Unsafe path in modpack: " + e.name.slice(0, 120));
  return [...out.values()];
}

/** Reads and checks a .mrpack file: { pack, overrides, summary }. */
function readPack(file, opts = {}) {
  const st = fs.statSync(file); if (!st.isFile()) fail("That isn’t a file."); if (st.size > LIMITS.packBytes) fail("The modpack file is larger than 2 GB.");
  let z; try { z = ziputil.open(file); } catch (e) { fail(/Not a zip/.test(e.message) ? "That file isn’t a Modrinth modpack (.mrpack is a zip file)." : "The modpack file is damaged: " + e.message); }
  try {
    const idx = z.entries.find((e) => e.name === "modrinth.index.json");
    if (!idx) fail("That file isn’t a Modrinth modpack: modrinth.index.json is missing.");
    const pack = parseIndex(z.read(idx, LIMITS.indexBytes), opts), overrides = planOverrides(z.entries);
    return { pack, overrides, summary: summarize(pack, overrides) };
  } finally { z.close(); }
}
const isModJar = (p) => /^mods\/[^/]+\.jar$/i.test(p);
/** What the import screen shows. */
function summarize(pack, overrides) {
  const warnings = [];
  if (pack.loader !== "Vanilla" && pack.loader !== "Fabric") warnings.push(`${pack.loader} instances can be imported but not launched by Auroras yet. Fabric and Vanilla can.`);
  if (!/^\d+\.\d+(\.\d+)?$/.test(pack.mc)) warnings.push(`Minecraft ${pack.mc} is a development build.`);
  return { name: pack.name, versionId: pack.versionId, summary: pack.summary, mc: pack.mc, loader: pack.loader, loaderVersion: pack.loaderVersion,
    files: pack.files.length, mods: pack.files.filter((f) => isModJar(f.path)).length, optional: pack.files.filter((f) => f.optional).length,
    serverOnly: pack.skipped.filter((s) => s.reason === "server only").length, overrides: overrides.length, downloadBytes: pack.totalBytes,
    overrideBytes: overrides.reduce((a, o) => a + o.entry.usize, 0), warnings };
}

const hashOf = (algo, buf) => crypto.createHash(algo).update(buf).digest("hex");
/** True when buf is exactly the file the pack describes (size, SHA-512 and SHA-1 where given). */
function verify(buf, f) {
  if (buf.length !== f.size) return false;
  if (f.sha512 && hashOf("sha512", buf) !== f.sha512) return false;
  if (f.sha1 && hashOf("sha1", buf) !== f.sha1) return false;
  return !!(f.sha512 || f.sha1);
}
async function fileMatches(p, f) {
  let st; try { st = await fs.promises.stat(p); } catch { return false; }
  if (!st.isFile() || st.size !== f.size) return false;
  return verify(await fs.promises.readFile(p), f);
}
/** Downloads one file, streaming into a temporary file while hashing; stops as soon as it's bigger than it should be. */
async function fetchOne(url, f, dest, fetch) {
  const tmp = dest + ".part" + process.pid + "-" + crypto.randomBytes(3).toString("hex");
  const s512 = crypto.createHash("sha512"), s1 = crypto.createHash("sha1"); let got = 0;
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const fh = await fs.promises.open(tmp, "w");
  try {
    const body = await fetch(url, { maxBytes: f.size });
    for await (const chunk of (Buffer.isBuffer(body) ? [body] : body)) {
      const b = Buffer.from(chunk); got += b.length;
      if (got > f.size) throw new Error(`${f.path} is bigger than the modpack says`);
      s512.update(b); s1.update(b); await fh.write(b);
    }
  } catch (e) { await fh.close().catch(() => {}); await fs.promises.rm(tmp, { force: true }); throw e; }
  await fh.close();
  const bad = got !== f.size ? `Wrong size for ${f.path} (got ${got}, expected ${f.size})` : (f.sha512 && s512.digest("hex") !== f.sha512) || (f.sha1 && s1.digest("hex") !== f.sha1) ? "Checksum mismatch for " + f.path : null;
  if (bad) { await fs.promises.rm(tmp, { force: true }); throw new Error(bad); }
  await fs.promises.rename(tmp, dest);
}
/**
 * Downloads every file of a pack into root. fetch(url, { maxBytes }) returns a Buffer or an async iterable of chunks.
 * Files already present with the right hash are kept. Each file gets `retries` tries per mirror.
 */
async function downloadFiles(files, { root, fetch, concurrency = 4, retries = 3, onProgress = () => {}, cancelled = () => false, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const total = files.reduce((a, f) => a + Math.max(1, f.size), 0) || 1; let done = 0, next = 0, failed = null; const todo = [];
  for (const f of files) { const dest = safeJoin(root, checkPath(f.path)); if (await fileMatches(dest, f)) done += Math.max(1, f.size); else todo.push([f, dest]); }
  onProgress(done / total, null);
  const worker = async () => {
    while (!failed && next < todo.length) {
      const [f, dest] = todo[next++];
      try {
        let last = null, ok = false;
        for (const url of f.urls) {
          if (!allowedUrl(url)) { last = new Error("Download host not allowed: " + url); continue; }
          for (let a = 1; a <= retries && !ok; a++) {
            if (cancelled()) throw new Error("Import cancelled");
            try { await fetchOne(url, f, dest, fetch); ok = true; } catch (e) { last = e; if (/cancelled/.test(e.message)) throw e; if (a < retries) await sleep(400 * a * a); }
          }
          if (ok) break;
        }
        if (!ok) throw new Error(`Couldn’t download ${f.path}: ${last ? last.message : "no download address"}`);
        done += Math.max(1, f.size); onProgress(done / total, f.path);
      } catch (e) { failed = failed || e; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, todo.length)) }, worker));
  if (failed) throw failed;
  onProgress(1, null);
  return { downloaded: todo.length, kept: files.length - todo.length };
}
/** Copies the planned override files out of the pack into root (client-overrides already won in planOverrides). */
function extractOverrides(file, overrides, root) {
  const z = ziputil.open(file);
  try {
    for (const o of overrides) {
      const dest = safeJoin(root, checkPath(o.path)), buf = z.read(o.entry, LIMITS.overrideBytes);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const tmp = dest + ".part" + process.pid; fs.writeFileSync(tmp, buf); fs.renameSync(tmp, dest);
    }
  } finally { z.close(); }
  return overrides.length;
}
/**
 * The mods the instance's mods.json should list, so the Mods page shows them as installed. lookup maps a SHA-512 to
 * Modrinth's { project_id, version_number } (from api.modrinth.com/v2/version_files); mods it doesn't know are kept
 * under a "pack:" key with their file name.
 */
function modManifest(pack, overrides, lookup = {}) {
  const man = {};
  for (const f of pack.files) {
    if (!isModJar(f.path)) continue;
    const filename = f.path.slice(5), v = f.sha512 && lookup[f.sha512];
    const pid = v && typeof v.project_id === "string" && /^[\w-]{1,64}$/.test(v.project_id) ? v.project_id : null;
    man[pid ? "m:" + pid : "pack:" + filename] = { filename, version: v && typeof v.version_number === "string" ? v.version_number.slice(0, 64) : "from modpack", modpack: pack.name };
  }
  for (const o of overrides) if (isModJar(o.path)) { const filename = o.path.slice(5); if (!Object.values(man).some((m) => m.filename === filename)) man["pack:" + filename] = { filename, version: "from modpack", modpack: pack.name }; }
  return man;
}
module.exports = { HOSTS, LOADERS, LIMITS, checkPath, allowedUrl, parseIndex, planOverrides, readPack, summarize, verify, downloadFiles, extractOverrides, modManifest };
