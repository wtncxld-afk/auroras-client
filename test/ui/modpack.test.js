// Import modpack: from a .mrpack file and from Modrinth search, into a new instance, with progress and honest errors.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const { launch, wait, nav, tap, calls } = require("./harness");

describe("import a Modrinth modpack", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Instances"); await wait(s.page, 150); }); after(() => s.close());
  const dlg = () => s.page.locator("#pkmodal");
  test("Import modpack sits next to Create instance on the Instances page and in the instance switcher", async () => {
    assert.strictEqual(await s.page.locator(".head [data-import]").count(), 1);
    assert.match(await s.page.locator(".head [data-import]").textContent(), /Import modpack/);
    await tap(s.page, ".bar [data-sw]"); await wait(s.page, 100);
    assert.strictEqual(await s.page.locator(".pop [data-import]").count(), 1);
    await tap(s.page, ".pop [data-import]"); await wait(s.page, 150);
    assert.ok(await dlg().isVisible()); assert.strictEqual(await s.page.locator(".pop").count(), 0, "switcher closed");
    await s.page.keyboard.press("Escape"); await wait(s.page, 80); assert.strictEqual(await dlg().count(), 0, "Escape closes it");
  });
  test("from a file: preview shows the pack, then Import makes a selected instance with the pack's version and loader", async () => {
    await tap(s.page, ".head [data-import]"); await wait(s.page, 120);
    assert.match(await dlg().textContent(), /Choose a \.mrpack file/);
    await tap(s.page, '[data-pk="pick"]'); await wait(s.page, 120);
    const t = await dlg().textContent();
    assert.match(t, /Aurora Pack/); assert.match(t, /Version 1\.2\.0 · Minecraft 1\.21\.4 · Fabric 0\.16\.10/); assert.match(t, /2\s*mods/); assert.match(t, /3\s*files to download/); assert.match(t, /5\.0 MB/);
    assert.match(t, /1 server-only file is skipped/); assert.strictEqual(await s.page.locator("#pkn").inputValue(), "Aurora Pack");
    const before = await s.page.evaluate(() => INST.length);
    await tap(s.page, '[data-pk="import"]'); await wait(s.page, 60);
    assert.ok(await s.page.locator('#pkmodal [role="progressbar"]').isVisible(), "progress while installing");
    await wait(s.page, 300);
    assert.strictEqual(await dlg().count(), 0);
    const i = await s.page.evaluate(() => INST[0]);
    assert.deepStrictEqual([i.name, i.mc, i.loader, i.loaderVersion, i.pack.name], ["Aurora Pack", "1.21.4", "Fabric", "0.16.10", "Aurora Pack"]);
    assert.strictEqual(await s.page.evaluate(() => INST.length), before + 1); assert.strictEqual(await s.page.evaluate(() => S.inst), i.id);
    const inst = (await calls(s.page, "modpackInstall")).at(-1); assert.deepStrictEqual([inst.token, inst.inst.name, inst.inst.id], ["tokfile", "Aurora Pack", i.id]);
    assert.match(await s.page.locator(".icard.on").textContent(), /Aurora Pack 1\.2\.0/);
    assert.match(await s.page.locator(".toast").last().textContent(), /Imported “Aurora Pack”/);
  });
  test("names stay unique, and an empty or taken name is refused", async () => {
    await tap(s.page, ".head [data-import]"); await wait(s.page, 100); await tap(s.page, '[data-pk="pick"]'); await wait(s.page, 120);
    assert.strictEqual(await s.page.locator("#pkn").inputValue(), "Aurora Pack (2)");
    await s.page.locator("#pkn").fill("aurora pack"); await tap(s.page, '[data-pk="import"]'); await wait(s.page, 80);
    assert.match(await s.page.locator("#pkmodal .err").textContent(), /already exists/);
    await s.page.locator("#pkn").fill("  "); await tap(s.page, '[data-pk="import"]'); await wait(s.page, 80);
    assert.match(await s.page.locator("#pkmodal .err").textContent(), /Give the instance a name/);
    await tap(s.page, '[data-pk="back"]'); await wait(s.page, 80);
    assert.deepStrictEqual((await calls(s.page, "modpackDiscard")).at(-1), "tokfile", "going back releases the opened pack");
    await tap(s.page, '#pkmodal [data-pk="close"]');
  });
  test("a failed install shows the reason in the dialog and adds no instance", async () => {
    await s.page.evaluate(() => { window.__mpInstallErr = "Error invoking remote method 'modpack:install': Error: Checksum mismatch for mods/sodium.jar"; });
    const n = await s.page.evaluate(() => INST.length);
    await tap(s.page, ".head [data-import]"); await wait(s.page, 100); await tap(s.page, '[data-pk="pick"]'); await wait(s.page, 100); await tap(s.page, '[data-pk="import"]'); await wait(s.page, 350);
    assert.match(await s.page.locator("#pkmodal .err").textContent(), /^Checksum mismatch for mods\/sodium\.jar$/);
    assert.strictEqual(await s.page.evaluate(() => INST.length), n);
    await s.page.evaluate(() => { window.__mpInstallErr = null; }); await tap(s.page, '#pkmodal [data-pk="close"]');
  });
  test("Browse Modrinth searches modpacks only, downloads the chosen one, and warns about loaders Auroras can't launch", async () => {
    await tap(s.page, ".head [data-import]"); await wait(s.page, 100);
    await tap(s.page, '#pktab [data-v="modrinth"]'); await wait(s.page, 200);
    const url = decodeURIComponent((await calls(s.page, "http")).at(-1)); assert.match(url, /api\.modrinth\.com\/v2\/search/); assert.match(url, /project_type:modpack/);
    assert.strictEqual(await s.page.locator("#pkl .pk-row").count(), 2); assert.match(await s.page.locator("#pkl").textContent(), /Fabulously Optimized.*9M downloads/s);
    await tap(s.page, '#pkl [data-pk="get"][data-v="PACK2"]'); await wait(s.page, 200);
    assert.deepStrictEqual((await calls(s.page, "modpackFetch")).at(-1), { project: "PACK2" });
    const t = await dlg().textContent(); assert.match(t, /Neo Pack/); assert.match(t, /NeoForge 21\.1\.77/); assert.match(t, /can be imported but not launched/);
    await tap(s.page, '[data-pk="import"]'); await wait(s.page, 350);
    const i = await s.page.evaluate(() => INST[0]); assert.deepStrictEqual([i.name, i.mc, i.loader], ["Neo Pack", "1.21.1", "NeoForge"]);
  });
  test("the dialog fits a narrow window and nothing threw", async () => {
    await s.page.setViewportSize({ width: 900, height: 600 });
    await tap(s.page, ".head [data-import]"); await wait(s.page, 100);
    assert.strictEqual(await s.page.locator('#pktab [aria-checked="true"]').getAttribute("data-v"), "modrinth", "the last tab used is remembered");
    await tap(s.page, '#pktab [data-v="file"]'); await wait(s.page, 80); await tap(s.page, '[data-pk="pick"]'); await wait(s.page, 100);
    const box = await s.page.locator(".pk-dlg").boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 900 && box.y >= 0 && box.y + box.height <= 600, JSON.stringify(box));
    await tap(s.page, '#pkmodal [data-pk="close"]');
    assert.deepStrictEqual(s.errors, []);
  });
});
