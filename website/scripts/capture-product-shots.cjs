// Re-captures the launcher screenshots used on the website (public/product/*.webp) from the launcher's own
// browser preview build (../build/web-preview.html, made by `python scripts/build-renderer.py` at the repo root).
// These are real renders of the launcher UI; in the browser preview the desktop bridge is mocked, so screens show
// the "no account" state. Usage: node scripts/capture-product-shots.cjs
// Needs Playwright with Chromium (PLAYWRIGHT_PATH overrides where it is loaded from).
const path = require("path");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const sharp = require("sharp");
const ROOT = path.join(__dirname, "..");
const PREVIEW = "file://" + path.join(ROOT, "..", "build", "web-preview.html");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  await ctx.addInitScript(() => { try { localStorage.setItem("cfg", JSON.stringify({ bg: { scene: "aurora" }, trail: { mode: "off" } })); } catch {} });
  const p = await ctx.newPage();
  const save = async (name) => { const png = await p.screenshot(); await sharp(png).webp({ quality: 86 }).toFile(path.join(ROOT, "public", "product", `launcher-${name}.webp`)); console.log("wrote", name); };
  for (const pg of ["home", "modules", "totem", "emotes", "cosmetics", "capes", "instances", "skins"]) {
    await p.goto(PREVIEW + "#/" + pg); await p.waitForTimeout(2500); await save(pg);
  }
  await p.goto(PREVIEW + "#/modules"); await p.waitForTimeout(2000);
  await p.getByRole("button", { name: "HUD editor" }).first().click(); await p.waitForTimeout(1500);
  for (const n of ["FPS Counter", "Coordinates", "Keystrokes", "Armor Status", "Clock", "Client Branding", "Direction HUD", "Potion Effects"]) {
    await p.click(`button[aria-label="Show ${n}"]`); await p.waitForTimeout(200);
  }
  await p.waitForTimeout(1200); await save("hud");
  await b.close();
})();
