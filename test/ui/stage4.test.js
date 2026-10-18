// Stage 4 interface tests: version types and the compatibility matrix, the HUD editor, Spotify settings, emotes.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const { launch, wait, nav, calls, tap } = require("./harness");
const lastSet = async (page) => (await calls(page, "modcfgUpdate")).at(-1);

describe("versions: types, filters and Auroras compatibility", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Instances"); await tap(s.page, s.page.locator("[data-new]").first()); await s.page.locator("#cn").fill("Dev build"); await tap(s.page, "[data-m=next]"); await wait(s.page, 300); }); after(() => s.close());
  test("each version shows its type and what Auroras supports there", async () => {
    assert.match(await s.page.locator('#vl .vrow[data-v="1.21.4"]').textContent(), /Release.*Auroras: experimental/);
    assert.match(await s.page.locator('#vl .vrow[data-v="26.1"]').textContent(), /Auroras: unsupported/);
  });
  test("with development builds on, filter chips separate pre-releases, RCs and snapshots", async () => {
    await tap(s.page, '[data-m="vfilter"][data-v="dev"]'); await wait(s.page, 300);
    assert.strictEqual(await s.page.locator('[data-m="vkind"]').count(), 5);
    await tap(s.page, '[data-m="vkind"][data-v="rc"]'); assert.deepStrictEqual(await s.page.locator("#vl .vrow").evaluateAll((r) => r.map((x) => x.dataset.v)), ["1.21.5-rc1"]);
    assert.match(await s.page.locator("#vl").textContent(), /Release candidate.*leads to 1\.21\.5/);
    await tap(s.page, '[data-m="vkind"][data-v="prerelease"]'); assert.deepStrictEqual(await s.page.locator("#vl .vrow").evaluateAll((r) => r.map((x) => x.dataset.v)), ["1.21.5-pre1"]);
    await tap(s.page, '[data-m="vkind"][data-v="all"]'); assert.strictEqual(await s.page.locator("#vl .vrow").count(), 3, "snapshots and pre-releases only, no releases mixed in");
  });
  test("choosing a development build warns that Auroras stays off and lists every feature as unsupported", async () => {
    await tap(s.page, '#vl .vrow[data-v="1.21.5-rc1"]'); await tap(s.page, "[data-m=next]"); await wait(s.page, 150);
    const t = await s.page.locator("#modal").textContent(); assert.match(t, /untested development build.*Auroras mod stays off/); assert.match(t, /Emotes: Unsupported/);
    await tap(s.page, "[data-m=back]"); await tap(s.page, '[data-m="vfilter"][data-v="releases"]'); await wait(s.page, 300); await tap(s.page, '#vl .vrow[data-v="1.21.4"]'); await tap(s.page, "[data-m=next]"); await wait(s.page, 150);
    assert.match(await s.page.locator("#modal").textContent(), /Custom skies: Experimental/); assert.doesNotMatch(await s.page.locator("#modal").textContent(), /development build/);
  });
  test("compatibility matrix in Settings lists every version with honest states", async () => {
    await s.page.keyboard.press("Escape"); await nav(s.page, "Settings"); await tap(s.page, "[data-compat]"); await wait(s.page, 300);
    assert.strictEqual(await s.page.locator(".ctable tbody tr").count(), 6); const t = await s.page.locator(".ctable").textContent();
    assert.match(t, /1\.21\.5-rc1.*Release candidate/); assert.doesNotMatch(t, /Tested/); assert.match(t, /never been built/);
    await tap(s.page, '[data-ck="snapshot"]'); assert.strictEqual(await s.page.locator(".ctable tbody tr").count(), 1); await tap(s.page, "#dmodal [data-x]");
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("HUD editor", () => {
  let s; const rect = (id) => s.page.evaluate((i) => { const r = HE.rects[i], c = document.getElementById("he-cv").getBoundingClientRect(); return { ...r, cx: c.left + (r.x + r.w / 2) * HE.k, cy: c.top + (r.y + r.h / 2) * HE.k, rx: c.left + (r.x + r.w - 1) * HE.k, ry: c.top + (r.y + r.h - 1) * HE.k, k: HE.k }; }, id);
  before(async () => { s = await launch(); await nav(s.page, "Modules"); await wait(s.page, 200); for (const id of ["fps", "coords", "clock", "keystrokes"]) await tap(s.page, `[data-enable="${id}"]`); await tap(s.page, "[data-hudedit]"); await wait(s.page, 400); });
  after(() => s.close());
  test("draws the enabled elements where the game would put them", async () => {
    assert.deepStrictEqual(Object.keys(await s.page.evaluate(() => HE.rects)).sort(), ["clock", "coords", "fps", "keystrokes"]);
    const ok = await s.page.evaluate(() => { const { w, h } = guiSize(), r = HE.rects.fps, p = VX.resolve(HE.draft["fps.anchor"], +HE.draft["fps.offX"], +HE.draft["fps.offY"], r.w, r.h, w, h); return p[0] === r.x && p[1] === r.y && w === 480 && h === 270; });
    assert.ok(ok, "1920x1080 at Auto GUI scale is 480x270 and FPS sits at its resolved position");
  });
  test("dragging re-anchors with the game's rules and snaps to the centre line", async () => {
    const r = await rect("fps"); await s.page.mouse.move(r.cx, r.cy); await s.page.mouse.down();
    const target = await s.page.evaluate(() => { const c = document.getElementById("he-cv").getBoundingClientRect(); return { x: c.left + 241 * HE.k, y: c.top + 200 * HE.k }; });
    await s.page.mouse.move(target.x, target.y, { steps: 6 }); const guides = await s.page.evaluate(() => HE.guides); await s.page.mouse.up();
    const d = await s.page.evaluate(() => ({ a: HE.draft["fps.anchor"], x: +HE.draft["fps.offX"], r: HE.rects.fps }));
    assert.strictEqual(d.a, "BC"); assert.strictEqual(guides[0], 240, "snapped to the vertical centre line"); assert.strictEqual(d.r.x + Math.floor(d.r.w / 2), 240);
  });
  test("Alt turns snapping off; the resize handle changes scale", async () => {
    let r = await rect("clock"); await s.page.mouse.move(r.cx, r.cy); await s.page.keyboard.down("Alt"); await s.page.mouse.down(); await s.page.mouse.move(r.cx - 20 * r.k, r.cy + 30 * r.k, { steps: 4 }); await s.page.mouse.up(); await s.page.keyboard.up("Alt");
    assert.deepStrictEqual(await s.page.evaluate(() => HE.guides), [null, null]);
    r = await rect("clock"); await s.page.mouse.click(r.cx, r.cy); r = await rect("clock"); await s.page.mouse.move(r.rx, r.ry); await s.page.mouse.down(); await s.page.mouse.move(r.rx + 30 * r.k, r.ry, { steps: 4 }); await s.page.mouse.up();
    assert.ok(+(await s.page.evaluate(() => HE.draft["clock.scale"])) > 1.2);
  });
  test("style panel edits the selected element; arrow keys nudge; reset position restores defaults", async () => {
    let r = await rect("coords"); await s.page.mouse.click(r.cx, r.cy); await s.page.locator("#he-panel details").evaluateAll((ds) => ds.forEach((d) => (d.open = true))); await tap(s.page, '#he-panel [data-sk="style"] [data-v="expanded"]'); await wait(s.page, 120);
    assert.strictEqual(await s.page.evaluate(() => HE.draft["coords.style"]), "expanded");
    r = await rect("coords"); await s.page.mouse.click(r.cx, r.cy); // arrows nudge the element when the stage has focus (a focused control keeps its own arrow keys)
    const before_ = await s.page.evaluate(() => HE.rects.coords.x); await s.page.keyboard.press("Shift+ArrowRight"); assert.strictEqual(await s.page.evaluate(() => HE.rects.coords.x), before_ + 10);
    await tap(s.page, '[data-he="reset-el"]'); assert.deepStrictEqual(await s.page.evaluate(() => [HE.draft["coords.anchor"], HE.draft["coords.offX"], HE.draft["coords.offY"]]), ["TL", "4", "36"]);
  });
  test("elements stay on screen at every size and GUI scale", async () => {
    for (const sc of ["1024x768", "3440x1440", "1366x768"]) for (const g of ["0", "4"]) {
      await s.page.locator("#he-screen").selectOption(sc); await s.page.locator("#he-gui").selectOption(g); await wait(s.page, 60);
      const ok = await s.page.evaluate(() => { const { w, h } = guiSize(); return Object.values(HE.rects).every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= Math.max(w, r.w) && r.y + r.h <= Math.max(h, r.h)); });
      assert.ok(ok, sc + " / GUI " + g);
    }
    await s.page.locator("#he-screen").selectOption("1920x1080"); await s.page.locator("#he-gui").selectOption("0");
  });
  test("layout presets: save, load and delete; bad imports are refused", async () => {
    await tap(s.page, '[data-he="save-preset"]'); await s.page.locator("#pd-in").fill("Arena"); await tap(s.page, "[data-ok]"); await wait(s.page, 100);
    assert.ok((await calls(s.page, "layoutsSave")).at(-1).layout["fps.anchor"] === "BC");
    await s.page.evaluate(() => { HE.draft["fps.anchor"] = "TL"; }); await tap(s.page, '[data-hel="Arena"]'); assert.strictEqual(await s.page.evaluate(() => HE.draft["fps.anchor"]), "BC");
    await s.page.locator("#he-imp").setInputFiles({ name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("auroras-hudlayout=1\nname=x\nsky.theme=void\n") }); await wait(s.page, 150);
    assert.match(await s.page.locator(".toast").textContent(), /not a HUD layout setting/);
    await tap(s.page, '[data-heldel="Arena"]'); await tap(s.page, "#dmodal [data-ok]"); await wait(s.page, 100); assert.deepStrictEqual(await calls(s.page, "layoutsDelete"), ["Arena"]);
  });
  test("Save layout writes only what changed, as validated settings; preview hides outlines", async () => {
    await tap(s.page, "#he-prev"); assert.strictEqual(await s.page.evaluate(() => HE.preview), true); await tap(s.page, "#he-prev");
    const n = (await calls(s.page, "modcfgUpdate")).length; await tap(s.page, '[data-he="apply"]'); await wait(s.page, 150);
    const set = (await lastSet(s.page)).set; assert.ok((await calls(s.page, "modcfgUpdate")).length === n + 1);
    assert.strictEqual(set["fps.anchor"], "BC"); assert.strictEqual(set["coords.style"], "expanded"); assert.ok(!("fps.color" in set) && !("clock.enabled" in set), "unchanged keys aren't written");
    assert.strictEqual(await s.page.locator("#hudedit").count(), 0);
  });
  test("Cancel discards everything", async () => {
    await tap(s.page, "[data-hudedit]"); await wait(s.page, 300); await s.page.evaluate(() => { HE.draft["fps.anchor"] = "TR"; }); const n = (await calls(s.page, "modcfgUpdate")).length;
    await tap(s.page, '[data-he="cancel"]'); assert.strictEqual((await calls(s.page, "modcfgUpdate")).length, n);
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("Spotify settings", () => {
  test("client ID is validated; connect and disconnect go through the desktop app", async () => {
    const s = await launch();
    try {
      await nav(s.page, "Settings"); await s.page.locator("#spid").fill("nope"); await tap(s.page, '[data-save="sp"]'); await wait(s.page, 100);
      assert.match(await s.page.locator("#spres").textContent(), /client ID/);
      await s.page.locator("#spid").fill("0123456789abcdef0123456789abcdef"); await tap(s.page, '[data-save="sp"]'); await wait(s.page, 100); assert.match(await s.page.locator("#spres").textContent(), /Saved/);
      await tap(s.page, "[data-spconnect]"); await wait(s.page, 100); assert.match(await s.page.locator("#spres").textContent(), /Spotify connected/);
      await tap(s.page, "[data-spdisc]"); await wait(s.page, 100); assert.match(await s.page.locator("#spres").textContent(), /disconnected/);
      assert.deepStrictEqual(s.errors, []);
    } finally { await s.close(); }
  });
});

describe("animated skies in the Visual Studio", () => {
  let s; const snap = () => s.page.evaluate(() => { const c = document.getElementById("sky-cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) | 0; return h; });
  before(async () => { s = await launch(); await nav(s.page, "Cosmetics"); await wait(s.page, 500); }); after(() => s.close());
  test("the new animation settings are on the sky panel", async () => {
    for (const k of ["animSpeed", "effectsOpacity", "shootingStars", "nebulaSpeed", "auroraWaves", "clouds", "petals", "constellations", "skyQuality"]) assert.strictEqual(await s.page.locator(`#sky-set [data-sk="${k}"]`).count(), 1, k);
    const txt = await s.page.locator("#sky-set").textContent(); for (const l of ["Animation speed", "Effects opacity", "Shooting stars", "Nebula motion", "Aurora wave intensity", "Clouds", "Falling petals", "Constellations", "Sky quality"]) assert.ok(txt.includes(l), l);
  });
  test("the preview moves when animation is on and holds still when it's off", async () => {
    await tap(s.page, '[data-th="sakura"]'); await s.page.evaluate(() => { VS.ticks = 6000; }); await wait(s.page, 300);
    const a = await snap(); await wait(s.page, 400); assert.notStrictEqual(await snap(), a, "petals and clouds move");
    await s.page.evaluate(() => { VS.draft.animate = "false"; }); await wait(s.page, 200); const b = await snap(); await wait(s.page, 400); assert.strictEqual(await snap(), b, "animation off freezes the sky");
    await s.page.evaluate(() => { VS.draft.animate = "true"; VS.draft.animSpeed = "0"; }); await wait(s.page, 200); const c = await snap(); await wait(s.page, 400); assert.strictEqual(await snap(), c, "speed 0 also holds still");
    await s.page.evaluate(() => { VS.draft.animSpeed = "1"; });
  });
  test("each theme draws its own effects (petals for Sakura, nebula for Cosmic, layered aurora for Aurora)", async () => {
    const lit = (th, tk, set) => s.page.evaluate(([th, tk, set]) => { const c = document.createElement("canvas"); c.width = 320; c.height = 180; const ctx = c.getContext("2d"), d = { ...VS.draft, ...set };
      drawSky(ctx, 320, 180, th, d, tk, "minecraft:overworld", 12, VX.QUALITY.HIGH, 0.35); const px = ctx.getImageData(0, 0, 320, 180).data; let sum = 0; for (let i = 0; i < px.length; i += 4) sum += px[i] + px[i + 1] + px[i + 2]; return sum; }, [th, tk, set]);
    assert.ok((await lit("sakura", 6000, {})) !== (await lit("sakura", 6000, { petals: "false", clouds: "false" })), "Sakura: petals and clouds");
    assert.ok((await lit("cosmic", 18000, {})) > (await lit("cosmic", 18000, { nebula: "false" })), "Cosmic: nebula");
    assert.ok((await lit("aurora", 18000, { skyQuality: "HIGH" })) > (await lit("aurora", 18000, { skyQuality: "LOW" })), "Aurora: layers at High, none at Low");
    assert.ok((await lit("celestial", 18000, {})) > (await lit("celestial", 18000, { constellations: "false" })), "Celestial: constellation lines");
  });
  test("Low sky quality explains what's reduced; Apply saves the new settings", async () => {
    await s.page.locator("#sky-set details").evaluateAll((ds) => ds.forEach((d) => (d.open = true))); await tap(s.page, '#sky-set [data-sk="skyQuality"] [data-v="LOW"]'); await s.page.locator('#sky-set [data-sk="animSpeed"]').evaluate((el) => { el.value = "1.5"; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
    await tap(s.page, "#sky-apply"); await wait(s.page, 150); const set = (await calls(s.page, "modcfgUpdate")).at(-1).set;
    assert.strictEqual(set["sky.skyQuality"], "LOW"); assert.strictEqual(set["sky.animSpeed"], "1.5"); assert.strictEqual(set["sky.petals"], "true");
    await nav(s.page, "Modules"); await nav(s.page, "Cosmetics"); await wait(s.page, 400); assert.match(await s.page.locator("#vs-body").textContent(), /Sky quality is Low/);
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("Emotes: library and wheel", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Emotes"); await wait(s.page, 600); }); after(() => s.close());
  const ids = () => s.page.locator("[data-esel]").evaluateAll((b) => b.map((x) => x.dataset.esel));
  test("shows the built-in library with categories and says plainly that emotes are local only", async () => {
    assert.strictEqual((await ids()).length, 14); const t = await s.page.locator(".page").textContent();
    assert.match(t, /Local only: other players don’t see your emotes/); assert.match(t, /no emote sync between players/); assert.match(t, /hasn’t been tested in a real game/);
  });
  test("search and category filters", async () => {
    await s.page.locator("#em-q").fill("wav"); assert.deepStrictEqual(await ids(), ["wave"]); await s.page.locator("#em-q").fill("");
    await tap(s.page, '[data-ecat="Dance"]'); assert.deepStrictEqual(await ids(), ["groove", "sway", "dab"]);
    await tap(s.page, '[data-ecat="Custom"]'); assert.match(await s.page.locator("#em-grid").textContent(), /No custom emotes yet/); await tap(s.page, '[data-ecat="All"]');
  });
  test("choosing an emote plays it with the game's controller; recent and favorites are remembered", async () => {
    await tap(s.page, '[data-esel="clap"]'); await wait(s.page, 250);
    assert.match(await s.page.locator("#em-tag").textContent(), /^Clap/); assert.ok(await s.page.evaluate(() => ES.ctrl.playing() && ES.ctrl.current().id === "clap"));
    assert.ok(await s.page.evaluate(() => Array.from(ES.pose).some((v) => Math.abs(v) > 1)), "the model is posed");
    await tap(s.page, '[data-efav="dab"]'); await tap(s.page, '[data-ecat="Favorites"]'); assert.deepStrictEqual(await ids(), ["dab"]);
    await tap(s.page, '[data-ecat="Recent"]'); assert.strictEqual((await ids())[0], "clap"); await tap(s.page, '[data-ecat="All"]');
    assert.deepStrictEqual(await s.page.evaluate(() => JSON.parse(localStorage.getItem("emoteFav"))), ["dab"]);
  });
  test("Stop fades back to the normal pose", async () => {
    await tap(s.page, '[data-ec="stop"]'); await wait(s.page, 600); assert.ok(await s.page.evaluate(() => !ES.ctrl.playing() && Array.from(ES.pose).every((v) => Math.abs(v) < 1e-9)));
    assert.match(await s.page.locator("#em-tag").textContent(), /stopped/);
  });
  test("thumbnails are drawn and animate", async () => {
    const px = () => s.page.evaluate(() => { const c = document.querySelector('[data-ethumb="groove"]'), d = c.getContext("2d").getImageData(0, 0, 72, 72).data; let h = 0, n = 0; for (let i = 3; i < d.length; i += 4) { if (d[i]) n++; h = (h * 31 + d[i - 1] + d[i]) | 0; } return [n, h]; });
    const a = await px(); await wait(s.page, 400); const b = await px(); assert.ok(a[0] > 150, "a figure is drawn"); assert.notStrictEqual(a[1], b[1], "and moves");
  });
  test("wheel: pick a slot, assign an emote, empty a slot; saved through the desktop app", async () => {
    assert.match(await s.page.locator("#em-wheel").textContent(), /Wave[\s\S]*Clap[\s\S]*Cheer/);
    await tap(s.page, '[data-slot="2"]'); await tap(s.page, '[data-esel="dab"]'); await tap(s.page, '[data-ed="assign"]'); await wait(s.page, 100);
    assert.strictEqual((await calls(s.page, "emotesWheel")).at(-1)[2], "dab"); assert.match(await s.page.locator('[data-slot="2"]').textContent(), /Dab/);
    await tap(s.page, '[data-slot="7"]'); await tap(s.page, '[data-wc="clear"]'); await wait(s.page, 100); assert.strictEqual((await calls(s.page, "emotesWheel")).at(-1)[7], null);
    await tap(s.page, '[data-esel="dab"]'); assert.match(await s.page.locator("#em-detail").textContent(), /On wheel slot 3/);
  });
  test("the in-game switch saves emotes.enabled", async () => {
    await tap(s.page, "#em-on"); await wait(s.page, 100); assert.strictEqual((await calls(s.page, "modcfgUpdate")).at(-1).set["emotes.enabled"], "true");
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("Emotes: creator", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Emotes"); await wait(s.page, 500); await tap(s.page, '[data-etab="creator"]'); await wait(s.page, 200); }); after(() => s.close());
  const tl = async (part, t) => s.page.evaluate(([part, t]) => { const c = document.getElementById("ec-tl"), L = tlLayout(c), r = c.getBoundingClientRect(), row = VX.EMOTE_PARTS.indexOf(part); return { x: r.left + L.x(t), y: r.top + L.top + (row + 0.5) * L.rowH }; }, [part, t]);
  test("starts with an editable draft that plays on the model", async () => {
    assert.strictEqual(await s.page.evaluate(() => ES.draft.keys.rightArm.length), 3);
    await tap(s.page, '[data-ec="cplay"]'); await wait(s.page, 500); assert.ok(await s.page.evaluate(() => ES.head > 0.2 && ES.pose[8] < -10), "the right arm rises while playing"); await tap(s.page, '[data-ec="cplay"]');
  });
  test("timeline: click to move the playhead, add a keyframe for another part, edit it with sliders", async () => {
    await tap(s.page, '[data-part="head"]'); const p = await tl("head", 1.0); await s.page.mouse.click(p.x, p.y);
    assert.ok(Math.abs((await s.page.evaluate(() => ES.head)) - 1) < 0.05); await tap(s.page, '[data-cc="add"]');
    assert.strictEqual(await s.page.evaluate(() => ES.draft.keys.head.length), 1);
    await s.page.locator("#ek-p").evaluate((el) => { el.value = "30"; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
    assert.strictEqual(await s.page.evaluate(() => ES.draft.keys.head[0].p), 30); await s.page.locator("#ek-e").selectOption("sine"); assert.strictEqual(await s.page.evaluate(() => ES.draft.keys.head[0].e), "sine");
    await wait(s.page, 100); assert.ok(Math.abs((await s.page.evaluate(() => ES.pose[0])) - 30) < 1e-6, "the preview shows the new head pitch");
  });
  test("keyframe sliders: dragging with the mouse fills the track, shows the pose, pauses playback and is one undo step", async () => {
    await tap(s.page, '[data-ec="cplay"]'); await wait(s.page, 200);
    const r = await s.page.locator("#ek-p").boundingBox(), y = r.y + r.height / 2;
    const before = await s.page.evaluate(() => ES.hist.length);
    await s.page.mouse.move(r.x + r.width * 0.5, y); await s.page.mouse.down();
    for (let k = 1; k <= 8; k++) await s.page.mouse.move(r.x + r.width * (0.5 + k * 0.05), y);
    await s.page.mouse.up(); await wait(s.page, 120);
    const st = await s.page.evaluate(() => ({ p: ES.draft.keys.head[0].p, fill: parseFloat(document.getElementById("ek-p").style.getPropertyValue("--fill")), num: +document.querySelector('[data-numfor="ek-p"]').value, playing: ES.cplay, head: ES.head, hist: ES.hist.length, pose: ES.pose[0] }));
    assert.ok(st.p > 100 && st.p <= 180, "dragged to " + st.p); assert.ok(Math.abs(st.fill - (st.p + 180) / 3.6) < 0.6, "track fill follows the thumb: " + st.fill);
    assert.strictEqual(st.num, st.p); assert.strictEqual(st.playing, false); assert.ok(Math.abs(st.head - 1) < 1e-9); assert.strictEqual(st.hist, before + 1, "one undo step for the whole drag");
    await wait(s.page, 80); assert.ok(Math.abs((await s.page.evaluate(() => ES.pose[0])) - st.p) < 1e-6, "the preview shows the dragged pose");
    await s.page.locator('[data-numfor="ek-p"]').fill("30"); await s.page.locator('[data-numfor="ek-p"]').press("Enter"); assert.strictEqual(await s.page.evaluate(() => ES.draft.keys.head[0].p), 30);
  });
  test("keyframe sliders: typed values are clamped to the range; a time can't land on another keyframe", async () => {
    const num = s.page.locator('[data-numfor="ek-y"]'); await num.fill("500"); await num.press("Enter"); await num.blur(); await wait(s.page, 60);
    assert.strictEqual(await s.page.evaluate(() => ES.draft.keys.head[0].y), 180); assert.strictEqual(await num.inputValue(), "180");
    await s.page.locator("#ek-t").fill("99"); await s.page.locator("#ek-t").blur(); await wait(s.page, 60);
    const d = await s.page.evaluate(() => [ES.draft.keys.head[0].t, curDraft().duration]); assert.strictEqual(d[0], d[1], "time clamps to the emote's length");
    await tap(s.page, '[data-ec="start"]');
  });
  test("playback speed uses the shared slider and changes how fast the creator plays", async () => {
    const r = s.page.locator("#em-speed"); await r.evaluate((el) => { el.value = "2"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    assert.strictEqual(await s.page.evaluate(() => ES.speed), 2); assert.ok(Math.abs(parseFloat(await r.evaluate((el) => el.style.getPropertyValue("--fill"))) - 63.6) < 0.2);
    assert.strictEqual(await s.page.locator('#em-ctrls input.num').inputValue(), "2.00");
  });
  test("selecting a keyframe on the timeline, deleting it, then undo and redo", async () => {
    const p = await tl("rightArm", 1); await s.page.mouse.click(p.x, p.y); assert.deepStrictEqual(await s.page.evaluate(() => [ES.part, ES.key]), ["rightArm", 1]);
    await tap(s.page, '[data-cc="delk"]'); assert.strictEqual(await s.page.evaluate(() => ES.draft.keys.rightArm.length), 2);
    await tap(s.page, '[data-cc="undo"]'); assert.strictEqual(await s.page.evaluate(() => ES.draft.keys.rightArm.length), 3);
    await tap(s.page, '[data-cc="redo"]'); assert.strictEqual(await s.page.evaluate(() => ES.draft.keys.rightArm.length), 2);
  });
  test("problems are explained and block saving; built-in ids are refused", async () => {
    await s.page.locator("#ec-id").fill("Bad Id"); await s.page.locator("#ec-id").dispatchEvent("change"); assert.match(await s.page.locator("#ec-err").textContent(), /id must be 1-32 lowercase/);
    await tap(s.page, '[data-cc="save"]'); assert.strictEqual((await calls(s.page, "emotesSave")).length, 0);
    await s.page.locator("#ec-id").fill("wave"); await s.page.locator("#ec-id").dispatchEvent("change"); await tap(s.page, '[data-cc="save"]'); await wait(s.page, 100);
    assert.match(await s.page.locator("#ec-err").textContent(), /built-in emote/);
  });
  test("save stores it for the instance and it joins the library as Custom; export writes the file", async () => {
    await s.page.locator("#ec-id").fill("nod_wave"); await s.page.locator("#ec-id").dispatchEvent("change"); await s.page.locator("#ec-name").fill("Nod wave"); await s.page.locator("#ec-name").dispatchEvent("change");
    await s.page.locator("#ec-loop").click(); await tap(s.page, '[data-cc="save"]'); await wait(s.page, 150);
    const saved = (await calls(s.page, "emotesSave")).at(-1); assert.strictEqual(saved.id, "nod_wave"); assert.strictEqual(saved.loop, true); assert.strictEqual(saved.keys.head[0].p, 30);
    await tap(s.page, '[data-cc="export"]'); await wait(s.page, 100); assert.deepStrictEqual((await calls(s.page, "saveFile")).at(-1), "nod_wave.json");
    await tap(s.page, '[data-etab="library"]'); await tap(s.page, '[data-ecat="Custom"]'); assert.deepStrictEqual(await s.page.locator("[data-esel]").evaluateAll((b) => b.map((x) => x.dataset.esel)), ["nod_wave"]);
  });
  test("import refuses broken files and loads valid ones; Edit a copy starts from a built-in", async () => {
    await tap(s.page, '[data-etab="creator"]');
    await s.page.locator("#ec-imp").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from('{"schema":1,"emote":{"id":"x","name":"X","category":"Custom","duration":1,"loop":false,"keys":{"tail":[{"t":0}]}}}') });
    await wait(s.page, 150); assert.match(await s.page.locator(".toast").last().textContent(), /unknown body part "tail"/);
    await tap(s.page, '[data-etab="library"]'); await tap(s.page, '[data-ecat="All"]'); await tap(s.page, '[data-esel="bow"]'); await tap(s.page, '[data-ed="copy"]'); await wait(s.page, 150);
    assert.deepStrictEqual(await s.page.evaluate(() => [ES.tab, ES.draft.id, ES.draft.category, ES.draft.keys.body.length]), ["creator", "bow_copy", "Custom", 4]);
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});
