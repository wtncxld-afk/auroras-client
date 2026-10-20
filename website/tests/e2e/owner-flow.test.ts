import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fakeExe, ORIGIN, OWNER, sha256, start, stop, totpNow, type Ctx } from "../api/harness";

// Browser test of the owner journey: sign in with TOTP, create a draft, upload, publish, and see the public site
// update. Uses the Playwright install given by PLAYWRIGHT_PATH (default: the global one) and its Chromium.
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "/opt/node22/lib/node_modules/playwright");
let c: Ctx; let browser: any; // eslint-disable-line @typescript-eslint/no-explicit-any
before(async () => { c = await start(); browser = await pw.chromium.launch(); }, { timeout: 240_000 });
after(async () => { await browser?.close(); await stop(c); });

test("owner signs in, publishes a release, and the public site shows it", { timeout: 180_000 }, async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = []; page.on("pageerror", (e: Error) => errors.push(e.message));

  await page.goto(ORIGIN + "/owner/releases");
  assert.match(page.url(), /\/owner\/login$/, "anonymous visitor is sent to sign-in");
  await page.fill("#username", OWNER.username); await page.fill("#password", "wrong password 123");
  await page.fill("#code", totpNow(c.totpSecret)); await page.click("button[type=submit]");
  await page.getByText(/isn't right/).first().waitFor({ timeout: 10_000 });
  await page.fill("#password", OWNER.password); await page.fill("#code", c.recovery.shift()!); await page.click("button[type=submit]");
  await page.waitForURL(ORIGIN + "/owner", { timeout: 15_000 });

  await page.goto(ORIGIN + "/owner/releases/new");
  await page.fill("#version", "0.4.0"); await page.fill("#title", "Auroras Client 0.4.0"); await page.fill("#summary", "End-to-end test release.");
  await page.fill("#ch-added", "Browser-tested publishing");
  await page.click("text=Create draft");
  await page.waitForURL(/\/owner\/releases\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auroras-e2e-")), file = path.join(dir, "AurorasClientSetup-0.4.0.exe"), buf = fakeExe(40_000);
  fs.writeFileSync(file, buf);
  await page.setInputFiles("#file", file);
  await page.selectOption("#kind", "installer"); await page.selectOption("#platform", "windows");
  await page.getByRole("button", { name: /^Upload/ }).click();
  await page.getByText(sha256(buf)).first().waitFor({ timeout: 20_000 });

  assert.ok(!(await (await fetch(ORIGIN + "/")).text()).includes("0.4.0"), "still private before publishing");
  await page.getByRole("button", { name: "Publish release" }).click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByText(/Release state/).waitFor({ timeout: 20_000 });

  for (const p of ["/", "/download", "/changelog"]) { await page.goto(ORIGIN + p); assert.ok((await page.content()).includes("0.4.0"), p); }
  await page.goto(ORIGIN + "/download");
  assert.ok((await page.content()).includes(sha256(buf)), "checksum on the download page");
  const m = JSON.parse(await (await fetch(ORIGIN + "/updates/manifest.json")).text());
  assert.equal(m.launcher.stable.version, "0.4.0"); assert.equal(m.launcher.stable.sha256, sha256(buf));
  assert.deepEqual(errors, []);
});
