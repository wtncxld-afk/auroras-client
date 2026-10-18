// Launcher UI tests: npm run test:ui (needs Playwright with Chromium). See harness.js for what is mocked.
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const { launch, wait, nav, calls } = require("./harness");

describe("navigation", () => {
  let s; before(async () => { s = await launch(); }); after(() => s.close());
  test("every sidebar item opens its page, also via the address hash", async () => {
    for (const n of ["Home", "Instances", "Mods", "Friends", "Cosmetics", "Skins", "Capes", "Emotes", "Totem Studio", "Modules", "Settings"]) {
      await nav(s.page, n);
      assert.ok((await s.page.locator("#crumb").textContent()).includes(n), n);
      assert.match(await s.page.locator(".nav[aria-current=page]").getAttribute("aria-label"), new RegExp("^" + n + "(, |$)"));
    }
    await s.page.evaluate("location.hash='#/modules'"); await wait(s.page, 200);
    assert.ok((await s.page.locator("#crumb").textContent()).includes("Modules"));
  });
  test("collapsed sidebar still navigates", async () => {
    await s.page.locator("#collapse").click(); await wait(s.page, 250); await nav(s.page, "Mods");
    assert.ok((await s.page.locator("#crumb").textContent()).includes("Mods"));
    await s.page.locator("#collapse").click();
  });
  test("custom title bar controls call the window bridge", async () => {
    assert.strictEqual(await s.page.locator(".wc button").count(), 3);
    await s.page.locator('.wc [data-w="min"]').click();
    assert.ok((await s.page.evaluate("__calls")).some(([n, a]) => n === "win" && a === "min"));
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("mods page", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Mods"); await wait(s.page, 500); }); after(() => s.close());
  test("searches Modrinth filtered to the selected instance's loader and version", async () => {
    assert.strictEqual(await s.page.locator("#mlist .mrow").count(), 20);
    const urls = (await s.page.evaluate("__calls")).filter(([n]) => n === "http").map(([, u]) => u);
    assert.ok(urls.some((u) => u.includes("facets=") && u.includes("fabric") && u.includes("1.21.4")));
    assert.strictEqual(await s.page.locator("[data-more]").count(), 1);
  });
  test("install shows progress, then Installed, and reports dependencies", async () => {
    await s.page.locator("#mlist .mrow button").first().click(); await wait(s.page, 400);
    assert.strictEqual((await s.page.locator("#mlist .mrow button").first().textContent()).trim(), "Installed");
    assert.match(await s.page.locator(".toast").textContent(), /1 required mod/);
  });
  test("detail view lists dependencies and closes with Escape", async () => {
    await s.page.locator("#mlist .mrow").nth(1).click(); await wait(s.page, 300);
    assert.strictEqual(await s.page.locator("#dmodal h1").textContent(), "Mod 1");
    assert.match(await s.page.locator("#dmodal").textContent(), /Fabric API/);
    await s.page.keyboard.press("Escape"); assert.strictEqual(await s.page.locator("#dmodal").count(), 0);
  });
  test("typing searches with the query; CurseForge asks for a key", async () => {
    await s.page.locator("#mq").fill("sodium"); await wait(s.page, 600);
    assert.ok((await s.page.evaluate("__calls")).some(([n, u]) => n === "http" && u.includes("query=sodium")));
    await s.page.locator('[data-p="CurseForge"]').click(); await wait(s.page, 400);
    assert.strictEqual(await s.page.locator("#cfk").count(), 1);
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("home: accounts and Play", () => {
  let s; before(async () => { s = await launch({ threeStub: true }); }); after(() => s.close());
  const t = (sel) => s.page.locator(sel).textContent();
  test("first run shows the onboarding state and the 3D stage", async () => {
    assert.strictEqual(await s.page.locator("[data-add]").count(), 1); assert.strictEqual(await s.page.locator("#play").count(), 0);
    assert.strictEqual(await s.page.locator("#sk").count(), 1); assert.strictEqual(await s.page.locator("#fgp").count(), 1);
  });
  test("adding an account by username: error message, then success", async () => {
    await s.page.locator("[data-add]").click(); await wait(s.page, 100);
    await s.page.locator("#un").fill("nobody"); await s.page.locator("[data-lookup]").click(); await wait(s.page, 150);
    assert.match(await t("#unerr"), /No Minecraft account/);
    await s.page.locator("#un").fill("Steve"); await s.page.locator("#un").press("Enter"); await wait(s.page, 400);
    assert.strictEqual(await s.page.locator("#amodal").count(), 0); assert.strictEqual(await s.page.locator("#play").count(), 1);
    assert.match(await t(".acct-sw"), /Steve/); assert.match(await t(".acct-sw"), /Preview only/); assert.strictEqual(await s.page.locator(".acct-sw img.av").count(), 1);
  });
  test("preview accounts cannot launch", async () => {
    await s.page.locator("#play").click(); await wait(s.page, 80);
    assert.match(await t("#plmsg"), /preview-only/); assert.strictEqual(await s.page.evaluate("__launch.length"), 0);
  });
  test("second account, popover, switching, slim model", async () => {
    await s.page.locator(".acct-sw").click(); await wait(s.page, 80); await s.page.locator("[data-newacct]").click();
    await s.page.locator("#un").fill("alexa"); await s.page.locator("[data-lookup]").click(); await wait(s.page, 400);
    assert.strictEqual(await s.page.evaluate("curAcct().name"), "alexa"); assert.strictEqual(await s.page.evaluate("curAcct().model"), "slim");
    await s.page.locator(".acct-sw").click(); await wait(s.page, 80);
    assert.strictEqual(await s.page.locator(".pop [data-aid]").count(), 2); assert.strictEqual(await s.page.locator(".pop [aria-checked=true]").count(), 1);
    await s.page.locator(".pop [data-aid]").first().click(); await wait(s.page, 250);
    assert.strictEqual(await s.page.evaluate("curAcct().name"), "Steve");
  });
  test("Play state machine and duplicate-launch protection", async () => {
    await s.page.evaluate("AC.list.forEach(a=>{a.preview=false;a.microsoft=true});acctSave();render()"); await wait(s.page, 250);
    await s.page.locator("#play").click(); await wait(s.page, 10);
    assert.strictEqual(await s.page.locator("#play").getAttribute("data-state"), "launching");
    await s.page.locator("#play").click(); await s.page.locator("#play").click(); await wait(s.page, 150);
    assert.strictEqual(await s.page.evaluate("__launch.length"), 1);
    assert.strictEqual(await s.page.evaluate("__launch[0].uuid"), "u-Steve"); assert.strictEqual(await s.page.evaluate("__launch[0].inst.mc"), "1.21.4");
    const sent = await s.page.evaluate("__launch[0].inst");
    assert.deepStrictEqual([sent.loader, sent.loaderVersion, sent.mem, sent.java], ["Fabric", "0.16.10", 4, { mode: "auto" }], "loader version is resolved from metadata before launching");
    assert.strictEqual(await s.page.evaluate("cur().loaderVersion"), "0.16.10", "and remembered on the instance");
    const face = await s.page.evaluate(`new Promise(r=>{const im=new Image();im.onload=()=>r([im.width,im.height,__launch[0].face.slice(0,22)]);im.src=__launch[0].face})`);
    assert.deepStrictEqual(face, [8, 8, "data:image/png;base64,"], "the account's 8x8 face is sent for the in-game menu");
    for (const [st, pct, txt] of [["downloading", 42, "Downloading 42%"], ["launching", 0, "Launching"], ["playing", 0, "Playing"]]) {
      await s.page.evaluate(`__ev.launch({instId:cur().id,state:'${st}',pct:${pct}})`); await wait(s.page, 20);
      assert.ok((await t("#play")).includes(txt), st); assert.strictEqual(await s.page.locator("#play").getAttribute("data-state"), st);
    }
    assert.strictEqual(await s.page.evaluate("bid"), 0, "launcher background pauses while Minecraft runs");
    assert.match(await s.page.evaluate("cur().played"), /^Played /);
    await s.page.evaluate("__ev.launch({instId:cur().id,state:'error',msg:'Java 21 was not found'})"); await wait(s.page, 20);
    assert.notStrictEqual(await s.page.evaluate("bid"), 0, "and resumes when the game stops");
    assert.match(await t("#plmsg"), /Java 21/); assert.match(await t("#play"), /Try again/);
    await s.page.evaluate("__ev.launch({state:'ready'})");
  });
  test("removing an account asks first; accounts persist", async () => {
    await s.page.locator(".acct-sw").click(); await wait(s.page, 80); await s.page.locator("[data-arm]").first().click(); await wait(s.page, 80);
    assert.strictEqual(await s.page.evaluate("AC.list.length"), 2);
    await s.page.locator("#amodal [data-ok]").click(); await wait(s.page, 250); assert.strictEqual(await s.page.evaluate("AC.list.length"), 1);
    await s.page.reload(); await wait(s.page, 400); assert.strictEqual(await s.page.evaluate("AC.list.length"), 1);
  });
  test("Microsoft sign-in without an Azure app ID shows the setup steps, checks the ID, then opens the sign-in window", async () => {
    await s.page.locator(".acct-sw").click(); await s.page.locator("[data-newacct]").click(); await s.page.locator("[data-ms]").click(); await wait(s.page, 150);
    assert.match(await t("#ms-box"), /Set up Microsoft sign-in/); assert.match(await t("#ms-box"), /Mobile and desktop applications/); assert.strictEqual(await s.page.locator("#ms-box #ms-cid").count(), 1);
    await s.page.fill("#ms-cid", "not-an-id"); await s.page.click("#ms-cid-save"); await wait(s.page, 100);
    assert.match(await t("#ms-cid-err"), /doesn’t look like/); assert.strictEqual((await calls(s.page, "setSettings")).filter((o) => "msClientId" in o).length, 0);
    await s.page.evaluate(() => { window.__authDelay = 400; });
    await s.page.fill("#ms-cid", "0123abcd-0000-4000-8000-00000000abcd"); await s.page.keyboard.press("Enter"); await wait(s.page, 120);
    assert.deepStrictEqual((await calls(s.page, "setSettings")).filter((o) => "msClientId" in o).at(-1), { msClientId: "0123abcd-0000-4000-8000-00000000abcd" });
    assert.match(await t("#ms-box"), /Finish signing in in the Microsoft window/, "waits for the window");
    await wait(s.page, 500); assert.strictEqual(await s.page.locator("#amodal").count(), 0, "the dialog closes when sign-in finishes");
    assert.ok(await s.page.evaluate(() => AC.list.some((a) => a.name === "Steve_MS" && !a.preview)), "the Microsoft account is added");
  });
  test("sign-in window: cancelling returns to the start; errors offer Try again and the code fallback", async () => {
    await s.page.evaluate(() => { window.__authDelay = 5000; });
    await s.page.locator(".acct-sw").click(); await s.page.locator("[data-newacct]").click(); await s.page.locator("[data-ms]").click(); await wait(s.page, 100);
    await s.page.locator("[data-mscancel]").click(); await wait(s.page, 100);
    assert.strictEqual((await calls(s.page, "authCancel")).length, 1); assert.strictEqual(await s.page.locator("#ms-box [data-ms]").count(), 1);
    await s.page.evaluate(() => { window.__authDelay = 30; window.__authResult = { ok: false, error: "This Microsoft account doesn’t own Minecraft: Java Edition." }; });
    await s.page.locator("[data-ms]").click(); await wait(s.page, 150);
    assert.match(await t("#ms-box"), /doesn’t own Minecraft/); assert.strictEqual(await s.page.locator("#ms-box [data-mscode]").count(), 1);
    await s.page.locator("#ms-box [data-mscode]").click(); await wait(s.page, 150);
    assert.match(await t("#ms-box"), /ABCD-EFGH/, "the code fallback still works");
    await s.page.evaluate(() => { delete window.__authResult; });
    await s.page.keyboard.press("Escape");
  });
  test("skin conversion: legacy 64x32 becomes 64x64 with mirrored left limbs; other sizes are rejected", async () => {
    const leg = await s.page.evaluate(`new Promise(res=>{const c=document.createElement('canvas');c.width=64;c.height=32;const x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(4,20,1,1);x.fillStyle='#0000ff';x.fillRect(7,20,1,1);x.fillStyle='#00ff00';x.fillRect(44,20,1,1);
      const im=new Image();im.onload=()=>{const o=skinCanvas(im),g=o.getContext('2d'),px=(a,b)=>Array.from(g.getImageData(a,b,1,1).data).slice(0,3).join(',');res({h:o.height,legR:px(23,52),legB:px(20,52),arm:px(39,52),orig:px(4,20)})};im.src=c.toDataURL()})`);
    assert.deepStrictEqual(leg, { h: 64, legR: "255,0,0", legB: "0,0,255", arm: "0,255,0", orig: "255,0,0" });
    const bad = await s.page.evaluate(`new Promise(res=>{const c=document.createElement('canvas');c.width=128;c.height=128;const im=new Image();im.onload=()=>{try{skinCanvas(im);res('no error')}catch(e){res(e.message)}};im.src=c.toDataURL()})`);
    assert.match(bad, /Unsupported skin size/);
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("backgrounds and cursor trails", () => {
  let s; before(async () => { s = await launch(); }); after(() => s.close());
  test("all seven scenes fill the canvas at three sizes", async () => {
    const out = await s.page.evaluate(`(()=>{const r={};for(const id of Object.keys(SCENES)){try{let ok=true;for(const [w,h] of [[320,180],[700,400],[100,60]]){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),sc=SCENES[id](),o={t:6000,dt:.016,w,h,k:1,m:{x:.3,y:-.2},px:.6,dens:1,fgOn:false};sc.init(o);for(let i=0;i<5;i++){o.t+=16;sc.draw(x,o)}if(sc.front)sc.front(x,{...o,fgOn:true});const d=x.getImageData(0,0,w,h).data;let nz=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)nz++;if(nz<w*h*.9)ok=false}r[id]=ok}catch(e){r[id]='ERR '+e.message}}return r})()`);
    assert.deepStrictEqual(Object.keys(out).sort(), ["aurora", "islands", "minimal", "nebula", "rain", "sakura", "sakuraNight"]);
    for (const [k, v] of Object.entries(out)) assert.strictEqual(v, true, k);
  });
  test("settings: live previews, instant switching, sliders, toggles, persistence", async () => {
    await nav(s.page, "Settings"); await wait(s.page, 300);
    assert.strictEqual(await s.page.locator("canvas[data-scene]").count(), 7);
    await s.page.locator('[data-cfgv="bg.scene:rain"]').click(); await wait(s.page, 200);
    assert.strictEqual(await s.page.evaluate("SCNid"), "rain");
    for (const [id, v] of [["intensity", "0.5"], ["density", "1.5"], ["blur", "4"], ["brightness", "0.8"]]) await s.page.locator(`#c-bg\\.${id}`).fill(v);
    await wait(s.page, 150);
    const f = await s.page.evaluate("document.getElementById('bg').style.filter");
    assert.ok(f.includes("blur(4px)") && f.includes("brightness(0.8)"), f);
    await s.page.locator('[data-cfgt="bg.perf"]').click(); await s.page.locator('[data-cfgt="bg.animate"]').click(); await wait(s.page, 150);
    assert.strictEqual(await s.page.evaluate("bid"), 0, "animation stopped");
    await s.page.locator('[data-cfgt="bg.animate"]').click(); await wait(s.page, 150); assert.notStrictEqual(await s.page.evaluate("bid"), 0);
    await s.page.locator('[data-cfgt="bg.audio"]').click(); await wait(s.page, 250); assert.ok(await s.page.evaluate("!!AU")); await s.page.locator('[data-cfgt="bg.audio"]').click();
    await s.page.locator('[data-cfgv="trail.mode:stardust"]').click(); await s.page.locator("#c-trail\\.length").fill("1.4"); await wait(s.page, 150);
    await s.page.reload(); await wait(s.page, 400);
    assert.deepStrictEqual(await s.page.evaluate("[CFG.bg.scene,CFG.trail.mode,CFG.bg.blur,CFG.trail.length]"), ["rain", "stardust", 4, 1.4]);
  });
  test("every trail style draws, never takes clicks, is capped, and stops when disabled", async () => {
    for (const mode of ["sakura", "aurora", "cyan", "stardust", "soft", "minimal"]) {
      await s.page.evaluate(`CFG.trail.mode='${mode}'`);
      for (let i = 0; i < 25; i++) await s.page.mouse.move(300 + i * 14, 300 + (i % 5) * 6);
      await wait(s.page, 60);
      const n = await s.page.evaluate("(()=>{const d=tx.getImageData(0,0,trc.width,trc.height).data;let n=0;for(let i=3;i<d.length;i+=28)if(d[i]>0)n++;return n})()");
      assert.ok(n > 20, mode + " drew " + n); await wait(s.page, 1300);
    }
    assert.strictEqual(await s.page.evaluate("getComputedStyle(document.getElementById('tr')).pointerEvents"), "none");
    await s.page.evaluate("CFG.trail.mode='aurora';CFG.trail.perf=false;CFG.trail.density=2");
    for (let i = 0; i < 300; i++) await s.page.mouse.move(100 + i * 3, 400 + (i % 9) * 5);
    assert.ok((await s.page.evaluate("TP.length")) <= 261);
    await s.page.evaluate("CFG.trail.mode='off'"); await s.page.mouse.move(100, 100); await s.page.mouse.move(300, 300); await wait(s.page, 80);
    assert.strictEqual(await s.page.evaluate("TP.length"), 0);
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("focus", () => {
  test("unfocused window throttles the background loop", async () => {
    const s = await launch();
    try {
      const fps = (ms) => s.page.evaluate(`new Promise(r=>{const c=document.getElementById('bg').getContext('2d');let n=0;const orig=SCN.draw;SCN.draw=function(...a){n++;return orig.apply(this,a)};setTimeout(()=>{SCN.draw=orig;r(n*1000/${ms})},${ms})})`);
      await s.page.evaluate("UNFOCUSED=false"); const focused = await fps(1500);
      await s.page.evaluate("window.dispatchEvent(new Event('blur'))"); const blurred = await fps(1500);
      assert.ok(focused > 20 && blurred <= 11, `focused ${focused.toFixed(1)} fps, unfocused ${blurred.toFixed(1)} fps`);
      await s.page.evaluate("window.dispatchEvent(new Event('focus'))"); assert.strictEqual(await s.page.evaluate("UNFOCUSED"), false);
    } finally { await s.close(); }
  });
});

describe("reduced motion", () => {
  test("background is static and the trail is off by default", async () => {
    const s = await launch({ reducedMotion: true });
    try { assert.strictEqual(await s.page.evaluate("bid"), 0); assert.strictEqual(await s.page.evaluate("CFG.trail.mode"), "off"); assert.deepStrictEqual(s.errors, []); } finally { await s.close(); }
  });
});

describe("instance creator (version-aware)", () => {
  let s; before(async () => { s = await launch(); await nav(s.page, "Instances"); }); after(() => s.close());
  const has = async (re) => assert.match(await s.page.locator("#modal").textContent(), re);
  test("typing the name before the version list arrives keeps what was typed", async () => {
    await s.page.locator("[data-new]").first().click();
    await s.page.locator("#cn").type("Typed Early", { delay: 5 }); await wait(s.page, 300);
    assert.strictEqual(await s.page.locator("#cn").inputValue(), "Typed Early");
    await s.page.locator("#cn").type("!", { delay: 5 }); assert.strictEqual(await s.page.locator("#cn").inputValue(), "Typed Early!");
    await s.page.keyboard.press("Escape"); await wait(s.page, 50);
  });
  test("name step validates empty and duplicate names", async () => {
    await s.page.locator("[data-new]").first().click(); await wait(s.page, 30);
    await s.page.locator("[data-m=next]").click(); await has(/Give the instance a name/);
    await s.page.locator("#cn").fill("VexVanilla"); await s.page.locator("[data-m=next]").click(); await has(/already exists/);
    await s.page.locator("#cn").fill("Year Release"); await s.page.locator("[data-m=next]").click(); await wait(s.page, 20);
  });
  test("versions load from the metadata bridge, newest stable preselected, with loader pills", async () => {
    await wait(s.page, 250);
    const rows = s.page.locator("#vl .vrow"); assert.strictEqual(await rows.count(), 3);
    assert.ok((await rows.first().textContent()).startsWith("26.1"));
    assert.ok((await s.page.locator("#vl [aria-selected=true]").textContent()).startsWith("26.1"));
    assert.strictEqual(await rows.first().locator(".tag.off").count(), 2, "NeoForge and Forge struck out for 26.1");
  });
  test("loading state shows skeleton rows", async () => {
    assert.ok(await s.page.evaluate("(()=>{const l=VL.list;VL.list=null;VL.loading=true;drawCreator();const n=document.querySelectorAll('#vl .skel').length;VL.list=l;VL.loading=false;drawCreator();return n>0})()"));
  });
  test("search, empty state, and the three version filters from the official list", async () => {
    await s.page.locator("#vq").fill("1.21.4"); assert.strictEqual(await s.page.locator("#vl .vrow").count(), 1);
    await s.page.locator("#vq").fill("zzz"); assert.match(await s.page.locator("#vl").textContent(), /No versions match/); await s.page.locator("#vq").fill("");
    const ids = () => s.page.locator("#vl .vrow").evaluateAll((r) => r.map((x) => x.dataset.v)), last = async () => (await s.page.evaluate("__calls")).filter(([n]) => n === "versions").at(-1)[1];
    assert.deepStrictEqual(await ids(), ["26.1", "1.21.4", "1.21"], "all releases from 1.21, releases only");
    assert.match(await s.page.locator('#vl .vrow[data-v="26.1"]').textContent(), /Release.*Latest/); assert.match(await s.page.locator("#modal").textContent(), /From Mojang’s version manifest/);
    await s.page.locator('[data-m="vfilter"][data-v="latest"]').click(); await wait(s.page, 250); assert.strictEqual((await last()).filter, "latest"); assert.deepStrictEqual(await ids(), ["26.1", "1.21.4"], "newest patch of each release line");
    await s.page.locator('[data-m="vfilter"][data-v="dev"]').click(); await wait(s.page, 250); assert.strictEqual((await last()).filter, "dev");
    const t = await s.page.locator("#vl").textContent(); assert.match(t, /Snapshot/); assert.doesNotMatch(t, /\bRelease\b(?! candidate)/, "no release is listed as a snapshot or vice versa");
    assert.match(await s.page.locator("#modal").textContent(), /can break worlds/);
    await s.page.locator('[data-m="vrefresh"]').click(); await wait(s.page, 250); assert.strictEqual((await last()).refresh, true);
    await s.page.locator('[data-m="vfilter"][data-v="releases"]').click(); await wait(s.page, 250);
  });
  test("loader step: availability, loader versions, untested label, Java requirement", async () => {
    await s.page.locator('#vl .vrow[data-v="26.1"]').click(); await s.page.locator("[data-m=next]").click(); await wait(s.page, 120);
    assert.ok(await s.page.locator('.vrow[data-v="NeoForge"]').isDisabled()); assert.ok(await s.page.locator('.vrow[data-v="Forge"]').isDisabled()); assert.ok(!(await s.page.locator('.vrow[data-v="Fabric"]').isDisabled()));
    const fab = await s.page.locator('.vrow[data-v="Fabric"]').textContent(); assert.ok(fab.includes("0.17.3") && fab.includes("Untested"), fab);
    await has(/Java 25 required/);
    await s.page.locator("[data-m=back]").click(); await s.page.locator('#vl .vrow[data-v="1.21.4"]').click(); await s.page.locator("[data-m=next]").click(); await wait(s.page, 100);
    await s.page.locator('.vrow[data-v="NeoForge"]').click(); assert.match(await s.page.locator('.vrow[data-v="NeoForge"]').textContent(), /21\.4\.88/);
    await s.page.locator("[data-m=back]").click(); await s.page.locator('#vl .vrow[data-v="26.1"]').click(); await wait(s.page, 30);
    assert.strictEqual(await s.page.evaluate("C.loader"), "Fabric", "falls back when the chosen loader is unavailable");
  });
  test("advanced: custom Java needs a path; the instance stores everything it needs", async () => {
    await s.page.locator("[data-m=next]").click(); await s.page.locator("[data-m=next]").click(); await wait(s.page, 60);
    await s.page.locator("summary").click(); await s.page.locator("#cjm").selectOption("custom"); await wait(s.page, 40);
    await s.page.locator("#cm").fill("6");
    await s.page.locator("[data-m=create]").click(); await has(/path to your Java/);
    await s.page.locator("#cjp").fill("C:/jdk-25/bin/javaw.exe"); await s.page.locator("#ca").fill("-XX:+UseZGC");
    await s.page.locator("[data-m=create]").click(); await wait(s.page, 120);
    const inst = await s.page.evaluate("INST[0]");
    assert.deepStrictEqual({ name: inst.name, mc: inst.mc, loader: inst.loader, loaderVersion: inst.loaderVersion, java: inst.java, mem: inst.mem, args: inst.args },
      { name: "Year Release", mc: "26.1", loader: "Fabric", loaderVersion: "0.17.3", java: { mode: "custom", path: "C:/jdk-25/bin/javaw.exe", major: 25 }, mem: 6, args: "-XX:+UseZGC" });
    assert.strictEqual((await s.page.evaluate("__prep[0]")).id, inst.id, "asked the desktop side to create the instance folders");
    assert.strictEqual(await s.page.evaluate("cur().name"), "Year Release");
  });
  test("instances persist side by side after a restart", async () => {
    await s.page.reload(); await wait(s.page, 300);
    assert.strictEqual(await s.page.evaluate("INST.length"), 3); assert.strictEqual(await s.page.evaluate("cur().mc"), "26.1");
  });
  test("no script errors", () => assert.deepStrictEqual(s.errors, []));
});

describe("web preview without the desktop app", () => {
  test("creator shows an honest offline note and a short fallback list", async () => {
    const s = await launch({ bridge: false });
    try {
      await s.page.evaluate("openCreator()"); await s.page.locator("#cn").fill("Web"); await s.page.locator("[data-m=next]").click(); await wait(s.page, 100);
      assert.match(await s.page.locator("#modal").textContent(), /desktop app/); assert.strictEqual(await s.page.locator("#vl .vrow").count(), 3);
      await s.page.keyboard.press("Escape"); await nav(s.page, "Mods"); await wait(s.page, 500); assert.match(await s.page.locator("#mlist").textContent(), /Couldn’t load mods/);
      assert.deepStrictEqual(s.errors, []);
    } finally { await s.close(); }
  });
});

describe("Ready-made downloads", () => {
  let s; before(async () => { s = await launch(); }); after(() => s.close());
  test("Check for updates uses the GitHub release and offers the new installer", async () => {
    await s.page.evaluate(() => { window.__rel = { configured: true, current: "0.1.4", latest: "v0.1.9", newer: true, url: "https://github.com/me/auroras/releases/tag/v0.1.9", installer: "AurorasClientSetup-0.1.9.exe" }; });
    await nav(s.page, "Settings"); await wait(s.page, 300); await s.page.locator("[data-checkupd]").click(); await wait(s.page, 200);
    const t = await s.page.locator("#updres").textContent(); assert.match(t, /v0\.1\.9 is available/); assert.match(t, /Download AurorasClientSetup-0\.1\.9\.exe/);
    await s.page.evaluate(() => { window.__rel.newer = false; window.__rel.current = "0.1.9"; }); await s.page.locator("[data-checkupd]").click(); await wait(s.page, 200);
    assert.match(await s.page.locator("#updres").textContent(), /latest version \(0\.1\.9\)/);
  });
});

