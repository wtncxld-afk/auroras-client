// Reads entries out of a .jar/.zip (stored or deflated) without extracting the rest. Used to show the vanilla totem
// from the player's own downloaded Minecraft jar (nothing from Minecraft is bundled with Auroras) and to read
// Modrinth modpacks (.mrpack). Sizes are capped and inflating stops at the cap, so a zip bomb can't fill memory.
const fs = require("fs"), zlib = require("zlib");
const MAX_ENTRIES = 65535;
/** Every entry in the central directory: [{ name, method, csize, usize, loff, dir }]. Zip64 archives are refused. */
function listFd(fd) {
  const size = fs.fstatSync(fd).size, tailLen = Math.min(size, 65557), tail = Buffer.alloc(tailLen);
  fs.readSync(fd, tail, 0, tailLen, size - tailLen);
  let e = -1; for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("Not a zip file");
  const count = tail.readUInt16LE(e + 10), cdSize = tail.readUInt32LE(e + 12), cdOff = tail.readUInt32LE(e + 16);
  if (count === 0xffff || cdOff === 0xffffffff || cdSize === 0xffffffff) throw new Error("This zip file is too large (zip64 isn’t supported)");
  if (cdOff + cdSize > size) throw new Error("Damaged zip file");
  const cd = Buffer.alloc(cdSize); fs.readSync(fd, cd, 0, cdSize, cdOff);
  const out = [];
  for (let p = 0, k = 0; k < count && k < MAX_ENTRIES; k++) {
    if (p + 46 > cd.length || cd.readUInt32LE(p) !== 0x02014b50) throw new Error("Damaged zip file");
    const method = cd.readUInt16LE(p + 10), csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24), nlen = cd.readUInt16LE(p + 28), xlen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32), loff = cd.readUInt32LE(p + 42);
    const name = cd.toString("utf8", p + 46, p + 46 + nlen); p += 46 + nlen + xlen + clen;
    out.push({ name, method, csize, usize, loff, dir: name.endsWith("/") });
  }
  return out;
}
function readFd(fd, ent, maxBytes) {
  if (ent.usize > maxBytes || ent.csize > maxBytes) throw new Error("Entry is too large");
  const lh = Buffer.alloc(30); fs.readSync(fd, lh, 0, 30, ent.loff); if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error("Damaged zip file");
  const data = Buffer.alloc(ent.csize); fs.readSync(fd, data, 0, ent.csize, ent.loff + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28));
  if (ent.method === 0) { if (data.length !== ent.usize) throw new Error("Damaged zip entry"); return data; }
  if (ent.method === 8) { const out = zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, maxBytes) }); if (out.length !== ent.usize) throw new Error("Damaged zip entry"); return out; }
  throw new Error("Unsupported compression in zip");
}
const withFd = (zipPath, fn) => { const fd = fs.openSync(zipPath, "r"); try { return fn(fd); } finally { fs.closeSync(fd); } };
function readEntry(zipPath, name, maxBytes = 4 * 1024 * 1024) {
  return withFd(zipPath, (fd) => { const ent = listFd(fd).find((x) => x.name === name); return ent ? readFd(fd, ent, maxBytes) : null; });
}
/** Names and sizes of every entry. */
function listEntries(zipPath) { return withFd(zipPath, listFd); }
/** Opens a zip once for several reads: { entries, read(entry, maxBytes), close() }. */
function open(zipPath) {
  const fd = fs.openSync(zipPath, "r");
  try { const entries = listFd(fd); return { entries, read: (ent, maxBytes = 4 * 1024 * 1024) => readFd(fd, ent, maxBytes), close: () => fs.closeSync(fd) }; }
  catch (e) { fs.closeSync(fd); throw e; }
}
module.exports = { readEntry, listEntries, open };
