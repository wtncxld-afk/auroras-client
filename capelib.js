// Cape library: capes the player uploads or makes in the Cape Studio, kept on this computer as PNG files plus an index.
// Nothing here is uploaded anywhere; the game only ever sees the one cape "Use in game" copies into an instance.
const fs = require("fs"), path = require("path");
const V = require("./visuals/visuals.js");
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ID = /^c\d{6,20}$/, SOURCES = ["upload", "made", "copy"], MAX_BYTES = 4 * 1024 * 1024, MAX_ITEMS = 500;

const indexFile = (dir) => path.join(dir, "index.json");
function readIndex(dir) { try { const j = JSON.parse(fs.readFileSync(indexFile(dir), "utf8")); return Array.isArray(j) ? j.filter((d) => d && ID.test(d.id)) : []; } catch { return []; } }
function writeIndex(dir, list) { fs.mkdirSync(dir, { recursive: true }); const tmp = indexFile(dir) + ".tmp" + process.pid; fs.writeFileSync(tmp, JSON.stringify(list, null, 2)); fs.renameSync(tmp, indexFile(dir)); }
const cleanName = (n) => { const s = String(n || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 32); if (!s) throw new Error("Give the cape a name (up to 32 characters)."); return s; };
const checkId = (id) => { if (!ID.test(String(id))) throw new Error("Unknown cape."); return String(id); };

/** A PNG the game can show: the right signature and one of the cape sizes (64x32 up to 512x256). */
function decodePng(png) {
  const b = Buffer.isBuffer(png) ? png : Buffer.from(String(png).replace(/^data:image\/png;base64,/, ""), "base64");
  if (b.length < 33 || !b.subarray(0, 8).equals(PNG_SIG) || b.toString("latin1", 12, 16) !== "IHDR") throw new Error("That isn’t a PNG image.");
  if (b.length > MAX_BYTES) throw new Error("Cape images must be under 4 MB.");
  if (V.capeScale(b.readUInt32BE(16), b.readUInt32BE(20)) === 0) throw new Error("Convert the cape to 64x32 first.");
  return b;
}

/** Every saved cape, oldest first, with its image as a data URL for the launcher to draw. Missing files are skipped. */
function list(dir) {
  return readIndex(dir).flatMap((d) => { try { return [{ id: d.id, name: d.name, source: d.source, added: d.added, img: "data:image/png;base64," + fs.readFileSync(path.join(dir, d.id + ".png")).toString("base64") }]; } catch { return []; } });
}
/** Adds a cape, or replaces the image and name of one with the same id. */
function save(dir, { id, name, png, source }) {
  id = checkId(id); name = cleanName(name); const b = decodePng(png); const all = readIndex(dir), old = all.find((d) => d.id === id);
  if (!old && all.length >= MAX_ITEMS) throw new Error(`Your library is full (${MAX_ITEMS} capes). Delete some first.`);
  fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, id + ".png"), tmp = f + ".tmp" + process.pid; fs.writeFileSync(tmp, b); fs.renameSync(tmp, f);
  if (old) Object.assign(old, { name }); else all.push({ id, name, source: SOURCES.includes(source) ? source : "made", added: new Date().toISOString() });
  writeIndex(dir, all); return { ok: true, id };
}
function rename(dir, { id, name }) { id = checkId(id); name = cleanName(name); const all = readIndex(dir), d = all.find((x) => x.id === id); if (!d) throw new Error("Unknown cape."); d.name = name; writeIndex(dir, all); return { ok: true }; }
function remove(dir, id) { id = checkId(id); writeIndex(dir, readIndex(dir).filter((d) => d.id !== id)); try { fs.unlinkSync(path.join(dir, id + ".png")); } catch {} return { ok: true }; }

module.exports = { list, save, rename, remove, decodePng, MAX_ITEMS };
