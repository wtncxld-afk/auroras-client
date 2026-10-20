const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path");
const { execFileSync } = require("child_process");
const M = require("../modconfig.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "aur-cfg-"));
const CORE = path.join(__dirname, "..", "client-mod", "core");
function javaCore() {
  try { execFileSync(process.platform === "win32" ? "where" : "which", ["java"]); } catch { return null; }
  if (!fs.existsSync(path.join(CORE, "out", "gg", "auroras", "core", "LoadCheck.class"))) { try { execFileSync("java", ["Build.java"], { cwd: CORE, stdio: "pipe" }); } catch { return null; } }
  return (dir, keys, place, layouts) => JSON.parse(execFileSync("java", ["-cp", path.join(CORE, "out"), "gg.auroras.core.LoadCheck", dir, keys.join(","), place || "-", ...(layouts ? ["layouts"] : [])], { stdio: ["ignore", "pipe", "ignore"] }).toString());
}
const J = javaCore();

test("empty folder reads as the built-in profiles with defaults", () => {
  const r = M.read(path.join(tmp(), "missing")); assert.strictEqual(r.active, "Default"); assert.deepStrictEqual(Object.keys(r.profiles), ["Default", "Minimal HUD", "Competitive", "Casual"]);
  assert.strictEqual(r.profiles.Default["sky.theme"], "aurora");
  assert.deepStrictEqual(["fps", "cps", "keystrokes", "coords"].map((m) => r.profiles.Competitive[m + ".enabled"]), ["true", "true", "true", "false"], "built-in profiles match the game's");
});
test("updates validate first and write nothing when any value is bad", () => {
  const d = tmp();
  assert.throws(() => M.update(d, { profile: "Default", set: { "sky.theme": "cosmic", "sky.brightness": "9" } }), /out of range/);
  assert.deepStrictEqual(fs.readdirSync(d), []);
  assert.throws(() => M.update(d, { profile: "../evil", set: {} }), /Bad profile name/);
  const r = M.update(d, { profile: "Default", set: { "sky.theme": "cosmic", "sky.enabled": "true", "settings.quality": "HIGH" } });
  assert.strictEqual(r.profiles.Default["sky.theme"], "cosmic"); assert.ok(!fs.readdirSync(d).some((f) => f.includes(".tmp")));
});
test("a new profile can be created, activated and assigned to a server; bad places are refused", () => {
  const d = tmp(); M.update(d, { profile: "PvP", set: { "sky.theme": "void" }, activate: true });
  const r = M.assignPlace(d, "server:play.example.net", "PvP"); assert.strictEqual(r.active, "PvP"); assert.strictEqual(r.places["server:play.example.net"], "PvP");
  assert.throws(() => M.assignPlace(d, "server:../x", "PvP"), /valid server/); assert.throws(() => M.assignPlace(d, "server:a.b", "Nope"), /No such profile/);
  assert.deepStrictEqual(M.assignPlace(d, "server:play.example.net", null).places, {});
});
test("corrupt files are skipped, not applied", () => {
  const d = tmp(); fs.writeFileSync(path.join(d, "profile-Bad.txt"), "auroras-profile=1\nname=Bad\nsky.brightness=99\n"); fs.writeFileSync(path.join(d, "places.txt"), "junk\nserver:x.y=Ghost\n");
  fs.writeFileSync(path.join(d, "profile-Junk.txt"), "not a profile\n");
  const r = M.read(d); assert.ok(r.profiles.Bad, "the bad line is dropped, the profile kept"); assert.strictEqual(r.profiles.Bad["sky.brightness"], "1.0");
  assert.strictEqual(r.skippedLines, 1); assert.ok(!r.profiles.Junk); assert.strictEqual(r.skipped, 3, "junk profile file + two bad places lines");
});
test("HUD layout presets: save, list, delete; invalid ones refused", () => {
  const d = tmp(), lay = { "fps.offX": "120", "fps.anchor": "TR", "clock.enabled": "true" };
  assert.deepStrictEqual(Object.keys(M.saveLayout(d, "Arena 2", lay)), ["Arena 2"]); assert.deepStrictEqual(M.listLayouts(d)["Arena 2"], lay);
  assert.throws(() => M.saveLayout(d, "../x", lay), /Layout names/); assert.throws(() => M.saveLayout(d, "Bad", { "sky.theme": "void" }), /not a HUD layout/);
  assert.deepStrictEqual(M.deleteLayout(d, "Arena 2"), {});
});
test("the game's loader reads HUD layouts the launcher saved", { skip: J ? false : "java not available" }, () => {
  const d = tmp(); M.saveLayout(d, "Arena 2", { "fps.offX": "120", "fps.anchor": "TR" }); fs.writeFileSync(path.join(d, "hud-layouts", "junk.txt"), "x");
  const r = J(d, ["fps.enabled"], null, true); assert.deepStrictEqual(r.layouts, { "Arena 2": { "fps.anchor": "TR", "fps.offX": "120" } });
});
test("the game's own loader reads exactly what the launcher wrote", { skip: J ? false : "java not available" }, () => {
  const d = tmp();
  M.update(d, { profile: "Default", set: { "sky.enabled": "true", "sky.theme": "sakura", "sky.starDensity": "2.5", "settings.quality": "LOW" } });
  M.update(d, { profile: "Arena", set: { "sky.theme": "void", "fps.enabled": "true" }, activate: true });
  M.assignPlace(d, "server:play.example.net", "Default");
  const keys = ["sky.enabled", "sky.theme", "sky.starDensity", "settings.quality", "fps.enabled"];
  const plain = J(d, keys), there = J(d, keys, "server:play.example.net");
  assert.deepStrictEqual(plain, { active: "Arena", current: "Arena", skipped: 0, values: { "sky.enabled": "false", "sky.theme": "void", "sky.starDensity": "1.0", "settings.quality": "BALANCED", "fps.enabled": "true" } });
  const comp = J(tmp(), ["fps.enabled", "cps.enabled", "coords.enabled"]); assert.deepStrictEqual(comp.values, { "fps.enabled": "false", "cps.enabled": "false", "coords.enabled": "false" });
  assert.deepStrictEqual(there.values, { "sky.enabled": "true", "sky.theme": "sakura", "sky.starDensity": "2.5", "settings.quality": "LOW", "fps.enabled": "false" }); assert.strictEqual(there.current, "Default");
});

test("emotes: custom emotes and the wheel are saved where the mod reads them, validated", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "aur-em-"));
  const mine = { id: "my_wave", name: "My wave", category: "Custom", duration: 1, loop: false, keys: { rightArm: [{ t: 0 }, { t: 0.5, p: -150, e: "easeOut" }, { t: 1 }] } };
  let r = M.saveEmote(d, mine); assert.deepStrictEqual(r.custom.map((e) => e.id), ["my_wave"]); assert.ok(fs.existsSync(path.join(d, "emotes", "my_wave.json")));
  assert.match(fs.readFileSync(path.join(d, "emotes", "my_wave.json"), "utf8"), /"schema": 1/);
  assert.throws(() => M.saveEmote(d, { ...mine, id: "wave" }), /built-in/); assert.throws(() => M.saveEmote(d, { ...mine, keys: { tail: [{ t: 0 }] } }), /tail/);
  r = M.saveWheel(d, ["wave", "my_wave", null, null, null, null, null, "sit"]); assert.deepStrictEqual(r.wheel.slice(0, 2), ["wave", "my_wave"]);
  assert.strictEqual(fs.readFileSync(path.join(d, "emotes", "wheel.txt"), "utf8"), "auroras-wheel=1\nslot1=wave\nslot2=my_wave\nslot8=sit\n");
  assert.throws(() => M.saveWheel(d, ["ghost", null, null, null, null, null, null, null]), /Unknown emote/); assert.throws(() => M.saveWheel(d, ["wave"]), /8 slots/);
  fs.writeFileSync(path.join(d, "emotes", "broken.json"), "{nope"); r = M.listEmotes(d); assert.strictEqual(r.custom.length, 1); assert.match(r.errors[0], /^broken\.json/);
  r = M.deleteEmote(d, "my_wave"); assert.deepStrictEqual(r.custom, []); assert.strictEqual(r.wheel[1], null, "deleting an emote frees its wheel slot");
  assert.throws(() => M.deleteEmote(d, "../x"), /Bad emote id/);
});

