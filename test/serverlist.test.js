const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path");
const L = require("../serverlist.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "aur-srv-"));
const V = { name: "VexVanilla", ip: "vexvanilla.net" };
// A servers.dat written byte by byte the way Minecraft lays it out, independent of serverlist.write.
function vanillaFile(entries) {
  const p = []; const u8 = (n) => p.push(Buffer.from([n])), i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32BE(n); p.push(b); };
  const s = (x) => { const b = Buffer.from(x, "utf8"), l = Buffer.alloc(2); l.writeUInt16BE(b.length); p.push(l, b); };
  u8(10); s(""); u8(9); s("servers"); u8(10); i32(entries.length);
  for (const e of entries) { u8(8); s("name"); s(e.name); u8(8); s("ip"); s(e.ip); if (e.icon) { u8(8); s("icon"); s(e.icon); } if (e.accept != null) { u8(1); s("acceptTextures"); u8(e.accept); } u8(0); }
  u8(0); return Buffer.concat(p);
}

test("a new game folder gets a server list with VexVanilla in it", () => {
  const d = tmp(); assert.deepStrictEqual(L.pin(d, V), { ok: true, changed: true }); assert.deepStrictEqual(L.servers(d), [V]);
});
test("VexVanilla goes first; the player's other servers stay, in order, with their icons and settings", () => {
  const d = tmp(); fs.writeFileSync(path.join(d, "servers.dat"), vanillaFile([{ name: "Hypixel", ip: "mc.hypixel.net", icon: "iVBORw0KGgo=", accept: 1 }, { name: "Friends", ip: "10.0.0.5:25570" }]));
  L.pin(d, V); assert.deepStrictEqual(L.servers(d), [V, { name: "Hypixel", ip: "mc.hypixel.net" }, { name: "Friends", ip: "10.0.0.5:25570" }]);
  const r = L.read(fs.readFileSync(path.join(d, "servers.dat"))), hyp = r.value[0][2].items[1];
  assert.deepStrictEqual(hyp.map(([k]) => k), ["name", "ip", "icon", "acceptTextures"]); assert.strictEqual(hyp[2][2], "iVBORw0KGgo="); assert.strictEqual(hyp[3][2], 1);
});
test("an existing VexVanilla entry moves to the top, keeps its icon, and duplicates of the address go", () => {
  const d = tmp(); fs.writeFileSync(path.join(d, "servers.dat"), vanillaFile([{ name: "Other", ip: "a.example" }, { name: "my vex", ip: "VexVanilla.net:25565", icon: "ICON" }, { name: "dup", ip: "vexvanilla.net" }]));
  L.pin(d, V); assert.deepStrictEqual(L.servers(d), [V, { name: "Other", ip: "a.example" }]);
  const top = L.read(fs.readFileSync(path.join(d, "servers.dat"))).value[0][2].items[0]; assert.ok(top.some(([k, , v]) => k === "icon" && v === "ICON"));
});
test("already first: the file isn't rewritten", () => {
  const d = tmp(); L.pin(d, V); const f = path.join(d, "servers.dat"), before = fs.readFileSync(f); assert.deepStrictEqual(L.pin(d, V), { ok: true, changed: false }); assert.ok(fs.readFileSync(f).equals(before));
});
test("read then write gives back the same bytes", () => {
  const b = vanillaFile([{ name: "A", ip: "a", icon: "x", accept: 0 }, { name: "Ünïcode ✓", ip: "b:1" }]); assert.ok(L.write(L.read(b)).equals(b));
});
test("a damaged servers.dat is left alone", () => {
  const d = tmp(), f = path.join(d, "servers.dat"); fs.writeFileSync(f, Buffer.from([10, 0, 0, 9, 0, 7])); const r = L.pin(d, V);
  assert.strictEqual(r.ok, false); assert.deepStrictEqual([...fs.readFileSync(f)], [10, 0, 0, 9, 0, 7]);
});
