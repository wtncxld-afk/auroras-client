// Quality bar from the design brief: layout at every size, no clipped text, keyboard focus, contrast in every theme,
// reduced motion, long names, no emoji icons, previews that stop when hidden. Real screens in headless Chromium.
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { launch, wait, nav, tap } = require("./harness");
const PAGES = ["Home", "Instances", "Mods", "Friends", "Cosmetics", "Skins", "Capes", "Emotes", "Totem Studio", "Modules", "Settings"];
const SIZES = [[960, 640], [1280, 800], [1920, 1080], [2560, 1080]];

const layoutProblems = (page) => page.evaluate(() => {
  const out = [], m = document.getElementById("main"); if (m.scrollWidth > m.clientWidth + 1) out.push(`page scrolls sideways (${m.scrollWidth} > ${m.clientWidth})`);
  for (const el of document.querySelectorAll("#main *, .side *")) {
    if (el.children.length || !el.textContent.trim() || !el.getClientRects().length) continue; const cs = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && cs.overflowX !== "visible" && cs.textOverflow !== "ellipsis" && el.tagName !== "INPUT" && el.tagName !== "SELECT" && el.tagName !== "OPTION") out.push("text cut off: " + el.textContent.trim().slice(0, 40));
    const r = el.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1) && cs.position !== "fixed") out.push("outside the window: " + el.textContent.trim().slice(0, 40));
  }
  return out.slice(0, 6);
});

describe("layout at every window size", () => {
  for (const [w, h] of SIZES) test(`${w}x${h}: every page fits, nothing is cut off, no script errors`, async () => {
    const s = await launch({ viewport: { width: w, height: h } });
    try { const bad = []; for (const p of PAGES) { await nav(s.page, p); await wait(s.page, 350); const pr = await layoutProblems(s.page); if (pr.length) bad.push(p + ": " + pr.join("; ")); }
      assert.deepStrictEqual(bad, []); assert.deepStrictEqual(s.errors, []); } finally { await s.close(); }
  });
  test("the sidebar becomes an icon rail on narrow windows and keeps every page reachable", async () => {
    const s = await launch({ viewport: { width: 960, height: 640 } });
    try { assert.ok((await s.page.locator(".side").boundingBox()).width <= 60); for (const p of PAGES) await nav(s.page, p); assert.deepStrictEqual(s.errors, []); } finally { await s.close(); }
  });
});

describe("accessibility", () => {
  test("Tab moves through the interface with a visible focus ring", async () => {
    const s = await launch();
    try {
      const seen = []; for (let k = 0; k < 14; k++) { await s.page.keyboard.press("Tab"); seen.push(await s.page.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { tag: a.tagName, label: a.getAttribute("aria-label") || a.textContent.trim().slice(0, 20), ring: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 1 }; })); }
      assert.ok(seen.filter((x) => x.label).length >= 10, "focus reaches labelled controls"); assert.ok(seen.every((x) => x.ring), "every focused control shows a ring: " + JSON.stringify(seen.filter((x) => !x.ring)));
      assert.ok(seen.some((x) => /^Home$|Instances|Mods/.test(x.label)), "navigation is reachable by keyboard");
    } finally { await s.close(); }
  });
  test("text contrast meets WCAG AA in every theme (body 4.5:1, secondary 4.5:1, primary buttons 4.5:1)", async () => {
    const s = await launch();
    try {
      const res = await s.page.evaluate(() => {
        const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
        const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const probe = document.createElement("div"); document.body.appendChild(probe); const col = (v) => { probe.style.color = `var(${v})`; return getComputedStyle(probe).color; };
        const out = {}; for (const [id] of THEMES) { document.documentElement.dataset.theme = id; out[id] = { text: ratio(col("--text"), col("--bg")), textPanel: ratio(col("--text"), col("--s1")), mute: ratio(col("--mute"), col("--bg")), mutePanel: ratio(col("--mute"), col("--s1")), button: ratio(col("--acc-ink"), col("--acc")) }; }
        probe.remove(); return out;
      });
      const bad = Object.entries(res).flatMap(([id, r]) => Object.entries(r).filter(([, v]) => v < 4.5).map(([k, v]) => `${id} ${k} ${v.toFixed(2)}`));
      assert.deepStrictEqual(bad, []);
    } finally { await s.close(); }
  });
  test("reduced motion: page transitions and preview animation stop", async () => {
    const s = await launch({ reducedMotion: true });
    try {
      await nav(s.page, "Cosmetics"); await wait(s.page, 400);
      assert.strictEqual(await s.page.evaluate(() => getComputedStyle(document.querySelector(".page")).animationName), "none");
      const px = () => s.page.evaluate(() => { const c = document.getElementById("sky-cv"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 101) h = (h * 31 + d[i]) | 0; return h; });
      const a = await px(); await wait(s.page, 500); assert.strictEqual(await px(), a, "the sky preview holds still");
    } finally { await s.close(); }
  });
  test("icons are drawn icons, never emoji", async () => {
    const s = await launch();
    try { const found = []; for (const p of PAGES) { await nav(s.page, p); await wait(s.page, 250); const t = await s.page.evaluate(() => document.body.innerText); const m = t.match(/\p{Extended_Pictographic}/gu); if (m) found.push(p + ": " + [...new Set(m)].join(" ")); }
      assert.deepStrictEqual(found, []); } finally { await s.close(); }
  });
});

