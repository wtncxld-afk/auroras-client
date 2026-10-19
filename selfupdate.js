// Launcher auto-update from this project's GitHub releases. Every push to main builds a release (release.yml) with the
// installer and SHA256SUMS.txt; the launcher downloads the newer installer in the background, checks its SHA-256 against
// that list, and asks to restart. Pure logic: the release lookup and downloads are passed in, so tests run offline.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const clientmod = require("./clientmod.js");

/** What the latest release offers over `current`: null when it isn't newer or has no installer with a checksum. */
function plan(rel, current) {
  if (!rel || !Array.isArray(rel.assets) || !clientmod.newer(rel.tag_name, current)) return null;
  const exe = rel.assets.find((a) => /^AurorasClientSetup-[\w.\-]+\.exe$/i.test(a.name) || /\.exe$/i.test(a.name)), sums = rel.assets.find((a) => a.name === "SHA256SUMS.txt");
  if (!exe || !sums) return null;
  return { version: String(rel.tag_name).replace(/^v/i, ""), exe: { name: path.basename(exe.name), url: exe.browser_download_url, size: exe.size | 0 }, sumsUrl: sums.browser_download_url, notes: String(rel.body || "").slice(0, 2000) };
}

/**
 * Downloads the planned installer into dir (once per version) and verifies it. getBytes(url) -> Buffer.
 * Returns { file, version }. A file that doesn't match the published checksum is deleted, never run.
 */
async function fetchInstaller(p, dir, getBytes) {
  const want = clientmod.parseSums((await getBytes(p.sumsUrl)).toString("utf8"))[p.exe.name];
  if (!want) throw new Error("The release has no checksum for " + p.exe.name + ", so it won't be installed.");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, p.exe.name);
  if (fs.existsSync(file) && sha(fs.readFileSync(file)) === want) return { file, version: p.version };
  for (const f of fs.readdirSync(dir)) if (f !== p.exe.name) try { fs.unlinkSync(path.join(dir, f)); } catch {}
  const bytes = await getBytes(p.exe.url);
  if (sha(bytes) !== want) throw new Error("The downloaded update didn't match its checksum, so it was thrown away.");
  const tmp = file + ".part"; fs.writeFileSync(tmp, bytes); fs.renameSync(tmp, file);
  return { file, version: p.version };
}
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

/** Arguments for electron-builder's NSIS installer: silent, then start the new launcher. */
const INSTALL_ARGS = ["/S", "--updated", "--force-run"];

module.exports = { plan, fetchInstaller, INSTALL_ARGS };
