// Verified file installation: every download is checked against its SHA-1 before it is written, writes are atomic,
// and paths can never escape the target folder. Network access is injected (fetchBytes), so this is testable offline.
const crypto = require("crypto"), fs = require("fs"), path = require("path");
const { urlAllowed } = require("./launchplan");

const sha1 = (buf) => crypto.createHash("sha1").update(buf).digest("hex");
function safeJoin(root, rel) {
  if (typeof rel !== "string" || !rel || rel.includes("\0") || /^[a-zA-Z]:|^[\\/]/.test(rel) || rel.split(/[\\/]/).some((seg) => seg === ".." || seg === "")) throw new Error("Unsafe path: " + rel);
  const base = path.resolve(root), p = path.resolve(base, ...rel.split(/[\\/]/));
  if (p !== base && !p.startsWith(base + path.sep)) throw new Error("Unsafe path: " + rel);
  return p;
}
async function fileMatches(p, item) {
  let st; try { st = await fs.promises.stat(p); } catch { return false; }
  if (!st.isFile() || (item.size && st.size !== item.size)) return false;
  if (item.verify === "size") return true;
  return sha1(await fs.promises.readFile(p)) === item.sha1.toLowerCase();
}

/**
 * items: [{ path (relative to root), url, sha1, size?, executable?, verify?: "sha1" | "size" }]
 * verify "size" (used for game assets, like Mojang's own launcher) only skips an existing file when its size matches;
 * anything downloaded is always SHA-1 checked.
 */
async function ensureFiles(items, { root, fetchBytes, concurrency = 8, onProgress = () => {}, retries = 3, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const total = items.reduce((a, i) => a + (i.size || 1), 0) || 1; let done = 0; const todo = [];
  for (const it of items) {
    if (!/^[0-9a-f]{40}$/i.test(String(it.sha1 || ""))) throw new Error("No valid checksum for " + it.path);
    if (!urlAllowed(it.url)) throw new Error("Download host not allowed: " + it.url);
    const p = safeJoin(root, it.path);
    if (await fileMatches(p, it)) done += it.size || 1; else todo.push([it, p]);
  }
  onProgress(done / total);
  let next = 0, failed = null;
  const worker = async () => {
    while (!failed && next < todo.length) {
      const [it, p] = todo[next++];
      try {
        // Up to `retries` tries per file with a growing pause, so a dropped connection or one bad response doesn't end the install.
        let buf, last;
        for (let a = 1; a <= retries && !failed; a++) {
          try { buf = await fetchBytes(it.url); if (it.size && buf.length !== it.size) throw new Error(`Wrong size for ${it.path} (got ${buf.length}, expected ${it.size})`); if (sha1(buf) !== it.sha1.toLowerCase()) throw new Error("Checksum mismatch for " + it.path); last = null; break; }
          catch (e) { last = e; buf = null; if (a < retries) await sleep(500 * a * a); }
        }
        if (last) throw new Error(`Couldn’t download ${it.path} from ${new URL(it.url).hostname} after ${retries} tries: ${last.message}`);
        if (!buf) return;
        await fs.promises.mkdir(path.dirname(p), { recursive: true });
        const tmp = p + ".part" + process.pid; await fs.promises.writeFile(tmp, buf); await fs.promises.rename(tmp, p);
        if (it.executable && process.platform !== "win32") await fs.promises.chmod(p, 0o755);
        done += it.size || 1; onProgress(done / total);
      } catch (e) { failed = failed || e; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, todo.length)) }, worker));
  if (failed) throw failed;
  onProgress(1);
  return { downloaded: todo.length, skipped: items.length - todo.length };
}

/** Mojang Java runtime file manifest -> files to download, folders, and links. */
function runtimeFiles(manifest) {
  const files = [], dirs = [], links = [];
  for (const [rel, f] of Object.entries(manifest.files || {})) {
    safeJoin("/x", rel);
    if (f.type === "directory") dirs.push(rel);
    else if (f.type === "link") { if (typeof f.target !== "string" || path.isAbsolute(f.target)) throw new Error("Unsafe link in Java runtime: " + rel); links.push({ path: rel, target: f.target }); }
    else if (f.type === "file") { const r = f.downloads && f.downloads.raw; if (!r) throw new Error("No download for " + rel); files.push({ path: rel, url: r.url, sha1: r.sha1, size: r.size, executable: !!f.executable }); }
  }
  return { files, dirs, links };
}
/** Where java lives inside a Mojang runtime for each OS. */
function javaExecutable(files, os) {
  const want = os === "windows" ? ["bin/javaw.exe", "bin/java.exe"] : os === "osx" ? ["jre.bundle/Contents/Home/bin/java", "bin/java"] : ["bin/java"];
  for (const w of want) if (files.some((f) => f.path === w)) return w;
  throw new Error("This Java runtime has no java executable for " + os);
}
/** Mojang's platform key for the Java runtime index. */
function runtimePlatform(os, arch) {
  if (os === "windows") return arch === "arm64" ? "windows-arm64" : arch === "x86" ? "windows-x86" : "windows-x64";
  if (os === "osx") return arch === "arm64" ? "mac-os-arm64" : "mac-os";
  return arch === "x86" ? "linux-i386" : "linux";
}
module.exports = { sha1, safeJoin, ensureFiles, runtimeFiles, javaExecutable, runtimePlatform };
