// Stage 3 interface tests: the 3D preview renderer, the registry-driven Modules page, and the Visual, Totem and Cape studios.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const { launch, wait, nav, calls, tap } = require("./harness");
const px = (page, sel, x, y) => page.evaluate(([s, a, b]) => Array.from(document.querySelector(s).getContext("2d").getImageData(a, b, 1, 1).data).slice(0, 3), [sel, x, y]);
const pngB64 = (page, w, h, color) => page.evaluate(([w, h, c]) => { const k = document.createElement("canvas"); k.width = w; k.height = h; const x = k.getContext("2d"); x.fillStyle = c; x.fillRect(0, 0, w, h); return k.toDataURL().split(",")[1]; }, [w, h, color]);
const lastSet = async (page) => (await calls(page, "modcfgUpdate")).at(-1);
const until = async (page, fn, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await page.waitForTimeout(50); } return false; };

describe("3D preview renderer", () => {
  let s; before(async () => { s = await launch(); }); after(() => s.close());
  test("extruded sprites and boxes have the right number of faces", async () => {
    const r = await s.page.evaluate(() => { const P = window.AurorasPreview, tex = (w, h, f) => ({ w, h, data: new Uint8ClampedArray(w * h * 4).map((_, i) => f(i)) });
      return [P.extrudeSprite(tex(2, 1, () => 255)).length, P.extrudeSprite(tex(16, 16, () => 255)).length, P.extrudeSprite(tex(16, 16, (i) => (i % 4 === 3 ? 0 : 255))).length,
        P.player(tex(64, 64, () => 255), { layer: false }).length, P.cape(tex(64, 32, () => 255), 1, 20, 0).length]; });
    assert.deepStrictEqual(r, [10, 576, 0, 1632, 372]);
  });
  test("a lit red box draws red in the middle, background at the corner, and hides its back faces", async () => {
    const r = await s.page.evaluate(() => { const P = window.AurorasPreview, c = document.createElement("canvas"); c.width = c.height = 120; c.id = "pvtest"; document.body.appendChild(c);
      const t = { w: 16, h: 16, data: new Uint8ClampedArray(16 * 16 * 4) }; for (let i = 0; i < 256; i++) t.data.set([220, 30, 30, 255], i * 4);
      const st = P.render(c.getContext("2d"), 120, 120, P.texturedBox(t, -2, -2, -2, 4, 4, 4, 0, 0), { yaw: 0.6, pitch: 0.4, dist: 30, target: [0, 0, 0], fov: 30 }, { light: "studio" });
      return st; });
    const mid = await px(s.page, "#pvtest", 60, 60), corner = await px(s.page, "#pvtest", 2, 2);
    assert.ok(mid[0] > 120 && mid[1] < 60 && mid[2] < 60, "middle is red: " + mid); assert.ok(corner[0] < 60, "corner is background: " + corner);
    assert.strictEqual(r.drawn + r.culled, 96); assert.ok(r.drawn <= 48, "at most three faces visible: " + r.drawn);
  });
  test("nearer faces cover farther ones regardless of order", async () => {
    await s.page.evaluate(() => { const P = window.AurorasPreview, c = document.getElementById("pvtest"), q = (z, col) => P.quad([-5, -5, z, 5, -5, z, 5, 5, z, -5, 5, z], [0, 0, 1], col);
      P.render(c.getContext("2d"), 120, 120, [q(2, 0x00ff00), q(-2, 0x0000ff)], { yaw: 0, pitch: 0, dist: 40, target: [0, 0, 0] }, { light: { dir: [0, 0, 1], ambient: 1, bg: ["#000", "#000"] } }); });
    assert.deepStrictEqual(await px(s.page, "#pvtest", 60, 60), [0, 255, 0]);
  });
});

