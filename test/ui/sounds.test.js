// Click sounds (Settings > Sounds) and the extra built-in capes with the SkinMC link.
const { describe, test, before, after } = require("node:test"), assert = require("node:assert");
const { launch, wait, nav, tap, calls } = require("./harness.js");

describe("Click sounds and more capes", () => {
  let s;
  before(async () => { s = await launch(); await s.page.evaluate(() => { window.__snd = []; const real = SFX.play; SFX.play = (k, st) => { window.__snd.push([k, st || CFG.snd.style, CFG.snd.on]); if (CFG.snd.on || st) real(k, st); }; }); });
  after(() => s.close());
  const sounds = () => s.page.evaluate(() => window.__snd.splice(0));
  test("clicking buttons makes a sound; switches go up when on and down when off", async () => {
    await nav(s.page, "Settings"); await wait(s.page, 200); await sounds();
    await tap(s.page, '[data-checkupd]'); await wait(s.page, 50); assert.deepStrictEqual((await sounds())[0].slice(0, 2), ["click", "soft"]);
    await tap(s.page, '[data-cfgt="snd.hover"]'); await wait(s.page, 50); assert.strictEqual((await sounds())[0][0], "on");
    await tap(s.page, '[data-cfgt="snd.hover"]'); await wait(s.page, 50); assert.strictEqual((await sounds())[0][0], "off");
  });
  test("picking a style previews it; the choice is saved", async () => {
    await tap(s.page, '[data-cfgv="snd.style:glass"]'); await wait(s.page, 80);
    assert.deepStrictEqual((await sounds()).map((x) => x.slice(0, 2)), [["click", "glass"]]);
    assert.strictEqual(await s.page.evaluate(() => JSON.parse(localStorage.getItem("cfg")).snd.style), "glass");
    await tap(s.page, '[data-checkupd]'); await wait(s.page, 50); assert.strictEqual((await sounds())[0][1], "glass");
  });
  test("every style plays through Web Audio without errors", async () => {
    const errs = await s.page.evaluate(async () => { const out = []; for (const k of Object.keys(SFX.STYLES)) try { SFX.play("click", k); SFX.play("on", k); } catch (e) { out.push(k + ": " + e.message); } await new Promise((r) => setTimeout(r, 300)); return out; });
    assert.deepStrictEqual(errs, []); assert.strictEqual(await s.page.evaluate(() => Object.keys(SFX.STYLES).length), 6);
  });
  test("turning click sounds off silences them", async () => {
    await tap(s.page, '[data-cfgt="snd.on"]'); await wait(s.page, 50); await sounds();
    await tap(s.page, '[data-checkupd]'); await wait(s.page, 50); const after = await sounds();
    assert.ok(after.every((x) => x[2] === false), "nothing plays while off");
    await tap(s.page, '[data-cfgt="snd.on"]'); await wait(s.page, 50);
  });
  test("eight new original capes in the library, and a SkinMC link", async () => {
    await nav(s.page, "Capes"); await wait(s.page, 300);
    const names = await s.page.locator("#cs-grid .capecard .nm").allTextContents();
    for (const n of ["Ember", "Synthwave", "Frost", "Toxic", "Royal", "Storm", "Checkmate", "Rose"]) assert.ok(names.includes(n), n);
    const lit = await s.page.evaluate(() => ["ember", "rose", "checker"].map((id) => { const c = capeCanvas(id), d = c.getContext("2d").getImageData(1, 1, 10, 16).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) set.add(d[i] + "," + d[i + 1] + "," + d[i + 2]); return set.size; }));
    assert.ok(lit.every((n) => n >= 3), "each design draws a real pattern: " + lit);
    await tap(s.page, "#cs-skinmc"); await wait(s.page, 50); assert.strictEqual((await calls(s.page, "open")).at(-1), "https://www.skinmc.net/capes");
  });
});

describe("Auto-update pop-up", () => {
  let s; before(async () => { s = await launch(); }); after(() => s.close());
  test("asks to restart when an update is ready; Restart runs the installer, Later hides it", async () => {
    await s.page.evaluate(() => { window.__inst = 0; window.auroras.updateInstall = async () => { window.__inst++; return true; }; showUpdReady({ version: "0.2.0", notes: "Halloween backgrounds" }); });
    await wait(s.page, 100); const txt = await s.page.locator("#updmodal").textContent();
    assert.match(txt, /Update ready/); assert.match(txt, /0\.2\.0 is downloaded and checked/); assert.match(txt, /Restart now/);
    await tap(s.page, "[data-updnow]"); await wait(s.page, 50); assert.strictEqual(await s.page.evaluate(() => window.__inst), 1);
    assert.match(await s.page.locator("#updmodal").textContent(), /reopens by itself/);
    await s.page.evaluate(() => document.getElementById("updmodal").remove());
    await s.page.evaluate(() => { window.auroras.updateInstall = async () => { throw new Error("Close Minecraft first, then restart to update."); }; showUpdReady({ version: "0.2.0" }); });
    await tap(s.page, "[data-updnow]"); await wait(s.page, 50); assert.match(await s.page.locator("#upd-err").textContent(), /Close Minecraft first/);
    await tap(s.page, "[data-updlater]"); await wait(s.page, 50); assert.strictEqual(await s.page.locator("#updmodal").count(), 0);
  });
});