test("emotes: the game's own loader reads what the launcher wrote", { skip: !J && "Java not available" }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "aur-emj-"));
  M.saveEmote(d, { id: "spin_arms", name: "Spin arms", category: "Dance", duration: 2, loop: true, keys: { rightArm: [{ t: 0, r: 10 }, { t: 1, r: 170, e: "sine" }, { t: 2, r: 10, e: "sine" }], root: [{ t: 0 }, { t: 1, oy: -2 }] } });
  M.saveWheel(d, [null, "spin_arms", "wave", null, null, null, null, null]); fs.writeFileSync(path.join(d, "emotes", "zz_bad.json"), '{"schema":1,"emote":{"id":"x"}}');
  try { execFileSync("java", ["Build.java"], { cwd: CORE, stdio: "pipe" }); } catch {}
  const out = JSON.parse(execFileSync("java", ["-cp", path.join(CORE, "out"), "gg.auroras.core.EmoteCheck", d, path.join(__dirname, "..", "visuals")], { encoding: "utf8" }).trim().split("\n").pop());
  assert.deepStrictEqual(out, { custom: [{ id: "spin_arms", duration: 2, keys: 5 }], errors: 1, wheel: [null, "spin_arms", "wave", null, null, null, null, null] });
});

test("cape for the game: only real PNGs in Minecraft's cape layout are written, atomically, and can be removed", () => {
  const d = tmp(), png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write("IHDR", 12, "latin1"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  assert.deepStrictEqual(M.writeCape(d, "data:image/png;base64," + png(64, 32).toString("base64")), { ok: true, bytes: 33 });
  assert.strictEqual(fs.readFileSync(path.join(d, "cape.png")).readUInt32BE(16), 64);
  M.writeCape(d, png(128, 64)); assert.strictEqual(fs.readFileSync(path.join(d, "cape.png")).readUInt32BE(16), 128);
  assert.throws(() => M.writeCape(d, png(64, 64)), /Cape images must be 64x32/);
  assert.throws(() => M.writeCape(d, png(22, 17)), /64x32 first/);
  assert.throws(() => M.writeCape(d, Buffer.from("GIF89a not a png at all, padded out to length")), /isn’t a PNG/);
  assert.strictEqual(fs.readFileSync(path.join(d, "cape.png")).readUInt32BE(16), 128, "a refused file leaves the previous cape in place");
  assert.ok(!fs.readdirSync(d).some((f) => f.includes(".tmp")));
  M.clearCape(d); assert.ok(!fs.existsSync(path.join(d, "cape.png"))); M.clearCape(d);
});

test("face for the in-game menu: only an 8x8 PNG is written", () => {
  const d = tmp(), png = (w, h) => { const b = Buffer.alloc(40); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write("IHDR", 12, "latin1"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  assert.deepStrictEqual(M.writeFace(d, "data:image/png;base64," + png(8, 8).toString("base64")), { ok: true }); assert.strictEqual(fs.readFileSync(path.join(d, "face.png")).length, 40);
  assert.deepStrictEqual(M.writeHead(d, png(64, 16)), { ok: true }); assert.ok(fs.existsSync(path.join(d, "head.png"))); assert.throws(() => M.writeHead(d, png(8, 8)), /64x16/);
  assert.throws(() => M.writeFace(d, png(64, 64)), /8x8/); assert.throws(() => M.writeFace(d, Buffer.alloc(9000)), /small PNG/); assert.throws(() => M.writeFace(d, "not base64 png"), /small PNG/);
});

test("skin for the game (Skin Changer): only 64x64 or 64x32 PNGs are written, atomically, and can be removed", () => {
  const d = tmp(), png = (w, h) => { const b = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); b.writeUInt32BE(13, 8); b.write("IHDR", 12, "latin1"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
  assert.deepStrictEqual(M.writeSkin(d, "data:image/png;base64," + png(64, 64).toString("base64")), { ok: true, bytes: 33 });
  M.writeSkin(d, png(64, 32)); assert.strictEqual(fs.readFileSync(path.join(d, "skin.png")).readUInt32BE(20), 32);
  assert.throws(() => M.writeSkin(d, png(128, 128)), /64×64/);
  assert.throws(() => M.writeSkin(d, Buffer.from("GIF89a not a png at all, padded out to length")), /isn’t a PNG/);
  assert.strictEqual(fs.readFileSync(path.join(d, "skin.png")).readUInt32BE(20), 32, "a refused file leaves the previous skin in place");
  assert.ok(!fs.readdirSync(d).some((f) => f.includes(".tmp")));
  M.clearSkin(d); assert.ok(!fs.existsSync(path.join(d, "skin.png"))); M.clearSkin(d);
});

test("text settings (Name Protect alias) follow the same rule in the launcher and the game", () => {
  for (const [v, ok] of [["You", true], ["", true], ["Aurora_Fan 7", true], ["a=b", false], ["seventeen chars!!", false], ["naïve", false], ["x\ny", false]])
    assert.strictEqual(M.rules.validate("nameprotect.alias", v) === null, ok, JSON.stringify(v));
  assert.strictEqual(M.registry.modules.find((m) => m.id === "nameprotect").settings.find((s) => s.key === "alias").type, "TEXT");
});
