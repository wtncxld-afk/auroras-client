import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Deny by default: every owner API route must go through ownerRoute(), every CI route through ciRoute(), and every
// owner page must call requireOwnerPage(). A new route that forgets this fails here.
const APP = path.join(process.cwd(), "src/app");
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const METHODS = /export\s+(const|async function|function)\s+(GET|POST|PUT|PATCH|DELETE|HEAD)\b/g;

test("owner API routes are wrapped in ownerRoute()", () => {
  const files = walk(path.join(APP, "api/owner")).filter((f) => f.endsWith("route.ts"));
  assert.ok(files.length > 20);
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8"), rel = path.relative(APP, f);
    if (rel === path.join("api/owner/auth/login/route.ts")) { assert.match(src, /sameOrigin\(/); continue; }
    for (const m of src.matchAll(METHODS)) assert.match(src, new RegExp(`export const ${m[2]} = ownerRoute`), `${rel} ${m[2]}`);
  }
});
test("CI routes are wrapped in ciRoute()", () => {
  for (const f of walk(path.join(APP, "api/ci")).filter((f) => f.endsWith("route.ts"))) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(METHODS)) assert.match(src, new RegExp(`export const ${m[2]} = ciRoute(<[^>]*>)?\\(`), f);
  }
  assert.match(fs.readFileSync(path.join(APP, "api/ci/releases/[id]/publish/route.ts"), "utf8"), /ciRoute(<[^>]*>)?\("releases:publish"/);
});
test("owner pages call requireOwnerPage()", () => {
  const pages = walk(path.join(APP, "owner/(secure)")).filter((f) => /page\.tsx$|layout\.tsx$/.test(f));
  assert.ok(pages.length >= 14);
  for (const f of pages) assert.match(fs.readFileSync(f, "utf8"), /await requireOwnerPage\(\)/, f);
});
test("no route under app/api outside owner/ci/public allowlist", () => {
  const allowed = /^api\/(owner|ci|download|media|health|releases\/latest)\//;
  for (const f of walk(path.join(APP, "api")).filter((f) => f.endsWith("route.ts"))) assert.match(path.relative(APP, f) + "", allowed, f);
});