describe("content honesty and long names", () => {
  test("long account and instance names are shortened, never overflowing", async () => {
    const s = await launch();
    try {
      await s.page.evaluate(() => { localStorage.setItem("acct", JSON.stringify({ list: [{ uuid: "u1", name: "AVeryLongPlayerName", microsoft: true }], sel: "u1" })); });
      await s.page.reload(); await wait(s.page, 500);
      for (const p of ["Home", "Settings", "Skins"]) { await nav(s.page, p); await wait(s.page, 300); assert.deepStrictEqual(await layoutProblems(s.page), [], p); }
      assert.match(await s.page.locator(".side .acct").textContent(), /AVeryLongPlayerName/);
    } finally { await s.close(); }
  });
  test("no made-up identity, news or status: no account shows 'No account', the server card shows VexVanilla's real address and no invented status", async () => {
    const s = await launch();
    try {
      assert.match(await s.page.locator(".side .acct").textContent(), /No account/); assert.doesNotMatch(await s.page.locator(".side").textContent(), /\bPlayer\b/);
      await nav(s.page, "Home"); await wait(s.page, 300); const t = await s.page.locator("#srv").textContent(); assert.match(t, /vexvanilla\.net/); assert.ok(await s.page.locator("[data-join]").count()); assert.doesNotMatch(t, /\d+ \/ \d+ online|\d+ ms/);
      assert.match(await s.page.locator(".homegrid").textContent(), /What’s new in 0\.1\.0/);
      await nav(s.page, "Friends"); await wait(s.page, 150); assert.match(await s.page.locator(".page").textContent(), /needs an Auroras friends server/); assert.doesNotMatch(await s.page.locator("#fr-body").textContent(), /Playing on|In the launcher/);
    } finally { await s.close(); }
  });
  test("live server status from the desktop app: online, offline and Join", async () => {
    const s = await launch();
    try {
      await s.page.evaluate(() => localStorage.setItem("server", "play.example.net")); await s.page.reload(); await wait(s.page, 300);
      await s.page.evaluate(() => { window.__srv = { online: true, version: "Paper 1.21.4", players: { online: 37, max: 200 }, motd: "VexVanilla survival", icon: null, latency: 42 }; auroras.serverStatus = async (a) => { if (a === "down.example.net") throw new Error("The server refused the connection. It may be offline."); return { address: a, ...window.__srv }; }; });
      await nav(s.page, "Settings"); await nav(s.page, "Home"); await wait(s.page, 400); let t = await s.page.locator("#srv").textContent();
      assert.match(t, /37 \/ 200 online · Paper 1\.21\.4 · 42 ms/); assert.match(t, /VexVanilla survival/);
      await s.page.evaluate(() => { window.__srv = { ...window.__srv, version: "VeloFlame 1.7.2-26.2", players: { online: 58, max: 1000 }, motd: "🎃 VEX VANILLA 🎃 ▶ .gg/VexVanilla \\ EU\n✨ NEW SEASON OUT JOIN NOW 🏹" }; }); await nav(s.page, "Settings"); await nav(s.page, "Home"); await wait(s.page, 400);
      const fit = await s.page.evaluate(() => { const c = document.querySelector("#srv"), m = c.querySelector(".motd"), j = c.querySelector("[data-join]").getBoundingClientRect(), r = c.getBoundingClientRect(); return { over: c.scrollWidth - c.clientWidth, motd: m.scrollHeight - m.clientHeight, join: j.right <= r.right }; });
      assert.deepEqual(fit, { over: 0, motd: 0, join: true }, "a long server status and MOTD stay inside the card");
      await tap(s.page, "[data-srvedit]"); await s.page.locator("#addr").fill("bad address!"); await s.page.locator("#addr").press("Enter"); assert.match(await s.page.locator("#srverr").textContent(), /server address like/);
      await s.page.locator("#addr").fill("down.example.net"); await s.page.locator("#addr").press("Enter"); await wait(s.page, 200); t = await s.page.locator("#srv").textContent(); assert.match(t, /refused the connection/); assert.ok(await s.page.locator("[data-srvretry]").count());
    } finally { await s.close(); }
  });
});

