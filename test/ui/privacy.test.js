// Settings > Privacy and security: says how sign-ins are stored, and warns honestly when this PC can't encrypt them.
const { describe, test, before, after } = require("node:test"), assert = require("node:assert");
const { launch, wait, nav, calls } = require("./harness.js");

describe("Privacy and security", () => {
  let s; before(async () => { s = await launch(); }); after(() => s.close());
  test("lists what is protected and how", async () => {
    await nav(s.page, "Settings"); await wait(s.page, 250);
    const t = await s.page.locator(".privacy").textContent();
    assert.match(t, /encrypted by your computer/); assert.match(t, /password never reaches Auroras/); assert.match(t, /No analytics, no tracking/); assert.match(t, /stay on this PC/);
    assert.strictEqual(await s.page.locator(".privacy .privrow.warn").count(), 0);
  });
  test("when the OS can't encrypt, says sign-ins stay in memory only", async () => {
    await s.page.evaluate(() => { const o = window.auroras.settingsAll; window.auroras.settingsAll = async () => ({ ...(await o()), secureStorage: false }); });
    await nav(s.page, "Home"); await nav(s.page, "Settings"); await wait(s.page, 250);
    assert.match(await s.page.locator("#priv-store").textContent(), /can’t encrypt/);
    assert.match(await s.page.locator("#priv-store-sub").textContent(), /memory only and never writes them to disk/);
    assert.strictEqual(await s.page.locator(".privacy .privrow.warn").count(), 1);
  });
  test("Discord: 'Show what I'm playing' is on by default, the idle line is off, and both save", async () => {
    await s.page.evaluate(() => { window.auroras.settingsAll = async () => ({ version: "0.1.0", discordPresence: true, discordIdle: false, discordClientId: "", discordShipped: true }); });
    await nav(s.page, "Home"); await nav(s.page, "Settings"); await wait(s.page, 250);
    assert.strictEqual(await s.page.locator("#dcpres").getAttribute("aria-checked"), "true");
    assert.strictEqual(await s.page.locator("#dcidle").getAttribute("aria-checked"), "false");
    assert.strictEqual(await s.page.locator("#dcnote").textContent(), "");
    await s.page.click("#dcpres"); await wait(s.page, 80); await s.page.click("#dcidle"); await wait(s.page, 80);
    assert.deepStrictEqual((await calls(s.page, "setSettings")).filter((o) => "discordPresence" in o || "discordIdle" in o), [{ discordPresence: false }, { discordIdle: true }]);
    assert.strictEqual(await s.page.locator("#dcpres").getAttribute("aria-checked"), "false");
    await s.page.locator("#dcmore summary").click(); await s.page.fill("#dcid", "12345"); await s.page.click("[data-dcsave]"); await wait(s.page, 80);
    assert.match(await s.page.locator("#dcres").textContent(), /17 to 20 digits/);
    await s.page.fill("#dcid", "123456789012345678"); await s.page.click("[data-dcsave]"); await wait(s.page, 80);
    assert.deepStrictEqual((await calls(s.page, "setSettings")).filter((o) => "discordClientId" in o), [{ discordClientId: "123456789012345678" }]);
  });
  test("Discord: says presence is off when the owner's Discord app ID hasn't been set", async () => {
    await s.page.evaluate(() => { window.auroras.settingsAll = async () => ({ version: "0.1.0", discordClientId: "", discordShipped: false }); });
    await nav(s.page, "Home"); await nav(s.page, "Settings"); await wait(s.page, 250);
    assert.match(await s.page.locator("#dcnote").textContent(), /owner’s Discord app ID hasn’t been set/);
  });
});
