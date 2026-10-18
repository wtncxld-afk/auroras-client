// Update logic with no Electron dependency, so it can be unit-tested.
const crypto = require("crypto"), fs = require("fs"), path = require("path");

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(v).trim());
  if (!m) throw new Error("Invalid version: " + v);
  return { n: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : [] };
}
/** SemVer precedence: 1.0.0-preview.2 < 1.0.0. Returns -1, 0 or 1. */
function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
  if (!x.pre.length && !y.pre.length) return 0;
  if (!x.pre.length) return 1; if (!y.pre.length) return -1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1; if (q === undefined) return 1;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) { if (+p !== +q) return +p < +q ? -1 : 1; }
    else if (pn) return -1; else if (qn) return 1; else if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

/** Verifies a detached Ed25519 signature over the exact manifest bytes, then parses it. Throws if anything is off. */
function verifyManifest(manifestBytes, signatureB64, publicKeyPem) {
  const ok = crypto.verify(null, Buffer.from(manifestBytes), crypto.createPublicKey(publicKeyPem), Buffer.from(String(signatureB64).trim(), "base64"));
  if (!ok) throw new Error("Update manifest signature is invalid");
  const m = JSON.parse(Buffer.from(manifestBytes).toString("utf8"));
  if (m.schema !== 1) throw new Error("Unsupported manifest schema");
  return m;
}
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
function verifyBytes(buf, expectedSha256) {
  if (!/^[0-9a-f]{64}$/i.test(String(expectedSha256))) throw new Error("Manifest has no valid sha256");
  if (sha256(buf) !== expectedSha256.toLowerCase()) throw new Error("Downloaded file failed its integrity check");
  return true;
}
function httpsUrl(u) { const x = new URL(u); if (x.protocol !== "https:") throw new Error("Update URLs must be https"); return x.href; }

function selectLauncherUpdate(manifest, current, channel) {
  const order = channel === "preview" ? ["preview", "stable"] : ["stable"];
  let best = null;
  for (const ch of order) { const e = manifest.launcher && manifest.launcher[ch]; if (e && compareVersions(e.version, current) > 0 && (!best || compareVersions(e.version, best.version) > 0)) best = { ...e, channel: ch }; }
  if (best) httpsUrl(best.url);
  return best;
}
/** Newest client build for this exact Minecraft version and loader that is newer than the installed one. */
function selectClientBuild(manifest, { mc, loader, channel, installed }) {
  const ok = (manifest.client || []).filter((b) => b.mc === mc && b.loader === loader && (b.channel === "stable" || channel === "preview"));
  ok.sort((a, b) => compareVersions(b.version, a.version));
  const newest = ok[0];
  if (!newest) return { status: "unsupported", reason: `No Auroras Client build for Minecraft ${mc} with ${loader}` };
  if (installed && compareVersions(newest.version, installed) <= 0) return { status: "up-to-date", version: installed };
  httpsUrl(newest.url);
  return { status: "available", build: newest };
}

/**
 * Installs a verified download over targetPath. The old file is backed up first and restored if anything fails.
 * Resolves {ok:true} only after the installed file has been re-read and re-verified.
 */
function applyFile({ targetPath, newBytes, expectedSha256, backupDir, fsImpl = fs }) {
  verifyBytes(newBytes, expectedSha256);
  const tmp = targetPath + ".new", backup = path.join(backupDir, path.basename(targetPath) + ".bak");
  const had = fsImpl.existsSync(targetPath);
  try {
    fsImpl.mkdirSync(backupDir, { recursive: true });
    if (had) fsImpl.copyFileSync(targetPath, backup);
    fsImpl.writeFileSync(tmp, newBytes);
    verifyBytes(fsImpl.readFileSync(tmp), expectedSha256);
    fsImpl.renameSync(tmp, targetPath);
    verifyBytes(fsImpl.readFileSync(targetPath), expectedSha256);
    return { ok: true, backup: had ? backup : null };
  } catch (e) {
    try { if (fsImpl.existsSync(tmp)) fsImpl.unlinkSync(tmp); } catch {}
    try { if (had && fsImpl.existsSync(backup)) fsImpl.copyFileSync(backup, targetPath); } catch {}
    return { ok: false, error: e.message, restored: had };
  }
}
module.exports = { httpsUrl, compareVersions, verifyManifest, verifyBytes, sha256, selectLauncherUpdate, selectClientBuild, applyFile };
