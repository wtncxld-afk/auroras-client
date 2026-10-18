// The launcher's visuals.js must match the game's Java core. visuals/sky-golden.json is written by the Java side (Golden.java).
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const V = require("../visuals/visuals.js");
const dir = path.join(__dirname, "..", "visuals");
const G = JSON.parse(fs.readFileSync(path.join(dir, "sky-golden.json"), "utf8"));
const themes = V.loadThemes(JSON.parse(fs.readFileSync(path.join(dir, "themes.json"), "utf8")));
const registry = JSON.parse(fs.readFileSync(path.join(dir, "registry.json"), "utf8"));
const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const ch = (c, s) => (c >> s) & 255;

test("same theme ids as the game", () => assert.deepStrictEqual(Object.keys(themes), V.THEME_IDS));
test("time of day: celestial angle, daylight, sunset and night match Java", () => {
  for (const [t, ang, day, sun, night] of G.time) { near(V.skyAngle(t), ang, 1e-12, "angle " + t); near(V.daylight(t), day, 1e-12, "day " + t); near(V.sunsetAmount(t), sun, 1e-12, "sunset " + t); near(V.nightAmount(t), night, 1e-12, "night " + t); }
});
test("sky colors for every theme, elevation, time and adjustment match Java within one step per channel", () => {
  const adj = { brightness: 1.2, saturation: 0.6, contrast: 1.1, tint: 0x88aaff, tintStrength: 0.25 };
  let worst = 0;
  for (const [id, e, t, a, want] of G.colors) { const got = V.skyColor(themes[id], e, t, a ? adj : V.NONE); for (const s of [16, 8, 0]) worst = Math.max(worst, Math.abs(ch(got, s) - ch(want, s))); }
  assert.ok(worst <= 1, "largest channel difference " + worst); assert.strictEqual(G.colors.length, 8 * 4 * 4 * 2);
});
test("random numbers and star positions are identical, so stars land in the same places", () => {
  const r = new V.Rng(42); for (const v of G.rng) assert.strictEqual(r.next(), v);
  const f = V.StarField(1337, 1, 1); assert.strictEqual(f.count, G.stars.count);
  G.stars.first.forEach(([x, y, z, size, phase, b], k) => { near(f.x[k], x, 1e-6, "x"); near(f.y[k], y, 1e-6, "y"); near(f.z[k], z, 1e-6, "z"); near(f.size[k], size, 1e-6, "size"); near(f.phase[k], phase, 1e-6, "phase"); near(f.brightness(k, 3.5, 1, 1, 1), b, 1e-6, "brightness"); });
});
test("aurora ribbon heights, cape motion and the totem pop pose match Java", () => {
  G.aurora.forEach((v, k) => near(V.auroraElevation(k * 0.9, k * 1.7, k % 3, 0.32, 1), v, 1e-12, "aurora " + k));
  const c = V.CapeSim();
  G.cape.forEach(([swing, side], k) => { const z = k < 20 ? 0.2 * k : 3.8; c.tick(0, 64, z, 0, k >= 25, k < 20 ? 0.8 : 0, k * 0.6); near(c.swing, swing, 1e-3, "swing " + k); near(c.sideways, side, 1e-3, "side " + k); });
  [0, 0.1, 0.25, 0.5, 0.75, 1].forEach((t, k) => V.totemPose(t, 0.3, -0.2).forEach((v, i) => near(v, G.totem[k][i], 1e-9, `totem ${t}[${i}]`)));
});
test("all " + G.validation.length + " setting probes get the same accept/reject decision as the game", () => {
  const rules = V.makeRules(registry), bad = G.validation.filter(([k, v, ok]) => (rules.validate(k, v) === null) !== ok);
  assert.deepStrictEqual(bad.slice(0, 10), []);
});
test("profile files: launcher output is what the game's format expects; malformed files are refused", () => {
  const rules = V.makeRules(registry), d = rules.defaults();
  assert.strictEqual(d["sky.theme"], "aurora"); assert.strictEqual(d["settings.guiKey"], "344");
  const txt = V.exportProfile("Default", { ...d, "sky.theme": "cosmic" });
  assert.ok(txt.startsWith("auroras-profile=2\nname=Default\n"));
  const keys = txt.trim().split("\n").slice(2).map((l) => l.split("=")[0]); assert.deepStrictEqual(keys, [...keys].sort());
  assert.strictEqual(V.importProfile(txt, rules).values["sky.theme"], "cosmic");
  assert.throws(() => V.importProfile("auroras-profile=1\nname=x\nsky.theme=rainbow\n", rules), /Line 3/);
  assert.throws(() => V.importProfile("auroras-profile=3\nname=x\n", rules), /unsupported/);
  assert.throws(() => V.exportProfile("../x", {}), /Bad profile name/);
  assert.strictEqual(V.placeKey("Play.Example.NET:25565"), "server:play.example.net"); assert.strictEqual(V.placeKey("", "My World"), "world:My World");
});
test("quality presets and particle pool behave like the game's", () => {
  const p = V.Particles(512, 7); p.setBudget(1000, V.QUALITY.BALANCED, 1); assert.strictEqual(p.budget(), 256);
  let s = 0; for (let k = 0; k < 100; k++) s += p.emit(30, 0.1, 0, 64, 0, 0.5, 1, 1.5, 1, 0); assert.strictEqual(s, 256);
  for (let k = 0; k < 40; k++) p.update(0.05, 0, 1, 32); assert.strictEqual(p.count, 0);
  const g = V.Governor(60); for (let k = 0; k < 60; k++) g.update(40); assert.ok(g.factor() < 0.5);
});
