// Minecraft's multiplayer server list (servers.dat): an uncompressed NBT file in the game folder. The launcher keeps the
// featured server first in that list, so it is the top entry under Multiplayer in game. Everything else in the list is
// left exactly as the player has it.
const fs = require("fs"), path = require("path");

/* NBT, as Java Edition writes it: big-endian, every value kept with its tag type so a read then write gives the same bytes. */
const T = { END: 0, BYTE: 1, SHORT: 2, INT: 3, LONG: 4, FLOAT: 5, DOUBLE: 6, BYTES: 7, STRING: 8, LIST: 9, COMPOUND: 10, INTS: 11, LONGS: 12 };
function read(buf) {
  let o = 0; const need = (n) => { if (o + n > buf.length) throw new Error("servers.dat is cut short"); };
  const str = () => { need(2); const n = buf.readUInt16BE(o); o += 2; need(n); const s = buf.toString("utf8", o, o + n); o += n; return s; };
  const val = (t, depth) => {
    if (depth > 64) throw new Error("servers.dat is nested too deeply");
    switch (t) {
      case T.BYTE: need(1); return buf.readInt8(o++);
      case T.SHORT: need(2); o += 2; return buf.readInt16BE(o - 2);
      case T.INT: need(4); o += 4; return buf.readInt32BE(o - 4);
      case T.LONG: need(8); o += 8; return buf.readBigInt64BE(o - 8);
      case T.FLOAT: need(4); o += 4; return buf.readFloatBE(o - 4);
      case T.DOUBLE: need(8); o += 8; return buf.readDoubleBE(o - 8);
      case T.BYTES: { need(4); const n = buf.readInt32BE(o); o += 4; need(n); const b = Buffer.from(buf.subarray(o, o + n)); o += n; return b; }
      case T.STRING: return str();
      case T.LIST: { need(5); const et = buf.readUInt8(o), n = buf.readInt32BE(o + 1); o += 5; const items = []; for (let i = 0; i < n; i++) items.push(val(et, depth + 1)); return { type: et, items }; }
      case T.COMPOUND: { const m = []; for (;;) { need(1); const ct = buf.readUInt8(o++); if (ct === T.END) return m; const k = str(); m.push([k, ct, val(ct, depth + 1)]); } }
      case T.INTS: case T.LONGS: { need(4); const n = buf.readInt32BE(o), w = t === T.INTS ? 4 : 8; o += 4; need(n * w); const a = []; for (let i = 0; i < n; i++) a.push(t === T.INTS ? buf.readInt32BE(o + i * 4) : buf.readBigInt64BE(o + i * 8)); o += n * w; return a; }
      default: throw new Error("servers.dat has an unknown tag " + t);
    }
  };
  need(1); const t = buf.readUInt8(o++); if (t !== T.COMPOUND) throw new Error("servers.dat doesn’t start with a compound");
  const name = str(); return { name, value: val(T.COMPOUND, 0) };
}
function write(root) {
  const parts = []; const b = (n, f) => { const x = Buffer.alloc(n); f(x); parts.push(x); };
  const str = (s) => { const x = Buffer.from(String(s), "utf8"); b(2, (y) => y.writeUInt16BE(x.length)); parts.push(x); };
  const val = (t, v) => {
    switch (t) {
      case T.BYTE: return b(1, (x) => x.writeInt8(v)); case T.SHORT: return b(2, (x) => x.writeInt16BE(v)); case T.INT: return b(4, (x) => x.writeInt32BE(v));
      case T.LONG: return b(8, (x) => x.writeBigInt64BE(BigInt(v))); case T.FLOAT: return b(4, (x) => x.writeFloatBE(v)); case T.DOUBLE: return b(8, (x) => x.writeDoubleBE(v));
      case T.BYTES: b(4, (x) => x.writeInt32BE(v.length)); return parts.push(Buffer.from(v));
      case T.STRING: return str(v);
      case T.LIST: b(5, (x) => { x.writeUInt8(v.items.length ? v.type : (v.type || T.END)); x.writeInt32BE(v.items.length, 1); }); return v.items.forEach((i) => val(v.type, i));
      case T.COMPOUND: for (const [k, ct, cv] of v) { b(1, (x) => x.writeUInt8(ct)); str(k); val(ct, cv); } return b(1, (x) => x.writeUInt8(T.END));
      case T.INTS: b(4, (x) => x.writeInt32BE(v.length)); return v.forEach((i) => b(4, (x) => x.writeInt32BE(i)));
      case T.LONGS: b(4, (x) => x.writeInt32BE(v.length)); return v.forEach((i) => b(8, (x) => x.writeBigInt64BE(BigInt(i))));
    }
  };
  b(1, (x) => x.writeUInt8(T.COMPOUND)); str(root.name || ""); val(T.COMPOUND, root.value); return Buffer.concat(parts);
}

const get = (c, k) => { const e = c.find((x) => x[0] === k); return e ? e[2] : undefined; };
/** Same server? Host names compare without case, and 25565 is the default port. */
const sameAddr = (a, b) => { const n = (s) => String(s || "").trim().toLowerCase().replace(/:25565$/, ""); return n(a) === n(b); };

/**
 * Puts { name, ip } first in the game's server list at gameDir/servers.dat. An entry for the same address moves to the
 * top (keeping its icon and resource pack choice) and takes the featured name; duplicates of it are removed. A file that
 * can't be read is left alone. Returns what happened.
 */
function pin(gameDir, { name, ip }) {
  const file = path.join(gameDir, "servers.dat"); let root = { name: "", value: [["servers", T.LIST, { type: T.COMPOUND, items: [] }]] };
  if (fs.existsSync(file)) { try { root = read(fs.readFileSync(file)); } catch (e) { return { ok: false, reason: e.message }; } }
  let list = get(root.value, "servers");
  if (!list || list.type !== T.COMPOUND && list.items.length) return { ok: false, reason: "servers.dat has no server list" };
  if (!list) { list = { type: T.COMPOUND, items: [] }; root.value.push(["servers", T.LIST, list]); }
  list.type = T.COMPOUND;
  const old = list.items.find((c) => sameAddr(get(c, "ip"), ip));
  if (list.items[0] === old && old && get(old, "name") === name && list.items.filter((c) => sameAddr(get(c, "ip"), ip)).length === 1) return { ok: true, changed: false };
  const entry = old ? old.filter(([k]) => k !== "name" && k !== "ip") : [];
  entry.unshift(["name", T.STRING, name], ["ip", T.STRING, ip]);
  list.items = [entry, ...list.items.filter((c) => !sameAddr(get(c, "ip"), ip))];
  fs.mkdirSync(gameDir, { recursive: true }); const tmp = file + ".tmp" + process.pid; fs.writeFileSync(tmp, write(root)); fs.renameSync(tmp, file);
  return { ok: true, changed: true };
}
/** The server list as [{ name, ip }], for tests and diagnostics. */
function servers(gameDir) { try { const r = read(fs.readFileSync(path.join(gameDir, "servers.dat"))); return (get(r.value, "servers") || { items: [] }).items.map((c) => ({ name: get(c, "name"), ip: get(c, "ip") })); } catch { return []; } }

module.exports = { read, write, pin, servers, T };