describe("account manager and skins", () => {
  test("lists accounts with their state, switches, removes after confirming, and refreshes skins", async () => {
    const s = await launch();
    try {
      await s.page.evaluate(() => { localStorage.setItem("acct", JSON.stringify({ list: [{ uuid: "u1", name: "Steve", microsoft: true }, { uuid: "u2", name: "Alex", preview: true }], sel: "u1" })); });
      await s.page.reload(); await wait(s.page, 400); await s.page.evaluate(() => { auroras.accountsStatus = async () => ({ u1: { signedIn: false } }); });
      await tap(s.page, ".side .acct"); await wait(s.page, 400); const t = await s.page.locator("#acctmgr").textContent();
      assert.match(t, /Steve.*Sign in again to play.*Active/s); assert.match(t, /Alex.*Preview only/s);
      await tap(s.page, '[data-acctuse="u2"]'); await wait(s.page, 200); assert.match(await s.page.locator(".side .acct").textContent(), /Alex/);
      await tap(s.page, '[data-acctrm="u2"]'); await tap(s.page, "#dmodal [data-ok]"); await wait(s.page, 200); assert.doesNotMatch(await s.page.locator("#acctmgr").textContent(), /Alex/);
      assert.deepStrictEqual(s.errors, []);
    } finally { await s.close(); }
  });
  test("Skins: 'Use on my account' uploads through the desktop app and explains when it can't", async () => {
    const s = await launch();
    try {
      await nav(s.page, "Skins"); await wait(s.page, 300); assert.match(await s.page.locator("#skacct").textContent(), /Add a Microsoft account/);
      await s.page.evaluate(() => { localStorage.setItem("acct", JSON.stringify({ list: [{ uuid: "u1", name: "Steve", microsoft: true }], sel: "u1" })); window.__up = null; });
      await s.page.reload(); await wait(s.page, 300); await s.page.evaluate(() => { auroras.skinUpload = async (o) => { window.__up = { uuid: o.uuid, variant: o.variant, n: o.bytes.length }; return { skin: null, model: o.variant }; }; });
      await nav(s.page, "Skins"); await wait(s.page, 300); await tap(s.page, '#skvar [data-v="slim"]'); await tap(s.page, "#skup"); await s.page.waitForFunction(() => window.__up, null, { timeout: 5000 });
      const up = await s.page.evaluate(() => window.__up); assert.strictEqual(up.uuid, "u1"); assert.strictEqual(up.variant, "slim"); assert.ok(up.n > 100, "a real PNG is sent");
    } finally { await s.close(); }
  });
});

describe("performance hygiene", () => {
  test("previews stop drawing once their page is closed", async () => {
    const s = await launch();
    try {
      await nav(s.page, "Cosmetics"); await wait(s.page, 300); await nav(s.page, "Emotes"); await wait(s.page, 300); await nav(s.page, "Instances"); await wait(s.page, 200);
      const n = await s.page.evaluate(() => new Promise((res) => { let calls = 0; const o = CanvasRenderingContext2D.prototype.fillRect; CanvasRenderingContext2D.prototype.fillRect = function (...a) { if (this.canvas.id !== "bg" && this.canvas.id !== "tr") calls++; return o.apply(this, a); }; setTimeout(() => res(calls), 600); }));
      assert.strictEqual(n, 0, "no studio canvas draws after leaving its page");
    } finally { await s.close(); }
  });
});
