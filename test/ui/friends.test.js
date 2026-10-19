// Friends page: setup when no server is configured, Microsoft-only, the list with presence, requests, Join and errors.
// The desktop side is stubbed (test/ui/harness.js); the real server and client are covered by test/friends.test.js.
const { describe, test, before, after } = require("node:test"), assert = require("node:assert");
const { launch, wait, nav, tap, calls } = require("./harness.js");
const ME = { uuid: "a".repeat(32), name: "Steve_MS" }, ALEX = "b".repeat(32), JEB = "c".repeat(32), DIN = "d".repeat(32);

describe("Friends", () => {
  let s; const t = (sel) => s.page.locator(sel).textContent();
  before(async () => { s = await launch(); }); after(() => s.close());
  test("no friends server yet: says so plainly and takes an https address", async () => {
    await nav(s.page, "Friends"); await wait(s.page, 200); assert.match(await t("#fr-body"), /needs an Auroras friends server/);
    await s.page.fill("#fr-url", "http://insecure.example"); await s.page.press("#fr-url", "Enter"); await wait(s.page, 100); assert.match(await t("#fr-urlerr"), /https/);
    await s.page.evaluate(() => { window.__fr = { me: { uuid: "a".repeat(32), name: "Steve_MS" }, friends: [], incoming: [], outgoing: [], invites: [] }; });
    await s.page.fill("#fr-url", "https://friends.example.net"); await s.page.press("#fr-url", "Enter"); await wait(s.page, 150);
    assert.match(await t("#fr-body"), /Sign in with Microsoft to use Friends/, "no Microsoft account yet");
  });
  test("preview accounts can't use friends; a Microsoft account loads the list", async () => {
    await s.page.evaluate(() => addAccount({ uuid: "p".repeat(32), name: "Preview", preview: true })); await nav(s.page, "Home"); await nav(s.page, "Friends"); await wait(s.page, 150);
    assert.match(await t("#fr-body"), /preview-only accounts can’t use it/);
    await s.page.evaluate((me) => { window.__fr = { me, friends: [{ uuid: "b".repeat(32), name: "Alex", state: "playing", server: "vexvanilla.net", instance: "VexVanilla" }, { uuid: "c".repeat(32), name: "jeb_", state: "online" }, { uuid: "e".repeat(32), name: "Old", state: "offline", lastSeen: new Date(Date.now() - 3 * 3600e3).toISOString() }],
      incoming: [{ uuid: "d".repeat(32), name: "Dinnerbone", at: "" }], outgoing: [{ uuid: "f".repeat(32), name: "Notch", at: "" }], invites: [{ uuid: "b".repeat(32), name: "Alex", server: "vexvanilla.net", expires: "" }] }; return addAccount(me); }, ME);
    await nav(s.page, "Home"); await nav(s.page, "Friends"); await wait(s.page, 200);
    const body = await t("#fr-body"); assert.match(body, /Playing on vexvanilla\.net/); assert.match(body, /In the launcher/); assert.match(body, /Offline · seen 3 h ago/);
    assert.match(body, /Dinnerbone/); assert.match(body, /Request sent/); assert.match(body, /Alex invited you/); assert.match(await t("#fr-me"), /Steve_MS/);
    assert.strictEqual((await calls(s.page, "friendsOverview")).at(-1), ME.uuid); assert.strictEqual(await t('.nav[data-go="friends"] .frn'), "2", "requests and invites show on the sidebar");
  });
  test("accepting a request moves them to your friends; sending one by username", async () => {
    await tap(s.page, `[data-fract="accept"][data-u="${DIN}"]`); await wait(s.page, 200);
    assert.deepStrictEqual((await calls(s.page, "friendsAct")).at(-1), { uuid: ME.uuid, action: "accept", arg: DIN }); assert.doesNotMatch(await t("#fr-body"), /Wants to be friends/);
    await s.page.fill("#fr-name", "Grumm"); await s.page.press("#fr-name", "Enter"); await wait(s.page, 150);
    assert.deepStrictEqual((await calls(s.page, "friendsAct")).at(-1), { uuid: ME.uuid, action: "request", arg: "Grumm" }); assert.strictEqual(await s.page.inputValue("#fr-name"), "");
    await s.page.evaluate(() => { window.__frActErr = "Grumm hasn’t signed in to Auroras friends yet. Ask them to open Friends in the launcher once."; });
    await s.page.fill("#fr-name", "Grumm"); await s.page.press("#fr-name", "Enter"); await wait(s.page, 150); assert.match(await t("#fr-adderr"), /hasn’t signed in/);
    await s.page.evaluate(() => { window.__frActErr = ""; });
  });
  test("Join on a friend who's playing launches into their server", async () => {
    await tap(s.page, '[data-frjoin="vexvanilla.net"]'); await wait(s.page, 250);
    const l = await s.page.evaluate(() => window.__launch.at(-1)); assert.strictEqual(l.inst.server, "vexvanilla.net"); assert.strictEqual(l.uuid, "a".repeat(32));
  });
  test("a server that can't be reached shows the reason and Try again", async () => {
    await s.page.evaluate(() => { window.__frErr = "The friends server didn’t answer."; FR.data = null; }); await nav(s.page, "Home"); await nav(s.page, "Friends"); await wait(s.page, 200);
    assert.match(await t("#fr-body"), /didn’t answer/); await s.page.evaluate(() => { window.__frErr = ""; }); await tap(s.page, "[data-frretry]"); await wait(s.page, 200); assert.match(await t("#fr-body"), /Online/);
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});
