// Animated sky effects: visuals.js must match client-mod/core SkyFx.java (golden values written by Golden.java).
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const V = require("../visuals/visuals.js");
const dir = path.join(__dirname, "..", "visuals"), G = JSON.parse(fs.readFileSync(path.join(dir, "sky-golden.json"), "utf8")).fx;
const themes = V.loadThemes(JSON.parse(fs.readFileSync(path.join(dir, "themes.json"), "utf8")));
const f32 = (a) => Array.from(a, Math.fround), same32 = (got, want, what) => assert.deepStrictEqual(f32(got), f32(want), what);

test("hash matches Java bit for bit, including negative indexes and seeds", () => { G.u.forEach(([i, salt, want], k) => assert.strictEqual(V.fxU(1234567 * (k - 5), i, salt), want)); });
test("shooting stars: same meteors at the same moments, and the long-run rate matches the setting", () => {
  const out = new Float32Array(V.METEOR_FIELDS * 4), seen = new Map(G.meteors.map((m) => [m[0], m]));
  let frames = 0; for (let t = 0; t < 90; t += 0.37) { const c = V.meteors(99, 6, t, 4, out); if (!c) continue; frames++; const g = seen.get(t); assert.ok(g, "Java had no meteor at " + t); assert.strictEqual(c, g[1]); same32(out.slice(0, c * 6), g[2], "meteor at " + t); }
  assert.strictEqual(frames, G.meteors.length);
  let n = 0; for (let t = 0; t < 600; t += 0.1) n += V.meteors(5, 3, t, 4, out) > 0 ? 1 : 0; assert.strictEqual(n, G.meteorFrames);
  assert.strictEqual(V.meteors(5, 0, 12, 4, out), 0, "rate 0 means none"); assert.strictEqual(V.meteors(5, 30, 12, 0, out), 0, "budget 0 means none");
});
test("petals, clouds and nebula blobs sit in the same place at the same time", () => {
  const o = new Float32Array(4);
  for (const [k, t, want] of G.petals) { V.petal(31, k, t, o); same32(o, want, "petal " + k); }
  for (const [k, t, want] of G.clouds) { V.cloud(17, k, t, o); same32(o, want, "cloud " + k); }
  for (const [k, t, d, want] of G.nebula) { V.nebula(77, k, t, d, o); same32(o, want, "nebula " + k); }
  assert.deepStrictEqual([0, 0.5, 1].map((d) => V.cloudColor(0xffc29e, 0x203050, d)), G.cloudColor);
});
test("layered aurora waves and shimmer; layer 0 at wave 1 is the classic curve", () => {
  G.aurora.forEach(([w, sh], k) => { assert.ok(Math.abs(V.auroraWave(k * 0.7, k * 2.1, k % 3, k % 3, 0.32, 1, k * 0.25) - w) < 1e-12); assert.ok(Math.abs(V.auroraShimmer(k * 0.7, k * 2.1, k % 3, k % 3, 1.2) - sh) < 1e-12); });
  assert.ok(Math.abs(V.auroraWave(1.1, 4.2, 2, 0, 0.32, 1, 1) - V.auroraElevation(1.1, 4.2, 2, 0.32, 1)) < 1e-12);
});
test("constellations pick the same stars and lines", () => {
  const c = V.Constellations(V.StarField(1337, 1.6, 1), 4242, 6);
  assert.strictEqual(c.groups, G.constellations.groups); assert.deepStrictEqual(c.pairs, G.constellations.pairs); assert.deepStrictEqual(c.groupOf, G.constellations.groupOf);
  assert.ok(Math.abs(V.Constellations.alpha(3, 7.5, 0.8) - G.constellations.alpha) < 1e-12); assert.ok(c.groups >= 3, "a dense field yields several constellations");
});
test("quality budgets, per-theme effects, sky quality and the animation clock", () => {
  for (const [q, b] of Object.entries(G.budgets)) { const j = V.FX_BUDGET[q]; assert.deepStrictEqual([j.meteors, j.petals, j.cloudPuffs, j.nebulaBlobs, j.auroraLayers, j.ribbonSteps, j.constellationGroups], b, q); }
  for (const [id, want] of Object.entries(G.themes)) { const x = themes[id].fx; assert.deepStrictEqual([x.meteorsPerMinute, x.clouds, x.cloudColor, x.petals, x.petalColor, x.constellations, x.nebulaDrift, x.auroraLayers], want, id); }
  assert.deepStrictEqual([V.fxClock(10, 1.5, true), V.fxClock(10, 9, true), V.fxClock(10, 1, false)], G.clock);
  assert.deepStrictEqual([V.skyQuality("auto", "HIGH"), V.skyQuality("LOW", "HIGH"), V.skyQuality("auto", undefined)], ["HIGH", "LOW", "BALANCED"]);
  assert.ok(themes.sakura.fx.petals > 0 && themes.aurora.fx.auroraLayers === 3 && themes.celestial.fx.constellations && themes.cosmic.fx.nebulaDrift > 0, "each theme has its own animation");
});
test("bad effect data is refused", () => {
  assert.throws(() => V.parseFx({ ...themes.aurora.fx, meteorsPerMinute: 99, cloudColor: "#ffffff", petalColor: "#ffffff" }), /meteorsPerMinute/);
  assert.throws(() => V.parseFx({ meteorsPerMinute: 1, clouds: 0, cloudColor: "white", petals: 0, petalColor: "#ffffff", constellations: false, nebulaDrift: 0, auroraLayers: 1 }), /color/i);
});