describe("Modules page", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Modules"); await wait(s.page, 300); }); after(() => s.close());
  test("lists every module from the game's registry; only modules with in-game code can be switched on", async () => {
    const reg = await s.page.evaluate(() => window.AURORAS_REGISTRY.modules.length);
    assert.strictEqual(await s.page.locator(".modcard").count(), reg);
    const avail = await s.page.evaluate(() => window.AURORAS_REGISTRY.modules.filter((m) => m.available).length);
    assert.strictEqual(await s.page.locator(".modcard [data-enable]:not([disabled])").count(), avail);
    assert.strictEqual(await s.page.locator('[data-mid="aura"] [data-enable]').isDisabled(), false);
    assert.match(await s.page.locator('[data-mid="sky"]').textContent(), /In game · experimental/); assert.match(await s.page.locator('[data-mid="glow"]').textContent(), /In game · experimental/); assert.match(await s.page.locator('[data-mid="aura"]').textContent(), /In game · experimental/);
    assert.match(await s.page.locator('[data-mid="zoom"]').textContent(), /Changes controls/); assert.match(await s.page.locator('[data-mid="sky"]').textContent(), /Cosmetic only/);
  });
  test("switching a module on saves it into the instance's settings", async () => {
    await tap(s.page, s.page.locator('[data-enable="fps"]')); await wait(s.page, 100);
    assert.deepStrictEqual((await lastSet(s.page)).set, { "fps.enabled": "true" });
    assert.strictEqual(await s.page.locator('[data-enable="fps"]').getAttribute("aria-checked"), "true");
  });
  test("categories, search, favorites and recently used", async () => {
    await tap(s.page, s.page.locator('[data-c="World & Sky"]')); assert.deepStrictEqual(await s.page.locator(".modcard b").allTextContents(), ["Custom Skies"]);
    await tap(s.page, s.page.locator('[data-c="All"]')); await s.page.locator("#mq-search").fill("totem"); assert.deepStrictEqual(await s.page.locator(".modcard b").allTextContents(), ["Totem Effects"]);
    await s.page.locator("#mq-search").fill(""); await tap(s.page, s.page.locator('[data-fav="sky"]')); await tap(s.page, s.page.locator('[data-c="Favorites"]'));
    assert.deepStrictEqual(await s.page.locator(".modcard b").allTextContents(), ["Custom Skies"]);
    await tap(s.page, s.page.locator('[data-c="Recent"]')); assert.match(await s.page.locator("#mq-list").textContent(), /Nothing opened yet/);
  });
  test("settings dialog: Apply saves validated values, Cancel discards, Reset restores defaults", async () => {
    await tap(s.page, s.page.locator('[data-c="All"]')); await tap(s.page, s.page.locator('[data-cfg="sky"]')); await wait(s.page, 80);
    await s.page.locator("#dmodal #set-sky-theme").selectOption("cosmic"); { const n2 = s.page.locator('#dmodal [data-numfor="set-sky-brightness"]'); await n2.fill("1.4"); await n2.dispatchEvent("change"); }
    await tap(s.page, s.page.locator("#dmodal [data-apply]")); await wait(s.page, 100);
    const set = (await lastSet(s.page)).set; assert.strictEqual(set["sky.theme"], "cosmic"); assert.strictEqual(set["sky.brightness"], "1.4"); assert.ok(!("sky.enabled" in set), "Apply never toggles the module");
    await tap(s.page, s.page.locator('[data-cfg="sky"]')); await s.page.locator("#dmodal #set-sky-theme").selectOption("void"); const n = (await calls(s.page, "modcfgUpdate")).length;
    await tap(s.page, s.page.locator("#dmodal [data-x]")); assert.strictEqual((await calls(s.page, "modcfgUpdate")).length, n, "Cancel saves nothing");
    await tap(s.page, s.page.locator('[data-cfg="sky"]')); assert.strictEqual(await s.page.locator("#dmodal #set-sky-theme").inputValue(), "cosmic");
    await tap(s.page, s.page.locator("#dmodal [data-reset]")); assert.strictEqual(await s.page.locator("#dmodal #set-sky-theme").inputValue(), "aurora");
    await tap(s.page, s.page.locator("#dmodal [data-x]"));
    await tap(s.page, s.page.locator('[data-c="Recent"]')); assert.deepStrictEqual(await s.page.locator(".modcard b").allTextContents(), ["Custom Skies"]);
  });
  test("visual quality preset, new profile, and per-server profiles", async () => {
    await tap(s.page, s.page.locator('[data-c="All"]')); await tap(s.page, s.page.locator('#mq-qseg [data-v="HIGH"]')); await wait(s.page, 80);
    assert.deepStrictEqual((await lastSet(s.page)).set, { "settings.quality": "HIGH" });
    await tap(s.page, s.page.locator("[data-newprof]")); await s.page.locator("#pd-in").fill("../bad"); await tap(s.page, s.page.locator("[data-ok]")); assert.match(await s.page.locator("#pd-err").textContent(), /letters, numbers/);
    await s.page.locator("#pd-in").fill("Arena"); await tap(s.page, s.page.locator("[data-ok]")); await wait(s.page, 120);
    assert.deepStrictEqual(await lastSet(s.page), { id: 1, profile: "Arena", set: {}, activate: true }); assert.strictEqual(await s.page.locator("#mq-prof").inputValue(), "Arena");
    await tap(s.page, s.page.locator("[data-places]")); await s.page.locator("#pl-addr").fill("not a server!"); await tap(s.page, s.page.locator("[data-assign]")); assert.match(await s.page.locator("#pl-err").textContent(), /server address/);
    await s.page.locator("#pl-addr").fill("Play.Example.NET:25565"); await s.page.locator("#pl-prof").selectOption("Competitive"); await tap(s.page, s.page.locator("[data-assign]")); await wait(s.page, 80);
    assert.deepStrictEqual((await calls(s.page, "modcfgAssign")).at(-1), { place: "server:play.example.net", profile: "Competitive" });
    assert.match(await s.page.locator("#dmodal").textContent(), /play\.example\.net/); await tap(s.page, s.page.locator("#dmodal [data-x]"));
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("Visual Studio: skies and particles", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Cosmetics"); await wait(s.page, 500); }); after(() => s.close());
  test("the preview's top row is exactly the game's sky color for that elevation and time", async () => {
    await tap(s.page, s.page.locator('[data-th="midnight"]')); await tap(s.page, s.page.locator('#sky-tk [data-v="6000"]')); await wait(s.page, 700);
    const want = await s.page.evaluate(() => { const V = window.AurorasVisuals, t = SKY_THEMES.midnight, a = (0.32 + 1.15 / 2) / (Math.PI / 2), c = V.skyColor(t, a, 6000, V.NONE); return [c >> 16 & 255, c >> 8 & 255, c & 255]; });
    const got = await px(s.page, "#sky-cv", 20, 0); got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) <= 2, `top row ${got} vs game ${want}`));
    assert.match(await s.page.locator("#sky-tag").textContent(), /Midnight/);
  });
  test("night shows stars; compare and other dimensions are labelled as approximate vanilla", async () => {
    await tap(s.page, s.page.locator('#sky-tk [data-v="18000"]')); await wait(s.page, 250);
    const bright = await s.page.evaluate(() => { const c = document.getElementById("sky-cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height / 3).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 450) n++; return n; });
    assert.ok(bright > 20, "stars visible at night: " + bright);
    await tap(s.page, s.page.locator("#sky-cmp")); await wait(s.page, 150); assert.match(await s.page.locator("#sky-tag").textContent(), /Vanilla \(approximate\) \| Midnight/);
    await tap(s.page, s.page.locator("#sky-cmp")); await tap(s.page, s.page.locator('#sky-dim [data-v="minecraft:the_nether"]')); await wait(s.page, 150);
    assert.match(await s.page.locator("#sky-tag").textContent(), /Vanilla look \(approximate\)/);
    await tap(s.page, s.page.locator('#sky-dim [data-v="minecraft:overworld"]'));
  });
  test("Apply saves the sky settings; the on/off switch is separate and says a restart is needed", async () => {
    await s.page.locator("#sky-set details").evaluateAll((ds) => ds.forEach((d) => (d.open = true))); const num = s.page.locator('#sky-set [data-numfor="set-sky-starDensity"]'); await num.fill("2.5"); await num.dispatchEvent("change");
    await tap(s.page, s.page.locator("#sky-apply")); await wait(s.page, 100);
    const set = (await lastSet(s.page)).set; assert.strictEqual(set["sky.theme"], "midnight"); assert.strictEqual(set["sky.starDensity"], "2.5"); assert.ok(!("sky.enabled" in set));
    await tap(s.page, s.page.locator("#sky-on")); await wait(s.page, 120);
    assert.deepStrictEqual((await lastSet(s.page)).set, { "sky.enabled": "true" }); assert.match(await s.page.locator(".toast").textContent(), /Restart the game/);
  });
  test("Cancel returns to the saved values, Reset to defaults", async () => {
    await tap(s.page, s.page.locator('[data-th="sunset"]')); await tap(s.page, s.page.locator("#sky-cancel")); await wait(s.page, 100);
    assert.strictEqual(await s.page.locator('[data-th="midnight"]').getAttribute("aria-pressed"), "true");
    await tap(s.page, s.page.locator("#sky-reset")); await wait(s.page, 100); assert.strictEqual(await s.page.locator('[data-th="aurora"]').getAttribute("aria-pressed"), "true");
  });
  test("particles: the live pool respects its budget, bursts on events, and Apply saves", async () => {
    await tap(s.page, s.page.locator('[data-tab="particles"]')); await wait(s.page, 900);
    const tag = await s.page.locator("#px-tag").textContent(), m = tag.match(/(\d+) \/ (\d+) particles/); assert.ok(m && +m[1] > 0 && +m[1] <= +m[2], tag);
    const before_ = +m[1]; await tap(s.page, s.page.locator("#px-burst")); await wait(s.page, 250); const after_ = +(await s.page.locator("#px-tag").textContent()).match(/(\d+) \//)[1];
    assert.ok(after_ > before_, `burst ${before_} -> ${after_}`);
    await tap(s.page, s.page.locator('[data-style="sakura"]')); await tap(s.page, s.page.locator("#px-apply")); await wait(s.page, 100);
    const set = (await lastSet(s.page)).set; assert.strictEqual(set["particlefx.style"], "sakura"); assert.strictEqual(set["particlefx.maxCount"], "256");
    assert.match(await s.page.locator(".page").textContent(), /Only you see them/);
  });
  test("the Play bar stays pinned to the bottom of the window while the page scrolls", async () => {
    await s.page.evaluate(() => { const m = document.getElementById("main"); m.scrollTop = m.scrollHeight; }); await wait(s.page, 100);
    const b = await s.page.locator(".bar").boundingBox(); assert.ok(Math.abs(b.y + b.height - (800 - 16)) <= 2, "bar bottom at " + (b.y + b.height));
    await s.page.evaluate(() => { document.getElementById("main").scrollTop = 0; });
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("Totem Studio", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Totem Studio"); await wait(s.page, 500); }); after(() => s.close());
  const center = () => px(s.page, "#ts-cv", 0, 0).then(async () => s.page.evaluate(() => { const c = document.getElementById("ts-cv"), x = c.getContext("2d"), d = x.getImageData(c.width / 2 - 30, c.height / 2 - 30, 60, 60).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 200) n++; return n; }));
  test("opens with the real Minecraft totem (read from the player's game) and shows it in 3D", async () => {
    assert.ok(await s.page.evaluate(() => T.g.filter(Boolean).length === 96 && T.g[2 * 16 + 4] === "#e0b030" && T.g[0] === null), "the 16x16 texture's pixels, see-through where it is");
    assert.deepStrictEqual((await calls(s.page, "vanillaTexture"))[0], { mc: "1.21.4", path: "assets/minecraft/textures/item/totem_of_undying.png" }); assert.ok((await center()) > 200, "3D totem drawn"); assert.match(await s.page.locator("#ts-tag").textContent(), /3D item preview/);
  });
  test("built-in presets load into the editor, with undo", async () => {
    await tap(s.page, s.page.locator("summary", { hasText: "Presets" })); await tap(s.page, s.page.locator('[data-bp="classic"]'));
    assert.ok(await s.page.evaluate(() => JSON.stringify(T.g) === JSON.stringify(builtinPixels("classic"))));
    await tap(s.page, s.page.locator('[data-t="undo"]')); assert.ok(await s.page.evaluate(() => JSON.stringify(T.g) === JSON.stringify(builtinPixels("real"))));
    await tap(s.page, s.page.locator('[data-bp="classic"]')); await tap(s.page, s.page.locator('[data-bp="real"]')); assert.ok(await s.page.evaluate(() => T.g[2 * 16 + 4] === "#e0b030"), "Real totem preset loads it back");
  });
  test("save, rename, duplicate and delete presets; they persist", async () => {
    await tap(s.page, s.page.locator("#ts-save")); await s.page.locator("#pd-in").fill("Mine"); await tap(s.page, s.page.locator("[data-ok]"));
    await tap(s.page, s.page.locator("#ts-save")); await s.page.locator("#pd-in").fill("mine"); await tap(s.page, s.page.locator("[data-ok]")); assert.match(await s.page.locator("#pd-err").textContent(), /already exists/); await tap(s.page, s.page.locator("#dmodal [data-x]"));
    const id = await s.page.evaluate(() => presets()[0].id);
    await tap(s.page, s.page.locator(`[data-pren="${id}"]`)); await s.page.locator("#pd-in").fill("Glacier"); await tap(s.page, s.page.locator("[data-ok]"));
    await tap(s.page, s.page.locator(`[data-pdup="${id}"]`)); assert.deepStrictEqual(await s.page.evaluate(() => presets().map((p) => p.name)), ["Glacier", "Glacier copy"]);
    const dup = await s.page.evaluate(() => presets()[1].id); await tap(s.page, s.page.locator(`[data-pdel="${dup}"]`)); await tap(s.page, s.page.locator("#dmodal [data-ok]"));
    await s.page.reload(); await wait(s.page, 300); await nav(s.page, "Totem Studio"); await wait(s.page, 200);
    assert.deepStrictEqual(await s.page.evaluate(() => presets().map((p) => p.name)), ["Glacier"]);
  });
  test("import: Auroras presets and 16x16 PNGs are accepted; everything else is refused with a reason", async () => {
    await tap(s.page, s.page.locator("summary", { hasText: "Presets" }));
    const good = JSON.stringify({ type: "auroras-totem", version: 1, name: "Shared", pixels: Array(256).fill("#00ff00") });
    await s.page.locator("#ts-imp").setInputFiles({ name: "shared.json", mimeType: "application/json", buffer: Buffer.from(good) }); await wait(s.page, 150);
    assert.ok((await s.page.evaluate(() => presets().map((p) => p.name))).includes("Shared"));
    await s.page.locator("#ts-imp").setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"type":"auroras-totem","version":1,"name":"x","pixels":["red"]}') }); await wait(s.page, 150);
    assert.match(await s.page.locator("#ts-perr").textContent(), /isn’t an Auroras totem preset/);
    await s.page.locator("#ts-imp").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.from(await pngB64(s.page, 32, 32, "#f00"), "base64") }); await wait(s.page, 200);
    assert.match(await s.page.locator("#ts-perr").textContent(), /16×16 textures\. This image is 32×32/);
    await s.page.locator("#ts-imp").setInputFiles({ name: "t.png", mimeType: "image/png", buffer: Buffer.from(await pngB64(s.page, 16, 16, "#123456"), "base64") }); await wait(s.page, 200);
    assert.ok(await s.page.evaluate(() => T.g.every((c) => c === "#123456")));
  });
  test("with no game downloaded yet (never signed in), Real totem downloads Minecraft's game file from Mojang and loads the totem", async () => {
    const t = await launch(); try {
      await t.page.evaluate(() => { window.__noGame = true; localStorage.setItem("totemTouched", "true"); }); await nav(t.page, "Totem Studio"); await wait(t.page, 400);
      await tap(t.page, t.page.locator("summary", { hasText: "Presets" }));
      assert.match(await t.page.locator("#ts-realnote").textContent(), /download Minecraft 1\.21\.4’s game file from Mojang/);
      await tap(t.page, t.page.locator('[data-bp="real"]')); await wait(t.page, 400);
      assert.deepStrictEqual((await calls(t.page, "vanillaFetch")).at(-1), { mc: "1.21.4" });
      assert.ok(await t.page.evaluate(() => T.g[2 * 16 + 4] === "#e0b030")); assert.strictEqual(await t.page.locator("#ts-realnote").count(), 0);
    } finally { await t.close(); }
  });
  test("vanilla comparison reads from the player's own game files and says so", async () => {
    await tap(s.page, s.page.locator("#ts-cmp")); await wait(s.page, 300);
    assert.deepStrictEqual((await calls(s.page, "vanillaTexture")).at(-1), { mc: "1.21.4", path: "assets/minecraft/textures/item/totem_of_undying.png" });
    assert.match(await s.page.locator("#ts-cmpnote").textContent(), /your own copy of Minecraft 1\.21\.4 \(never bundled/); assert.match(await s.page.locator("#ts-tag").textContent(), /Vanilla {2}\| {2}Yours/);
    await tap(s.page, s.page.locator("#ts-cmp"));
  });
  test("activation preview runs, is labelled as an approximation, and ends", async () => {
    await tap(s.page, s.page.locator("#ts-play")); await wait(s.page, 400); assert.match(await s.page.locator("#ts-tag").textContent(), /approximation of Minecraft’s animation/);
    await wait(s.page, 2600); assert.doesNotMatch(await s.page.locator("#ts-tag").textContent(), /Activation/);
  });
  test("effect settings save; resource pack and PNG export still work", async () => {
    await tap(s.page, s.page.locator("summary", { hasText: "In-game effects" })); await tap(s.page, s.page.locator("#ts-fxapply")); await wait(s.page, 100);
    assert.ok(Object.keys((await lastSet(s.page)).set).every((k) => k.startsWith("totemfx.")) && !("totemfx.enabled" in (await lastSet(s.page)).set));
    await tap(s.page, s.page.locator('[data-t="png"]')); assert.ok(await until(s.page, async () => (await calls(s.page, "saveFile")).includes("totem_of_undying.png")));
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("Cape Studio", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Capes"); await wait(s.page, 700); }); after(() => s.close());
  test("draws the player and cape, and says capes are local only", async () => {
    assert.ok(+(await s.page.locator("#cs-cv").getAttribute("data-drawn")) > 300); assert.match(await s.page.locator(".page").textContent(), /other players never see these capes/);
  });
  test("Use in game writes the selected cape for this instance and turns the cape on; Stop removes it", async () => {
    await tap(s.page, s.page.locator('[data-cd="sakura"]')); await tap(s.page, s.page.locator("#cs-gameon"));
    assert.ok(await until(s.page, async () => (await calls(s.page, "capeWrite")).length === 1));
    assert.deepStrictEqual((await lastSet(s.page)).set, { "cape.enabled": "true", "cape.design": "sakura" });
    assert.match(await s.page.locator("#cs-game").textContent(), /Only you see it/);
    await tap(s.page, s.page.locator("#cs-gameoff")); assert.ok(await until(s.page, async () => (await calls(s.page, "capeClear")).length === 1));
    assert.deepStrictEqual((await lastSet(s.page)).set, { "cape.enabled": "false" }); assert.strictEqual(await s.page.locator("#cs-gameoff").count(), 0);
  });
  test("cape motion uses Minecraft's numbers: a walk flaps a few degrees at about 2 to 3 swings a second, not a jitter", async () => {
    await wait(s.page, 600); const xs = []; for (let k = 0; k < 40; k++) { xs.push(await s.page.evaluate(() => CS.st.cur.swing)); await s.page.waitForTimeout(25); }
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length, spread = Math.max(...xs) - Math.min(...xs);
    assert.ok(mean > 25 && mean < 50, "walking lifts the cape: " + mean); assert.ok(spread < 12, "the walk flap stays small (vanilla: 3.2°): " + spread);
  });
  test("speed slider: labelled pace, filled track, and the limbs swing at a walking rhythm", async () => {
    const r = s.page.locator("#cs-stride"); await r.evaluate((el) => { el.value = "1"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    assert.strictEqual(await s.page.locator("#cs-pace").textContent(), "Sprinting"); assert.strictEqual(await r.evaluate((el) => el.style.getPropertyValue("--fill")), "100.0%");
    // simulate 40 ticks (2 s) off-screen and count arm swing direction changes: vanilla sprint is about 2 steps per second
    const flips = await s.page.evaluate(() => { const keep = { pos: CS.pos, phase: CS.phase, st: JSON.parse(JSON.stringify(CS.st)) }; let n = 0, prev = null;
      for (let k = 0; k < 40; k++) { capeTick(); const a = CS.st.cur.arm; if (prev != null && Math.sign(a) !== Math.sign(prev) && Math.abs(a) > 0.01) n++; prev = a; } Object.assign(CS, { pos: keep.pos, phase: keep.phase, st: keep.st }); return n; });
    assert.ok(flips >= 4 && flips <= 12, "arm swings change direction " + flips + " times in 2 s");
    await r.evaluate((el) => { el.value = "0.77"; el.dispatchEvent(new Event("input", { bubbles: true })); }); assert.strictEqual(await s.page.locator("#cs-pace").textContent(), "Walking");
  });
  test("sneaking uses Minecraft's crouch pose and eases into it; the cape follows the body", async () => {
    await tap(s.page, s.page.locator("#cs-sneak")); await wait(s.page, 70); const mid = await s.page.evaluate(() => CS.st.cur.crouch);
    await wait(s.page, 500); const full = await s.page.evaluate(() => CS.st.cur.crouch); assert.ok(mid > 0 && mid <= 1 && full === 1, "eases in: " + mid + " then " + full);
    const pose = await s.page.evaluate(() => { const t = { w: 64, h: 64, data: new Uint8ClampedArray(64 * 64 * 4).fill(255) }, top = (q) => Math.max(...q.flatMap((x) => [x.p[1], x.p[4], x.p[7], x.p[10]]));
      return { stand: top(PV.player(t, { layer: false })), crouch: top(PV.player(t, { layer: false, crouch: 1 })), capeStand: top(PV.cape({ w: 64, h: 32, data: t.data }, 1, 6, 0)), capeCrouch: top(PV.cape({ w: 64, h: 32, data: t.data }, 1, 6, 0, 1)) }; });
    assert.ok(Math.abs(pose.stand - pose.crouch - 6.2) < 0.01, "head drops 6.2 px when crouched (4.2 + 2): " + (pose.stand - pose.crouch));
    const drop = pose.capeStand - pose.capeCrouch; assert.ok(drop > 3 && drop < 5.3, "the cape drops with the body (5.2 px, less the lift from the 0.5 rad tilt): " + drop);
    await tap(s.page, s.page.locator("#cs-sneak")); await wait(s.page, 500); assert.strictEqual(await s.page.evaluate(() => CS.st.cur.crouch), 0);
  });
  test("cape motion: walking lifts it, standing still lets it settle, sneaking adds tilt", async () => {
    await wait(s.page, 800); const walking = await s.page.evaluate(() => CS.sim.swing); assert.ok(walking > 12, "walking swing " + walking);
    await tap(s.page, s.page.locator("#cs-walk")); await wait(s.page, 1500); const still = await s.page.evaluate(() => CS.sim.swing); assert.ok(Math.abs(still - 6) < 1, "settles near 6: " + still);
    await tap(s.page, s.page.locator("#cs-sneak")); await wait(s.page, 300); assert.ok(Math.abs((await s.page.evaluate(() => CS.sim.swing)) - 31) < 1);
    await tap(s.page, s.page.locator("#cs-sneak")); await tap(s.page, s.page.locator("#cs-walk"));
  });
  test("picking a design remembers it and saves the choice for the instance", async () => {
    await tap(s.page, s.page.locator('[data-cd="cosmic"]')); await wait(s.page, 100);
    assert.deepStrictEqual((await lastSet(s.page)).set, { "cape.design": "cosmic" }); assert.strictEqual(await s.page.evaluate(() => JSON.parse(localStorage.getItem("capeDesign"))), "cosmic");
  });
  test("make, import, favorite and export designs; wrong image sizes are refused", async () => {
    await tap(s.page, s.page.locator('[data-cstab="make"]')); await tap(s.page, s.page.locator("summary", { hasText: "Fill from a pattern" })); await s.page.locator("#cg-p").selectOption("stars"); await tap(s.page, s.page.locator("#cg-save")); await s.page.locator("#pd-in").fill("Starry"); await tap(s.page, s.page.locator("[data-ok]")); await wait(s.page, 200);
    assert.ok((await s.page.locator("#cs-grid").textContent()).includes("Starry"));
    await s.page.locator("#cs-imp").setInputFiles({ name: "square.png", mimeType: "image/png", buffer: Buffer.from(await pngB64(s.page, 64, 64, "#f00"), "base64") }); await wait(s.page, 200);
    assert.match(await s.page.locator("#cs-err").textContent(), /must be 64x32.*64x64/);
    await s.page.locator("#cs-imp").setInputFiles({ name: "hd.png", mimeType: "image/png", buffer: Buffer.from(await pngB64(s.page, 128, 64, "#0f0"), "base64") }); await wait(s.page, 300);
    assert.ok((await s.page.locator("#cs-grid").textContent()).includes("hd"));
    await tap(s.page, s.page.locator('[data-cstab="lib"]'));
    await tap(s.page, s.page.locator('[data-cfav="void"]')); assert.strictEqual(await s.page.locator("#cs-grid .capecard").first().textContent().then((t) => t.includes("Endless Void")), true);
    await tap(s.page, s.page.locator("#cs-exp")); assert.ok(await until(s.page, async () => (await calls(s.page, "saveFile")).some((f) => /^cape-.*\.png$/.test(f))));
  });
  test("OptiFine capes (46x22 and HD multiples) are converted to the game's 64x32 layout; several files upload at once", async () => {
    const before = await s.page.evaluate(() => CS.mine.length);
    await s.page.locator("#cs-imp").setInputFiles([{ name: "of.png", mimeType: "image/png", buffer: Buffer.from(await pngB64(s.page, 46, 22, "#f0f"), "base64") }, { name: "of-hd.png", mimeType: "image/png", buffer: Buffer.from(await pngB64(s.page, 92, 44, "#0ff"), "base64") }]); await wait(s.page, 400);
    assert.strictEqual(await s.page.evaluate(() => CS.mine.length), before + 2); assert.strictEqual(await s.page.locator("#cs-err").textContent(), "");
    const sizes = await s.page.evaluate(() => CS.mine.slice(-2).map((d) => [CS.imgCache[d.id].width, CS.imgCache[d.id].height])); assert.deepStrictEqual(sizes, [[64, 32], [128, 64]]);
  });
  test("big capes are scaled to 512x256, the largest the game shows", async () => {
    await s.page.locator("#cs-imp").setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.from(await pngB64(s.page, 2048, 1024, "#00f"), "base64") }); await wait(s.page, 500);
    assert.deepStrictEqual(await s.page.evaluate(() => { const d = CS.mine.at(-1); return [d.name, CS.imgCache[d.id].width, CS.imgCache[d.id].height]; }), ["huge", 512, 256]);
  });
  test("editor: painting changes the cape and the 3D preview at once, mirror paints both halves, undo restores", async () => {
    await tap(s.page, s.page.locator('[data-cd="midnight"]')); await tap(s.page, s.page.locator('[data-cstab="make"]')); await wait(s.page, 150);
    await s.page.locator("#ce-col").evaluate((el) => { el.value = "#ff0000"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await tap(s.page, s.page.locator("#ce-mirror")); const box = await s.page.locator("#ce-cv").boundingBox(), z = box.width / 22;
    await s.page.mouse.click(box.x + 2.5 * z, box.y + 5.5 * z); await wait(s.page, 80);
    const px = (x, y) => s.page.evaluate(([x, y]) => [...CE.cv.getContext("2d").getImageData(x, y, 1, 1).data], [x, y]);
    assert.deepStrictEqual(await px(2, 5), [255, 0, 0, 255]); assert.deepStrictEqual(await px(9, 5), [255, 0, 0, 255], "mirrored across the outside face");
    assert.ok(await s.page.evaluate(() => CS.previewing && CS.img.data[(5 * 64 + 2) * 4] === 255), "the 3D preview shows the edit");
    await tap(s.page, s.page.locator('[data-ceact="undo"]')); assert.notDeepStrictEqual(await px(2, 5), [255, 0, 0, 255]);
    await tap(s.page, s.page.locator("#ce-mirror")); await tap(s.page, s.page.locator('[data-cstab="lib"]'));
  });
  test("the library survives a restart", async () => {
    const names = await s.page.evaluate(() => CS.mine.map((d) => d.name)); await s.page.reload(); await wait(s.page, 300); await nav(s.page, "Capes"); await wait(s.page, 500);
    assert.deepStrictEqual(await s.page.evaluate(() => CS.mine.map((d) => d.name)), names); assert.ok(names.includes("Starry"));
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});
