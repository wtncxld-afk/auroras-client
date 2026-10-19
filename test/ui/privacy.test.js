// Settings > Privacy and security: says how sign-ins are stored, and warns honestly when this PC can't encrypt them.
const { describe, test, before, after } = require("node:test"), assert = require("node:assert");
const { launch, wait, nav } = require("./harness.js");

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
});
