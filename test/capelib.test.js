const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path"), zlib = require("zlib");
const C = require("../capelib.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "aur-cape-"));
// A real PNG of w x h (one colour), so the size check reads a genuine header.
function png(w, h) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); l.writeUInt32BE(d.length); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const row = Buffer.alloc(1 + w * 4, 255); row[0] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk("IEND", Buffer.alloc(0))]);
}
const url = (b) => "data:image/png;base64," + b.toString("base64");

test("save, list, rename and delete capes; files live in the library folder", () => {
  const d = tmp(); C.save(d, { id: "c1700000000001", name: "Mine", png: url(png(64, 32)), source: "upload" }); C.save(d, { id: "c1700000000002", name: "HD", png: url(png(512, 256)), source: "made" });
  let l = C.list(d); assert.deepStrictEqual(l.map((x) => [x.name, x.source]), [["Mine", "upload"], ["HD", "made"]]); assert.match(l[0].img, /^data:image\/png;base64,/);
  C.rename(d, { id: "c1700000000001", name: "Renamed" }); C.remove(d, "c1700000000002"); l = C.list(d);
  assert.deepStrictEqual(l.map((x) => x.name), ["Renamed"]); assert.ok(!fs.existsSync(path.join(d, "c1700000000002.png")));
});
test("saving the same id replaces the picture and keeps one entry", () => {
  const d = tmp(); C.save(d, { id: "c1700000000003", name: "A", png: url(png(64, 32)) }); C.save(d, { id: "c1700000000003", name: "B", png: url(png(128, 64)) });
  const l = C.list(d); assert.strictEqual(l.length, 1); assert.strictEqual(l[0].name, "B"); assert.strictEqual(Buffer.from(l[0].img.split(",")[1], "base64").readUInt32BE(16), 128);
});
test("refuses sizes the game can't show, non-PNGs, bad names and ids that could leave the folder", () => {
  const d = tmp();
  assert.throws(() => C.save(d, { id: "c1700000000004", name: "x", png: url(png(64, 64)) }), /64x32/);
  assert.throws(() => C.save(d, { id: "c1700000000004", name: "x", png: "data:image/png;base64,aGVsbG8=" }), /isn’t a PNG/);
  assert.throws(() => C.save(d, { id: "c1700000000004", name: "  ", png: url(png(64, 32)) }), /name/);
  assert.throws(() => C.save(d, { id: "../evil", name: "x", png: url(png(64, 32)) }), /Unknown cape/);
  assert.throws(() => C.remove(d, "../../x"), /Unknown cape/); assert.deepStrictEqual(C.list(d), []);
});
