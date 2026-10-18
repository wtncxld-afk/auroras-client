const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path");
const { readEntry } = require("../ziputil.js"), { zip } = require("./fixtures/zip.js");
const png = Buffer.from("89504e470d0a1a0a" + "00".repeat(300), "hex");
for (const deflate of [false, true]) test(`reads one entry from a ${deflate ? "deflated" : "stored"} jar`, () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "aur-zip-")), "client.jar");
  fs.writeFileSync(f, zip([["META-INF/MANIFEST.MF", Buffer.from("Manifest-Version: 1.0\n")], ["assets/minecraft/textures/item/totem_of_undying.png", png], ["x.class", Buffer.alloc(5000, 7)]], { deflate }));
  assert.deepStrictEqual(readEntry(f, "assets/minecraft/textures/item/totem_of_undying.png"), png);
  assert.strictEqual(readEntry(f, "assets/minecraft/textures/item/missing.png"), null);
  assert.throws(() => readEntry(f, "x.class", 100), /too large/);
});
test("non-zip files are refused", () => { const f = path.join(os.tmpdir(), "aur-notzip-" + process.pid); fs.writeFileSync(f, "hello"); assert.throws(() => readEntry(f, "a"), /Not a zip/); });
