// Shared setup for the launcher UI tests. Runs the real renderer/index.html in headless Chromium.
// window.auroras (the desktop bridge) is replaced by a mock, so these tests check the interface, not Electron or the network.
const path = require("path");
function loadPlaywright() {
  try { return require("playwright"); } catch {}
  const root = require("child_process").execSync("npm root -g").toString().trim();
  return require(path.join(root, "playwright"));
}
const { chromium } = loadPlaywright();
const PAGE = "file://" + path.join(__dirname, "..", "..", "renderer", "index.html").replace(/\\/g, "/");

const VERSIONS = (snap) => ({ stale: false, warnings: [], latest: { release: "26.1" }, features: [{ id: "module_gui", label: "Module menu" }, { id: "hud", label: "HUD" }, { id: "hud_editor", label: "HUD editor" }, { id: "sky", label: "Custom skies" }, { id: "emotes", label: "Emotes" }], versions: [
  ...(snap ? [{ id: "26.2-snapshot-1", kind: "snapshot", base: "26.2", releaseTime: "2026-09-01T10:00:00Z", loaders: { Vanilla: { available: true, compat: "vanilla" }, Fabric: { available: false }, NeoForge: { available: false }, Forge: { available: false } } }] : []),
  { id: "26.1", kind: "release", releaseTime: "2026-03-24T10:00:00Z", loaders: { Vanilla: { available: true, compat: "vanilla" }, Fabric: { available: true, loaderVersion: "0.17.3", compat: "untested" }, NeoForge: { available: false, compat: "unavailable" }, Forge: { available: false, compat: "unavailable" } } },
  { id: "1.21.4", kind: "release", releaseTime: "2024-12-03T10:00:00Z", loaders: { Vanilla: { available: true, compat: "vanilla" }, Fabric: { available: true, loaderVersion: "0.16.10", compat: "untested" }, NeoForge: { available: true, loaderVersion: "21.4.88", compat: "untested" }, Forge: { available: true, loaderVersion: "54.0.1", compat: "untested" } } },
  ...(snap ? [{ id: "1.21.5-rc1", kind: "rc", base: "1.21.5", releaseTime: "2025-03-18T10:00:00Z", loaders: { Vanilla: { available: true, compat: "vanilla" }, Fabric: { available: true, loaderVersion: "0.16.10", compat: "untested" }, NeoForge: { available: false }, Forge: { available: false } } },
    { id: "1.21.5-pre1", kind: "prerelease", base: "1.21.5", releaseTime: "2025-03-04T10:00:00Z", loaders: { Vanilla: { available: true, compat: "vanilla" }, Fabric: { available: false }, NeoForge: { available: false }, Forge: { available: false } } }] : []),
  { id: "1.21", kind: "release", releaseTime: "2024-06-13T10:00:00Z", loaders: { Vanilla: { available: true, compat: "vanilla" }, Fabric: { available: true, loaderVersion: "0.16.10", compat: "untested" }, NeoForge: { available: true, loaderVersion: "21.0.5", compat: "untested" }, Forge: { available: false, compat: "unavailable" } } }] });

