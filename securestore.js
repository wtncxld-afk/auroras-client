// How the launcher keeps private data on disk (sign-ins, API keys, settings). Pure logic: the OS encryption
// (Electron safeStorage: Windows DPAPI, macOS Keychain, Linux libsecret) is passed in, so tests run without Electron.
//
// Rules:
// - Secrets (refresh tokens, API keys) are only ever written encrypted by the OS. When the OS can't encrypt, the
//   secret is kept in memory for this session and never written in plain text.
// - Old plain-text secrets from earlier versions are read once and re-saved encrypted, or dropped if they can't be.
// - Private files are written atomically (temp file, then rename) and readable only by the current user (0600).
const fs = require("fs"), path = require("path"), crypto = require("crypto");

/** Write a file only the current user can read, without ever leaving a half-written file behind. */
function writePrivate(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + crypto.randomBytes(6).toString("hex") + ".tmp";
  try {
    fs.writeFileSync(tmp, data, { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch (e) { try { fs.unlinkSync(tmp); } catch {} throw e; }
  try { fs.chmodSync(file, 0o600); } catch {}
}
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; } };

/**
 * crypt = { available(), encrypt(string) -> Buffer, decrypt(Buffer) -> string }.
 * seal(text) -> { enc: true, data } or null when the OS can't encrypt. open(record) -> text or null.
 * A record { enc: false } is a plain-text secret from an older version: open() still reads it so it can be migrated.
 */
function createVault(crypt) {
  const can = () => { try { return !!crypt.available(); } catch { return false; } };
  return {
    available: can,
    seal(text) { if (!can()) return null; return { enc: true, data: crypt.encrypt(String(text)).toString("base64") }; },
    open(rec) {
      if (!rec || typeof rec.data !== "string") return null;
      try { return rec.enc ? crypt.decrypt(Buffer.from(rec.data, "base64")) : Buffer.from(rec.data, "base64").toString("utf8"); } catch { return null; }
    },
  };
}

/** Owner-only permissions for the launcher's data folder (no effect on Windows, where the profile folder is private). */
function lockDir(dir) { try { fs.mkdirSync(dir, { recursive: true }); if (process.platform !== "win32") fs.chmodSync(dir, 0o700); } catch {} }

module.exports = { writePrivate, readJson, createVault, lockDir };
