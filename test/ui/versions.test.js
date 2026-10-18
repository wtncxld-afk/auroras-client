// Changing an existing instance's Minecraft version: keeps the instance (and its folder), warns honestly, saves.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const { launch, wait, nav, tap, calls } = require("./harness");

describe("change version of an instance", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Instances"); await wait(s.page, 200); }); after(() => s.close());
  const inst = () => s.page.evaluate(() => INST.find((i) => i.name === "VexVanilla"));
  test("opens on the version step with the current version marked and Save disabled until something changes", async () => {
    await tap(s.page, '[data-editinst]'); await wait(s.page, 300);
    assert.match(await s.page.locator("#modal h1").textContent(), /Change version: VexVanilla/);
    assert.match(await s.page.locator('#vl .vrow[data-v="1.21.4"]').textContent(), /Current/);
    await tap(s.page, "[data-m=next]"); await wait(s.page, 150); assert.ok(await s.page.locator("[data-m=save]").isDisabled()); assert.match(await s.page.locator("#modal").textContent(), /No change yet/);
    await tap(s.page, "[data-m=back]");
  });
  test("moving to an older version warns about worlds; mods and folder are kept", async () => {
    await tap(s.page, '#vl .vrow[data-v="1.21"]'); await tap(s.page, "[data-m=next]"); await wait(s.page, 150); const t = await s.page.locator("#modal").textContent();
    assert.match(t, /Changing 1\.21\.4 Fabric → 1\.21 Fabric/); assert.match(t, /stay in this instance’s folder/); assert.match(t, /1\.21 is older than 1\.21\.4.*Back them up/s); assert.match(t, /Mods made for 1\.21\.4 may not load/);
    await tap(s.page, "[data-m=back]");
  });
  test("saving updates the same instance and rewrites its settings through the desktop app", async () => {
    const id = (await inst()).id; await tap(s.page, '#vl .vrow[data-v="26.1"]'); await tap(s.page, "[data-m=next]"); await wait(s.page, 150); await tap(s.page, "[data-m=save]"); await wait(s.page, 200);
    const i = await inst(); assert.deepStrictEqual([i.id, i.mc, i.loader, i.loaderVersion], [id, "26.1", "Fabric", "0.17.3"]);
    const p = (await s.page.evaluate(() => window.__prep)).at(-1); assert.strictEqual(p.id, id); assert.strictEqual(p.mc, "26.1");
    assert.match(await s.page.locator(".toast").last().textContent(), /now uses 26\.1 Fabric \(was 1\.21\.4 Fabric\)/);
    assert.strictEqual(await s.page.evaluate(() => INST.length), 2, "no new instance was created");
  });
  test("development builds are offered only under Snapshots & pre-releases, and labelled", async () => {
    await tap(s.page, '[data-editinst]'); await wait(s.page, 300); assert.strictEqual(await s.page.locator('#vl .vrow[data-v="1.21.5-rc1"]').count(), 0);
    await tap(s.page, '[data-m="vfilter"][data-v="dev"]'); await wait(s.page, 300); assert.match(await s.page.locator('#vl .vrow[data-v="1.21.5-rc1"]').textContent(), /Release candidate/);
    await tap(s.page, "[data-m=close]"); assert.deepStrictEqual(s.errors, []);
  });
});