/** The mock bridge. Each method imitates what main.js returns; calls are recorded on window.__calls. */
function withAuroras(list) {
  const feats = ["module_gui", "hud", "hud_editor", "sky", "emotes"];
  list.versions.forEach((v) => { const has = v.id === "1.21.4"; v.auroras = { mc: v.id, type: v.kind, loader: "fabric", adapter: has ? "y1_21_4" : null, build: has ? "not built" : "no adapter", launch: "untested",
    features: Object.fromEntries(feats.map((f) => [f, has ? "experimental" : "unsupported"])), issues: has ? ["Adapter code exists but has never been built."] : [v.kind === "release" ? "No Auroras adapter for this version yet; the client mod stays disabled." : "Auroras builds are only made for releases; the client mod stays disabled on development builds."] }; });
  return list;
}
function mockBridge(versions) {
  window.__calls = []; window.__ev = {}; window.__launch = []; window.__prep = [];
  const rec = (n, a) => window.__calls.push([n, a]);
  const skin = (n) => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#c99774"; x.fillRect(0, 0, 64, 64); return c.toDataURL(); };
  window.auroras = { desktop: true, win: (a) => rec("win", a),
    http: async ({ url }) => { rec("http", url);
      if (url.includes("modrinth.com/v2/search")) return { total_hits: 25, hits: Array.from({ length: 20 }, (_, i) => ({ project_id: "P" + i, slug: "mod-" + i, title: "Mod " + i, description: "Description " + i, author: "dev", icon_url: null, downloads: 12345 * (i + 1), display_categories: ["optimization"], categories: ["fabric", "optimization"], versions: i === 3 ? ["1.20.1"] : ["1.21.4", "1.21.1"] })) };
      throw new Error("Add your CurseForge API key first"); },
    installed: async () => ({}), settings: async () => ({ cfKey: false }), setCfKey: async () => true,
    installMod: async ({ id }) => { for (const p of [20, 60, 100]) { await new Promise((r) => setTimeout(r, 40)); window.__ev.progress && window.__ev.progress({ key: "m:" + id, pct: p }); } return { installed: { ["m:" + id]: { filename: "x.jar", version: "1" } }, count: 2 }; },
    removeMod: async () => true, deps: async () => ["Fabric API"], open: async (u) => rec("open", u), saveFile: async (f) => { rec("saveFile", f.filename); return true; },
    onProgress: (f) => { window.__ev.progress = f; },
    releaseCheck: async () => window.__rel || { configured: false }, modStatus: async () => window.__modst || null,
    settingsAll: async () => ({ cfKey: false, msClientId: "", updateUrl: "", spotifyClientId: "", spotifyConnected: false, version: "0.1.0" }), setSettings: async (o) => { rec("setSettings", o); if (typeof o.msClientId === "string") window.__msid = o.msClientId; if (o.spotifyClientId && !/^[0-9a-f]{32}$/i.test(o.spotifyClientId)) throw new Error("That doesn’t look like a Spotify client ID (32 letters and numbers)."); return true; },
    skinLookup: async (n) => { if (n === "nobody") throw new Error("No Minecraft account has that name"); return { uuid: "u-" + n, name: n, model: n === "alexa" ? "slim" : "classic", skin: skin(n) }; },
    skinRefresh: async () => null, removeAccount: async () => true, authWindow: async () => { if (!window.__msid) return { needsClientId: true }; rec("authWindow", window.__msid); const r = window.__authResult || { ok: true, account: { uuid: "u-steve", name: "Steve_MS", model: "classic", skin: null, microsoft: true } }; return new Promise((res) => { window.__authResolve = res; setTimeout(() => res(r), window.__authDelay ?? 50); }); },
    authCancel: async () => { rec("authCancel", 1); window.__authResolve && window.__authResolve({ cancelled: true }); return true; },
    authStart: async () => { if (!window.__msid) return { needsClientId: true }; rec("authStart", window.__msid); return { userCode: "ABCD-EFGH", url: "https://www.microsoft.com/link", expiresIn: 900 }; }, onAuthDone: (f) => { window.__ev.auth = f; },
    launch: async (o) => { window.__launch.push(o); await new Promise((r) => setTimeout(r, 50)); }, onLaunch: (f) => { window.__ev.launch = f; },
    updateCheck: async () => ({ status: "not-configured" }),
    versions: async (o = {}) => { rec("versions", o); await new Promise((r) => setTimeout(r, 80)); const f = o.filter || (o.snapshots ? null : "releases"), all = versions(true);
      all.fetchedAt = Date.parse("2026-10-18T09:00:00Z"); all.versions.forEach((v) => { v.stable = v.kind === "release"; v.line = v.stable ? v.id.split(".").slice(0, 2).join(".") : null; v.latest = v.id === all.latest.release; });
      const lines = new Map(); all.versions.filter((v) => v.stable).forEach((v) => { if (!lines.has(v.line)) lines.set(v.line, v.id); }); all.versions.forEach((v) => { v.latestInLine = v.stable && lines.get(v.line) === v.id; });
      all.versions = all.versions.filter((v) => f === "dev" ? !v.stable : f === "latest" ? v.latestInLine : f === "releases" ? v.stable : true); all.filter = f; return withAuroras(all); },
    versionMeta: async (id) => ({ java: { major: id === "26.1" ? 25 : 21 } }), instancePrepare: async (i) => { window.__prep.push(i); },
    // Per-instance mod settings, validated with the same rules as the game (window.AurorasVisuals is loaded by then).
    modcfgRead: async (id) => { const R = window.AurorasVisuals.makeRules(window.AURORAS_REGISTRY); window.__cfg = window.__cfg || {};
      if (!window.__cfg[id]) { const d = { active: "Default", profiles: {}, places: {}, skipped: 0 }; for (const n of ["Default", "Minimal HUD", "Competitive", "Casual"]) d.profiles[n] = { ...R.defaults(), ...(window.AURORAS_REGISTRY.builtIns[n] || {}) }; window.__cfg[id] = d; }
      rec("modcfgRead", id); return JSON.parse(JSON.stringify(window.__cfg[id])); },
    modcfgUpdate: async ({ id, profile, set, activate }) => { const R = window.AurorasVisuals.makeRules(window.AURORAS_REGISTRY); await window.auroras.modcfgRead(id);
      for (const [k, v] of Object.entries(set)) { const e = R.validate(k, v); if (e) throw new Error(e); }
      const d = window.__cfg[id]; d.profiles[profile] = { ...(d.profiles[profile] || R.defaults()), ...set }; if (activate) d.active = profile; rec("modcfgUpdate", { id, profile, set, activate }); return JSON.parse(JSON.stringify(d)); },
    modcfgAssign: async ({ id, place, profile }) => { await window.auroras.modcfgRead(id); if (!window.AurorasVisuals.PLACE.test(place)) throw new Error("Not a valid server or world");
      const d = window.__cfg[id]; if (profile === null) delete d.places[place]; else d.places[place] = profile; rec("modcfgAssign", { place, profile }); return JSON.parse(JSON.stringify(d)); },
    layoutsList: async (id) => { rec("layoutsList", id); return JSON.parse(JSON.stringify(window.__layouts || {})); },
    layoutsSave: async ({ id, name, layout }) => { const V = window.AurorasVisuals, R = V.makeRules(window.AURORAS_REGISTRY); V.importLayout(window.AURORAS_REGISTRY, R, V.exportLayout(name, layout)); window.__layouts = { ...(window.__layouts || {}), [name]: layout }; rec("layoutsSave", { name, layout }); return JSON.parse(JSON.stringify(window.__layouts)); },
    layoutsDelete: async ({ name }) => { delete (window.__layouts || {})[name]; rec("layoutsDelete", name); return JSON.parse(JSON.stringify(window.__layouts || {})); },
    emotesList: async (id) => { rec("emotesList", id); const E = window.__emotes || (window.__emotes = { custom: [], errors: [], wheel: null }); return JSON.parse(JSON.stringify(E)); },
    emotesSave: async ({ id, emote }) => { const V = window.AurorasVisuals, e = V.parseEmote(emote), E = window.__emotes; E.custom = E.custom.filter((x) => x.id !== e.id).concat([V.emoteToJson(e)]); rec("emotesSave", emote); return JSON.parse(JSON.stringify(E)); },
    emotesDelete: async ({ emoteId }) => { const E = window.__emotes; E.custom = E.custom.filter((x) => x.id !== emoteId); if (E.wheel) E.wheel = E.wheel.map((x) => (x === emoteId ? null : x)); rec("emotesDelete", emoteId); return JSON.parse(JSON.stringify(E)); },
    capeWrite: async ({ id, png }) => { if (!/^data:image\/png;base64,/.test(png)) throw new Error("That isn’t a PNG image."); rec("capeWrite", { id, bytes: png.length }); return { ok: true }; },
    capeClear: async (id) => { rec("capeClear", id); return { ok: true }; },
    emotesWheel: async ({ slots }) => { if (slots.length !== 8) throw new Error("The wheel has 8 slots"); window.__emotes.wheel = slots.slice(); rec("emotesWheel", slots); return JSON.parse(JSON.stringify(window.__emotes)); },
    spotifyConnect: async () => { rec("spotifyConnect"); return true; }, spotifyDisconnect: async () => { rec("spotifyDisconnect"); return true; },
    vanillaTexture: async ({ mc, path }) => { rec("vanillaTexture", { mc, path }); if (mc !== "1.21.4") throw new Error(`Minecraft ${mc} is not downloaded yet`);
      const c = document.createElement("canvas"); c.width = c.height = 16; const x = c.getContext("2d"); x.fillStyle = "#e0b030"; x.fillRect(4, 2, 8, 12); return { dataUrl: c.toDataURL() }; } };
}
/** A stand-in for three.js: every property and call returns another stand-in. It proves the stage code runs, not that it draws correctly. */
const THREE_STUB = `(()=>{const mk=()=>new Proxy(function(){},{get:(t,k)=>k==='attributes'?{uv:{setXY(){},needsUpdate:false}}:(k in t?t[k]:mk()),apply:()=>mk(),construct:()=>mk(),set:()=>true});window.THREE=new Proxy({},{get:()=>mk()});})();`;

