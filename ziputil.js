// Reads one file out of a .jar/.zip (stored or deflated) without extracting the rest. Used to show the vanilla totem
// from the player's own downloaded Minecraft jar; nothing from Minecraft is bundled with Auroras.
const fs = require("fs"), zlib = require("zlib");
function readEntry(zipPath, name, maxBytes = 4 * 1024 * 1024) {
  const fd = fs.openSync(zipPath, "r");
  try {
    const size = fs.fstatSync(fd).size, tailLen = Math.min(size, 65557), tail = Buffer.alloc(tailLen);
    fs.readSync(fd, tail, 0, tailLen, size - tailLen);
    let e = -1; for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("Not a zip file");
    const count = tail.readUInt16LE(e + 10), cdSize = tail.readUInt32LE(e + 12), cdOff = tail.readUInt32LE(e + 16);
    if (cdOff + cdSize > size) throw new Error("Damaged zip file");
    const cd = Buffer.alloc(cdSize); fs.readSync(fd, cd, 0, cdSize, cdOff);
    for (let p = 0, k = 0; k < count && p + 46 <= cd.length; k++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error("Damaged zip file");
      const method = cd.readUInt16LE(p + 10), csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24), nlen = cd.readUInt16LE(p + 28), xlen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32), loff = cd.readUInt32LE(p + 42);
      const ename = cd.toString("utf8", p + 46, p + 46 + nlen); p += 46 + nlen + xlen + clen;
      if (ename !== name) continue;
      if (usize > maxBytes || csize > maxBytes) throw new Error("Entry is too large");
      const lh = Buffer.alloc(30); fs.readSync(fd, lh, 0, 30, loff); if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error("Damaged zip file");
      const data = Buffer.alloc(csize); fs.readSync(fd, data, 0, csize, loff + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28));
      if (method === 0) return data; if (method === 8) { const out = zlib.inflateRawSync(data, { maxOutputLength: maxBytes }); if (out.length !== usize) throw new Error("Damaged zip entry"); return out; }
      throw new Error("Unsupported compression in zip");
    }
    return null;
  } finally { fs.closeSync(fd); }
}
module.exports = { readEntry };
