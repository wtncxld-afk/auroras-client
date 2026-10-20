// The launcher's HUD editor must lay out and format the HUD exactly like the game. visuals/hud-golden.json is written by Golden.java.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const V = require("../visuals/visuals.js"), H = V.H;
const G = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "visuals", "hud-golden.json"), "utf8")).cases;
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "visuals", "registry.json"), "utf8")), rules = V.makeRules(registry);
const of = (k) => G.filter((c) => c[0] === k);

test(`all ${G.length} HUD cases from the game match`, () => {
  const bad = [];
  const eq = (c, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad.push([c, got]); };
  for (const c of of("fps")) eq(c, H.fps(144, 137.6, 6.94, c[2], c[3], c[1]), c[4]);
  for (const c of of("coords")) { const m = c[5]; eq(c, H.coords(c[1], c[2], c[3], c[4], (m & 1) > 0, (m & 2) > 0, (m & 4) > 0, m === 7 ? "NW" : null), c[6]); }
  for (const c of of("cps")) eq(c, H.cps(11, 4, c[2], c[1]), c[3]);
  for (const c of of("spotifyCard")) { const k = H.spotifyCard(c[1], c[2], c[3]); eq(c, [k.w, k.h, k.art, k.pad, k.textX, k.textW, k.titleY, k.artistY, k.barY, k.barH, k.expanded], c[4]); }
  for (const c of of("marquee")) eq(c, H.marquee(c[1], 120, c[2], 24, 1.5, c[3]), c[4]);
  for (const c of of("progressFrac")) eq(c, H.progressFrac(c[1], c[2]), c[3]);
  assert.ok(of("spotifyCard").length === 8 && of("marquee").length === 42, "Spotify card cases are in the golden file");
  for (const c of of("ping")) { eq(c, H.ping(c[1]), c[2]); eq(c, H.pingLevel(c[1], 80, 160), c[3]); }
  for (const c of of("potionTime")) eq(c, H.potionTime(c[1]), c[2]);
  for (const c of of("potionName")) eq(c, H.potionName("Speed", c[1]), c[2]);
  for (const c of of("potionOrder")) eq(c, H.potionOrder(["Speed", "Haste", "Night Vision", "Absorption"], [600, -1, 600, 40], c[1]), c[2]);
  for (const c of of("durability")) eq(c, H.durability(c[2], c[3], c[1]), c[4]);
  for (const c of of("session")) eq(c, H.session(c[1]), c[2]);
  for (const c of of("sessionInfo")) { const m = c[1]; eq(c, H.sessionInfo("1.21.4", "Fabric", m % 3 === 0 ? "" : "Survival", "play.example.net", 754000, (m & 1) > 0, (m & 2) > 0, (m & 4) > 0, (m & 8) > 0, (m & 16) > 0), c[2]); }
  for (const c of of("target")) eq(c, H.target("Zombie", c[1], c[2], c[3], (c[4] & 1) > 0, (c[4] & 2) > 0), c[5]);
  const sp = of("spotify").map((c) => c[1]);
  eq("spotify", [H.spotify("Song", "Artist", true, 65000, 200000, true, null), H.spotify("Song", "", false, 0, 0, true, null), H.spotify(null, null, false, 0, 0, true, null), H.spotify("Song", "Artist", true, 1, 2, false, "not connected")], sp);
  const sm = H.Smooth(); sm.update(0, 0.016, 0.15, false); const sv = Array.from({ length: 20 }, () => sm.update(20, 0.016, 0.15, false));
  of("smooth")[0][1].forEach((v, i) => { if (Math.abs(v - sv[i]) > 1e-9) bad.push(["smooth", i, sv[i], v]); });
  const fd = H.Fade(); const fv = Array.from({ length: 12 }, (_, k) => fd.update(k < 8, 0.05, 0.2, false)); of("fade")[0][1].forEach((v, i) => { if (Math.abs(v - fv[i]) > 1e-9) bad.push(["fade", i]); });
  let g = 0; const kg = Array.from({ length: 10 }, (_, k) => (g = H.keyGlow(g, k < 2, 0.03, true))); of("keyGlow")[0][1].forEach((v, i) => { if (Math.abs(v - kg[i]) > 1e-9) bad.push(["keyGlow", i]); });
  const es = [{ id: "fps", name: "FPS Counter", category: "HUD", width: 70 }, { id: "zoom", name: "Zoom", category: "Player", width: 30 }, { id: "sky", name: "Custom Skies", category: "World", width: 70 }, { id: "clock", name: "Clock", category: "HUD", width: 32 }];
  for (const c of of("moduleList")) eq(c, H.moduleList(es, c[1]).map((e) => e.id), c[2]);
  for (const c of of("box")) eq(c, V.box(c[1], 50, 9), [c[2], c[3]]);
  for (const c of of("resolve")) { const r = V.resolve(c[3], c[4], c[5], 80, 13, c[1], c[2]), b = V.fromPosition(r[0], r[1], 80, 13, c[1], c[2]); eq(c, [r[0], r[1], b.anchor, b.offX, b.offY], c.slice(6)); }
  for (const c of of("snap")) eq(c, V.snap(c[1], c[2], 60, 12, 854, 480, 6, [[200, 300, 100, 20]]).slice(0, 2), [c[3], c[4]]);
  for (const c of of("scaleFromDrag")) { const v = V.scaleFromDrag(c[1], c[2], 100); if (Math.abs(v - c[3]) > 1e-6) bad.push([c, v]); }
  for (const c of of("ksLayout")) { const m = c[3], l = V.KS.layout(c[1], c[2], (m & 1) > 0, (m & 2) > 0, (m & 4) > 0, (m & 8) > 0 ? "text" : "bar"); eq(c, [l.w, l.h, l.keys.map((k) => [k.input, k.x, k.y, k.w, k.h])], c.slice(4)); }
  for (const c of of("ksLabel")) eq(c, V.KS.label(c[1], c[3], c[4], c[2]), c[5]);
  for (const c of of("ksFit")) eq(c, V.KS.fitScale(c[1], c[2]), c[3]);
  let g2 = 0; of("keyGlowFade")[0][1].forEach((v, i) => { g2 = H.keyGlowFade(g2, i < 2, 0.05, 0.3); if (Math.abs(v - g2) > 1e-9) bad.push(["keyGlowFade", i]); });
  for (const c of of("textColor")) eq(c, H.textColor(c[1], 0x6fe3ff, 0xb58cff, c[2], c[3], c[4]), c[5]);
  for (const c of of("roundRect")) eq(c, H.roundRect(c[1], c[2], c[3]), c[4]);
  for (const c of of("roundOutline")) eq(c, H.roundOutline(c[1], c[2], c[3]), c[4]);
  for (const c of of("skinSize")) eq(c, V.SKIN.size(V.SKIN.card(c[1]), c[2], c[3], c[4], c[5]), [c[6], c[7]]);
  for (const c of of("skinRadius")) { const v = V.SKIN.radius(c[1], c[2], c[3]); if (Math.abs(v - c[4]) > 1e-9) bad.push([c, v]); }
  for (const c of of("skinPress")) { const v = [V.SKIN.press(c[1]), V.SKIN.travel(V.SKIN.CREAM, c[1]), V.SKIN.squish(c[1])]; if (v.some((x, i) => Math.abs(x - c[2 + i]) > 1e-9)) bad.push([c, v]); }
  for (const c of of("skinKeyText")) { const v = V.SKIN.keyText(c[1]); if (Math.abs(v - c[2]) > 1e-9) bad.push([c, v]); }
  for (const c of of("skinIcon")) eq(c, V.SKIN.icon(c[1]), c[2]);
  assert.ok(of("skinSize").length === 96 && of("skinPress").length === 5, "HUD card sizes (HudSkin) are in the golden file");
  assert.ok(of("ksLayout").length === 192 && of("ksLabel").length === 648 && of("textColor").length === 108 && of("roundRect").length === 42, "keystrokes and styling cases are in the golden file");
  assert.deepStrictEqual(bad.slice(0, 8), []);
});
test("snap reports which line it snapped to, for alignment guides", () => {
  const [x, y, gx, gy] = V.snap(394, 100, 60, 12, 854, 480, 6, []); assert.deepStrictEqual([x, gx, gy], [397, 427, null]);
  assert.deepStrictEqual(V.snap(300, 100, 60, 12, 854, 480, 6, []).slice(2), [null, null]);
});
test("HUD layouts: capture, export and import with the game's validation", () => {
  const vals = { ...rules.defaults(), "fps.offX": "120", "fps.style": "expanded", "clock.enabled": "true" };
  const lay = V.captureLayout(registry, vals); assert.strictEqual(lay["fps.offX"], "120"); assert.ok(!("fps.showAverage" in lay) && !Object.keys(lay).some((k) => k.startsWith("sky.")));
  const back = V.importLayout(registry, rules, V.exportLayout("Arena", lay)); assert.deepStrictEqual(back, lay);
  assert.throws(() => V.importLayout(registry, rules, "auroras-hudlayout=1\nname=x\nsky.theme=void\n"), /not a HUD layout setting/);
  assert.throws(() => V.importLayout(registry, rules, "auroras-hudlayout=1\nname=x\nfps.scale=9\n"), /out of range/);
});
test("profile migration: format-1 files load in the launcher too, renamed keys follow", () => {
  const p = V.importProfile("auroras-profile=1\nname=Old\nbranding.enabled=true\n", rules); assert.strictEqual(p.values["brandinghud.enabled"], "true"); assert.strictEqual(p.format, 1);
  const l = V.importProfile("auroras-profile=2\nname=L\nfps.scale=999\nfps.enabled=true\nnot a line\n", rules, { strict: false }); assert.deepStrictEqual([l.values["fps.enabled"], l.skipped, "fps.scale" in l.values], ["true", 2, false]);
  assert.ok(V.exportProfile("X", {}).startsWith("auroras-profile=2\n"));
});
