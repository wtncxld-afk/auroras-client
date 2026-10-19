// Reads and writes an instance's Auroras settings (config/auroras inside the instance folder), the same files the mod loads.
// Every value is validated with the game's rules before anything is written, and writes are atomic.
const fs = require("fs"), path = require("path");
const V = require("./visuals/visuals.js");
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, "visuals", "registry.json"), "utf8"));
const rules = V.makeRules(registry);
const BUILT_IN = ["Default", "Minimal HUD", "Competitive", "Casual"];
const fileFor = (dir, name) => path.join(dir, "profile-" + name.replace(/ /g, "_") + ".txt");
function atomicWrite(file, text) { const tmp = file + ".tmp" + process.pid; fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); }

/** { active, profiles: {name: values}, places: {key: profile}, skipped } with defaults filled in. Never throws on a bad file; it is skipped. */
function read(dir) {
  const out = { active: "Default", profiles: {}, places: {}, skipped: 0, skippedLines: 0 };
  for (const n of BUILT_IN) out.profiles[n] = { ...rules.defaults(), ...(registry.builtIns[n] || {}) };
  let files = []; try { files = fs.readdirSync(dir).filter((f) => /^profile-.*\.txt$/.test(f)); } catch {}
  for (const f of files) { try { const p = V.importProfile(fs.readFileSync(path.join(dir, f), "utf8"), rules, { strict: false }); out.profiles[p.name] = { ...rules.defaults(), ...p.values }; out.skippedLines += p.skipped; } catch { out.skipped++; } }
  try { const a = fs.readFileSync(path.join(dir, "active.txt"), "utf8").trim(); if (out.profiles[a]) out.active = a; } catch {}
  try { for (const line of fs.readFileSync(path.join(dir, "places.txt"), "utf8").split(/\r?\n/)) { if (!line.trim()) continue; const eq = line.lastIndexOf("="), k = line.slice(0, eq), v = line.slice(eq + 1); if (eq > 0 && V.PLACE.test(k) && out.profiles[v]) out.places[k] = v; else out.skipped++; } } catch {}
  return out;
}
/** Applies changes to one profile: { profile, set: {key: value} }. Validates everything first; writes nothing if any value is bad. */
function update(dir, { profile, set = {}, activate = false }) {
  const cur = read(dir); if (!V.NAME.test(String(profile))) throw new Error("Bad profile name");
  for (const [k, v] of Object.entries(set)) { const e = rules.validate(k, String(v)); if (e) throw new Error(e); }
  const values = { ...(cur.profiles[profile] || rules.defaults()), ...Object.fromEntries(Object.entries(set).map(([k, v]) => [k, String(v)])) };
  fs.mkdirSync(dir, { recursive: true }); atomicWrite(fileFor(dir, profile), V.exportProfile(profile, values));
  if (activate) atomicWrite(path.join(dir, "active.txt"), profile);
  return read(dir);
}
function assignPlace(dir, place, profile) {
  const cur = read(dir); if (!V.PLACE.test(String(place))) throw new Error("Not a valid server or world"); if (profile !== null && !cur.profiles[profile]) throw new Error("No such profile");
  const places = { ...cur.places }; if (profile === null) delete places[place]; else places[place] = profile;
  fs.mkdirSync(dir, { recursive: true }); atomicWrite(path.join(dir, "places.txt"), Object.keys(places).sort().map((k) => k + "=" + places[k] + "\n").join(""));
  return read(dir);
}
// HUD layout presets: <config>/hud-layouts/<name>.txt, the same files the in-game HUD editor reads (HudKit.loadLayouts).
const layoutDir = (dir) => path.join(dir, "hud-layouts");
function listLayouts(dir) {
  const out = {}; let files = []; try { files = fs.readdirSync(layoutDir(dir)).filter((f) => f.endsWith(".txt")); } catch {}
  for (const f of files) { try { const t = fs.readFileSync(path.join(layoutDir(dir), f), "utf8"); out[t.split(/\r?\n/)[1].slice(5)] = V.importLayout(registry, rules, t); } catch {} }
  return out;
}
function saveLayout(dir, name, layout) {
  if (!V.NAME.test(String(name))) throw new Error("Layout names are 1-32 letters, numbers, spaces, dots, dashes or underscores");
  const text = V.exportLayout(name, layout); V.importLayout(registry, rules, text);
  fs.mkdirSync(layoutDir(dir), { recursive: true }); atomicWrite(path.join(layoutDir(dir), name.replace(/ /g, "_") + ".txt"), text); return listLayouts(dir);
}
function deleteLayout(dir, name) { if (!V.NAME.test(String(name))) throw new Error("Bad layout name"); try { fs.unlinkSync(path.join(layoutDir(dir), name.replace(/ /g, "_") + ".txt")); } catch {} return listLayouts(dir); }
// Emotes: custom emotes in <config>/emotes/<id>.json and the wheel in <config>/emotes/wheel.txt, the files the mod reads
// (Emotes.loadCustom / Emotes.parseWheel). Built-in emotes come from visuals/emotes.json, bundled with the mod too.
const EMOTE_LIB = V.parseEmoteLibrary(JSON.parse(fs.readFileSync(path.join(__dirname, "visuals", "emotes.json"), "utf8"))), BUILTIN_IDS = new Set(EMOTE_LIB.map((e) => e.id));
const emoteDir = (dir) => path.join(dir, "emotes");
/** { custom: [emote json], errors: ["file: reason"], wheel: [8 ids or null] }. Bad files are listed in errors, never half-loaded. */
function listEmotes(dir) {
  const custom = [], errors = []; let files = []; try { files = fs.readdirSync(emoteDir(dir)).filter((f) => f.endsWith(".json")).sort(); } catch {}
  for (const f of files) {
    try { const st = fs.statSync(path.join(emoteDir(dir), f)); if (st.size > 65536) throw new Error("too large"); const e = V.parseEmoteFile(fs.readFileSync(path.join(emoteDir(dir), f), "utf8"));
      if (BUILTIN_IDS.has(e.id)) throw new Error("uses the id of a built-in emote"); custom.push(V.emoteToJson({ ...e, category: "Custom" })); }
    catch (x) { errors.push(f + ": " + x.message); }
  }
  let wheel = new Array(8).fill(null); try { wheel = V.parseWheel(fs.readFileSync(path.join(emoteDir(dir), "wheel.txt"), "utf8"), new Set([...BUILTIN_IDS, ...custom.map((e) => e.id)])); } catch {}
  return { custom, errors, wheel };
}
function saveEmote(dir, json) {
  const e = V.parseEmote(json); if (BUILTIN_IDS.has(e.id)) throw new Error("“" + e.id + "” is a built-in emote. Pick another id.");
  fs.mkdirSync(emoteDir(dir), { recursive: true }); atomicWrite(path.join(emoteDir(dir), e.id + ".json"), V.emoteFileText({ ...e, category: "Custom" })); return listEmotes(dir);
}
function deleteEmote(dir, id) {
  if (!V.EMOTE_ID.test(String(id))) throw new Error("Bad emote id"); try { fs.unlinkSync(path.join(emoteDir(dir), id + ".json")); } catch {}
  const cur = listEmotes(dir); if (cur.wheel.includes(id)) return saveWheel(dir, cur.wheel.map((x) => (x === id ? null : x))); return cur;
}
function saveWheel(dir, slots) {
  if (!Array.isArray(slots) || slots.length !== 8) throw new Error("The wheel has 8 slots");
  const known = new Set([...BUILTIN_IDS, ...listEmotes(dir).custom.map((e) => e.id)]);
  for (const id of slots) if (id !== null && !known.has(id)) throw new Error("Unknown emote “" + id + "”");
  fs.mkdirSync(emoteDir(dir), { recursive: true }); atomicWrite(path.join(emoteDir(dir), "wheel.txt"), V.writeWheel(slots)); return listEmotes(dir);
}
/** In-game cape (shown only to this player): a PNG in Minecraft's cape layout, checked before writing. */
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function writeCape(dir, png) {
  const b = Buffer.isBuffer(png) ? png : Buffer.from(String(png).replace(/^data:image\/png;base64,/, ""), "base64");
  if (b.length < 33 || !b.subarray(0, 8).equals(PNG_SIG) || b.toString("latin1", 12, 16) !== "IHDR") throw new Error("That isn’t a PNG image.");
  if (b.length > 2 * 1024 * 1024) throw new Error("Cape images must be under 2 MB.");
  if (V.capeScale(b.readUInt32BE(16), b.readUInt32BE(20)) === 0) throw new Error("Save the cape as 64x32 first (the Cape Studio converts old 22x17 capes when you import them)."); // throws with the allowed sizes otherwise
  fs.mkdirSync(dir, { recursive: true }); const tmp = path.join(dir, "cape.png.tmp" + process.pid); fs.writeFileSync(tmp, b); fs.renameSync(tmp, path.join(dir, "cape.png"));
  return { ok: true, bytes: b.length };
}
function clearCape(dir) { try { fs.unlinkSync(path.join(dir, "cape.png")); } catch {} return { ok: true }; }
/** The player's face for the in-game menu: an 8x8 PNG (face plus hat layer), checked before writing. */
function writeFace(dir, png) {
  const b = Buffer.isBuffer(png) ? png : Buffer.from(String(png).replace(/^data:image\/png;base64,/, ""), "base64");
  if (b.length < 33 || b.length > 8192 || !b.subarray(0, 8).equals(PNG_SIG) || b.toString("latin1", 12, 16) !== "IHDR") throw new Error("That isn’t a small PNG image.");
  if (b.readUInt32BE(16) !== 8 || b.readUInt32BE(20) !== 8) throw new Error("The face image must be 8x8.");
  fs.mkdirSync(dir, { recursive: true }); const tmp = path.join(dir, "face.png.tmp" + process.pid); fs.writeFileSync(tmp, b); fs.renameSync(tmp, path.join(dir, "face.png"));
  return { ok: true };
}
/** The player's head for the in-game menu's 3D head: the top 64x16 of the skin (head and hat layer, every side). */
function writeHead(dir, png) {
  const b = Buffer.isBuffer(png) ? png : Buffer.from(String(png).replace(/^data:image\/png;base64,/, ""), "base64");
  if (b.length < 33 || b.length > 16384 || !b.subarray(0, 8).equals(PNG_SIG) || b.toString("latin1", 12, 16) !== "IHDR") throw new Error("That isn’t a small PNG image.");
  if (b.readUInt32BE(16) !== 64 || b.readUInt32BE(20) !== 16) throw new Error("The head image must be 64x16.");
  fs.mkdirSync(dir, { recursive: true }); const tmp = path.join(dir, "head.png.tmp" + process.pid); fs.writeFileSync(tmp, b); fs.renameSync(tmp, path.join(dir, "head.png"));
  return { ok: true };
}
module.exports = { writeFace, writeHead, writeCape, clearCape, registry, rules, read, update, assignPlace, listLayouts, saveLayout, deleteLayout, EMOTE_LIB, listEmotes, saveEmote, deleteEmote, saveWheel };
