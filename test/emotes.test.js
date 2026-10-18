// Emotes: visuals.js must match client-mod/core Emotes.java (visuals/emote-golden.json is written by Golden.java).
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const V = require("../visuals/visuals.js");
const dir = path.join(__dirname, "..", "visuals"), G = JSON.parse(fs.readFileSync(path.join(dir, "emote-golden.json"), "utf8"));
const lib = V.parseEmoteLibrary(JSON.parse(fs.readFileSync(path.join(dir, "emotes.json"), "utf8"))), byId = Object.fromEntries(lib.map((e) => [e.id, e]));
const near = (a, b, what) => { assert.strictEqual(a.length, b.length, what); a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < 1e-9, `${what}[${i}]: ${x} vs ${b[i]}`)); };

test("easing curves match Java", () => { let i = 0; for (let e = 0; e < V.EASINGS.length; e++) for (let k = 0; k <= 8; k++) assert.ok(Math.abs(V.ease(e, k / 8) - G.ease[i++]) < 1e-12); });
test("every built-in emote poses the same as in the game", () => {
  assert.deepStrictEqual(Object.keys(G.poses), lib.map((e) => e.id)); const o = new Float64Array(28);
  for (const em of lib) G.poses[em.id].forEach((want, k) => { const t = (em.duration * k) / 6 + (k === 3 ? 0.013 : 0); V.emotePose(em, Math.min(t, em.duration), o); near(Array.from(o), want, em.id + " @" + k); });
});
test("looping and one-shot timing", () => { const el = [-1, 0, 0.7, 1.6, 2.5, 3.3]; el.forEach((e, k) => { assert.ok(Math.abs(V.emoteLocalTime(byId.groove, e) - G.local[k][0]) < 1e-12); assert.strictEqual(V.emoteLocalTime(byId.wave, e), G.local[k][1]); }); });
test("controller: play, cross-fade, cancel and finish exactly like the game", () => {
  const c = V.EmoteController(); c.setSpeed(1.25); c.setBlend(0.2); const o = new Float64Array(28), w = new Float64Array(7);
  for (const [t, act, id, playing, active, lastEnd, pose, weight] of G.controller) {
    if (act === "play") c.play(byId[id], t); else if (act === "cancel") c.cancel(t, "cancelled"); c.update(t); c.sample(t, o, w);
    assert.strictEqual(c.playing(), playing, "playing @" + t); assert.strictEqual(c.active(t), active, "active @" + t); assert.strictEqual(c.lastEnd, lastEnd);
    near(Array.from(o), pose, "pose @" + t); near(Array.from(w), weight, "weight @" + t);
  }
});
test("wheel: slot from mouse direction, and wheel file parsing", () => {
  const pts = [[0, -50], [40, -40], [50, 0], [30, 30], [0, 50], [-35, 35], [-50, 0], [-30, -40], [3, 4], [10, -100], [100, -10]];
  assert.deepStrictEqual(pts.map(([x, y]) => V.wheelSlot(x, y, 12)), G.wheel);
  assert.strictEqual(V.parseWheel("auroras-wheel=1\nslot1=wave\nslot3=nope\nslot9=wave\nslotx=clap\nslot8 = clap\n", new Set(["wave", "clap"])).map(String).join(","), G.wheelText);
  const slots = ["wave", null, "clap", null, null, null, null, "sit"]; assert.deepStrictEqual(V.parseWheel(V.writeWheel(slots), new Set(["wave", "clap", "sit"])), slots);
});
test("validation accepts and refuses the same emotes as Java, with a reason", () => {
  for (const [ok, js] of G.parse) { let got = true; try { V.parseEmote(JSON.parse(js)); } catch (e) { got = false; assert.match(e.message, /^emote/); } assert.strictEqual(got, ok, js); }
  assert.throws(() => V.parseEmoteFile("{}"), /schema 1/); assert.throws(() => V.parseEmoteFile("nope"), /valid JSON/); assert.throws(() => V.parseEmoteFile(" ".repeat(70000)), /too large/);
});
test("export and re-import round-trips every built-in emote", () => { for (const em of lib) assert.deepStrictEqual(V.parseEmoteFile(V.emoteFileText(em)), em); });
test("the library covers every category but Custom, with looping dances", () => {
  for (const c of ["Greetings", "Celebrate", "Dance", "Reactions"]) assert.ok(lib.some((e) => e.category === c), c);
  assert.ok(lib.filter((e) => e.loop).length >= 2 && lib.length >= 12);
});