async function launch(opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 800 }, ...(opts.reducedMotion ? { reducedMotion: "reduce" } : {}) });
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/*", (r) => (r.request().url().startsWith("http") ? r.abort() : r.continue()));
  if (opts.bridge !== false) await page.addInitScript(`const withAuroras=${withAuroras};(${mockBridge})(${VERSIONS})`);
  if (opts.threeStub) await page.addInitScript(THREE_STUB);
  await page.goto(PAGE); await page.waitForTimeout(300);
  if (opts.threeStub) { await page.evaluate("LIBS[THREE_URL]=Promise.resolve();render()"); await page.waitForTimeout(300); }
  return { browser, page, errors, close: () => browser.close() };
}
const wait = (page, ms) => page.waitForTimeout(ms);
const calls = (page, name) => page.evaluate((n) => window.__calls.filter((c) => c[0] === n).map((c) => c[1]), name);
/** Clicks after centering the element, so the floating Play bar at the bottom of the window never covers it. */
const tap = async (page, sel) => { const l = typeof sel === "string" ? page.locator(sel) : sel; await l.first().evaluate((el) => el.scrollIntoView({ block: "center" })); await l.first().click(); };
const nav = async (page, label) => { await page.locator(`.nav[aria-label="${label}"], .nav[aria-label^="${label}, "]`).first().click(); await wait(page, 150); };
module.exports = { launch, wait, nav, calls, tap, PAGE };
