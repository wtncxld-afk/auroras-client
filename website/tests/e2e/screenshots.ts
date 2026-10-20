// Captures every public page (desktop and mobile) and every owner page against a fresh database seeded with the
// real GitHub release history. Output: SHOTS_DIR (default /tmp/auroras-shots). Usage: npm run screenshots
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { ORIGIN, OWNER, start, stop, totpNow } from "../api/harness";

const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "/opt/node22/lib/node_modules/playwright");
const OUT = process.env.SHOTS_DIR || "/tmp/auroras-shots";
const PUBLIC = ["/", "/features", "/download", "/modules", "/modules/auroras-client-mod", "/changelog", "/docs", "/docs/installation", "/docs/troubleshooting", "/community", "/privacy", "/terms", "/owner/login", "/this-page-does-not-exist"];

async function scroll(page: any) { await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } window.scrollTo(0, 0); }); await page.waitForTimeout(1200); } // eslint-disable-line @typescript-eslint/no-explicit-any
const name = (p: string) => (p === "/" ? "home" : p.slice(1).replace(/\//g, "-"));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const c = await start({ releases: true });
  const browser = await pw.chromium.launch();
  const report: string[] = [];
  try {
    for (const [label, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]] as const) {
      const page = await browser.newPage({ viewport: vp, deviceScaleFactor: label === "mobile" ? 2 : 1 });
      const errs: string[] = []; page.on("pageerror", (e: Error) => errs.push(e.message)); page.on("console", (m: any) => { if (m.type() === "error") errs.push(m.text()); }); // eslint-disable-line @typescript-eslint/no-explicit-any
      for (const p of PUBLIC) {
        await page.goto(ORIGIN + p, { waitUntil: "networkidle" }); await scroll(page);
        const file = path.join(OUT, `${name(p)}-${label}.png`); await page.screenshot({ path: file, fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        report.push(`${file} overflowX=${overflow} errors=${JSON.stringify(errs.splice(0))}`);
      }
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(ORIGIN + "/owner/login"); await page.fill("#username", OWNER.username); await page.fill("#password", OWNER.password); await page.fill("#code", totpNow(c.totpSecret)); await page.click("button[type=submit]"); await page.waitForURL(ORIGIN + "/owner");
    const [rel] = await c.sql`select id from releases where module_id is null and status = 'published' order by created_at desc limit 1`;
    const [mod] = await c.sql`select id from modules limit 1`;
    const [doc] = await c.sql`select id from doc_pages order by sort limit 1`;
    const owner = ["/owner", "/owner/releases", `/owner/releases/${rel.id}`, `/owner/releases/${rel.id}/preview`, "/owner/releases/new", "/owner/modules", `/owner/modules/${mod.id}`, "/owner/content", "/owner/announcements", "/owner/docs", `/owner/docs/${doc.id}`, "/owner/audit", "/owner/security"];
    for (const p of owner) {
      await page.goto(ORIGIN + p, { waitUntil: "networkidle" }); await page.waitForTimeout(500);
      const n = p.replace(/[0-9a-f-]{36}/, "id"); const file = path.join(OUT, `${name(n)}-desktop.png`);
      await page.screenshot({ path: file, fullPage: true }); report.push(file);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const p of ["/owner", `/owner/releases/${rel.id}`]) { await page.goto(ORIGIN + p, { waitUntil: "networkidle" }); const file = path.join(OUT, `${name(p.replace(/[0-9a-f-]{36}/, "id"))}-mobile.png`); await page.screenshot({ path: file, fullPage: true }); report.push(file); }
  } finally { await browser.close(); await stop(c); }
  console.log(report.join("\n"));
})();
