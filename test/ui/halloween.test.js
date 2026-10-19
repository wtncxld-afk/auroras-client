// Halloween backgrounds: each scene can be picked, animates on the Home page without script errors and draws a full picture.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const { launch, wait, nav } = require("./harness");

describe("halloween backgrounds", () => {
  let s; before(async () => { s = await launch(); }); after(() => s.close());
  // Reads the live background canvas: share of opaque pixels, how many distinct colours, and whether it changes over time.
  const sample = () => s.page.evaluate(() => { const c = document.getElementById("bg"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, cols = new Set(); let opaque = 0, n = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4 * 37) { n++; if (d[i + 3] > 0) opaque++; cols.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4)); sum += d[i] + d[i + 1] * 3 + d[i + 2]; }
    return { opaque: opaque / n, colours: cols.size, sum }; });
  for (const [id, name] of [["halloween", "Haunted Night"], ["halloweenGrave", "Graveyard"]]) {
    test(`${name} is offered in Settings and draws on Home`, async () => {
      await nav(s.page, "Settings"); await wait(s.page, 200);
      const card = s.page.locator(`[data-cfgv="bg.scene:${id}"]`);
      assert.strictEqual(await card.getAttribute("aria-label"), name);
      await card.click(); await wait(s.page, 150);
      assert.strictEqual(await s.page.evaluate("SCNid"), id);
      await nav(s.page, "Home"); await wait(s.page, 900);
      const a = await sample(); await wait(s.page, 600); const b = await sample();
      assert.ok(a.opaque > .99, "canvas is filled: " + a.opaque);
      assert.ok(a.colours > 40, "not a flat fill: " + a.colours + " colours");
      assert.notStrictEqual(a.sum, b.sum, "animates");
      assert.strictEqual(await s.page.evaluate("CFG.bg.scene"), id);
    });
  }
  test("scenes cope with tiny canvases, zero density and full intensity", async () => {
    const out = await s.page.evaluate(() => ["halloween", "halloweenGrave"].map((id) => { try { for (const [w, h, dens, k] of [[40, 24, 0, 1], [1600, 900, 2, 2]]) { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"), sc = SCENES[id](), o = { t: 1000, dt: .016, w, h, k, m: { x: -1, y: 1 }, px: 1, dens, fgOn: true }; sc.init(o); for (let i = 0; i < 3; i++) { o.t += 500; sc.draw(x, o); if (sc.front) sc.front(x, o); } } return "ok"; } catch (e) { return id + ": " + e.message; } }));
    assert.deepStrictEqual(out, ["ok", "ok"]);
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});
