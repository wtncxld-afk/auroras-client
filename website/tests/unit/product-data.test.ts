import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// The site's copies of the launcher's shared data must match visuals/ (run `npm run sync:product-data` after changes).
const here = path.join(process.cwd(), "tests/unit");
for (const f of ["registry.json", "compat.json", "adapters.json"]) test(`${f} is in sync with visuals/`, () => {
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(here, "../../src/data", f), "utf8")), JSON.parse(fs.readFileSync(path.join(here, "../../../visuals", f), "utf8")));
});
test("release snapshot only contains real v0.1.x releases with SHA-256 for each asset", () => {
  const s = JSON.parse(fs.readFileSync(path.join(here, "../../src/data/github-releases.json"), "utf8"));
  assert.ok(s.releases.length >= 9);
  for (const r of s.releases) { assert.match(r.version, /^0\.1\.\d+$/); for (const a of r.assets) { assert.match(a.sha256, /^[0-9a-f]{64}$/); assert.match(a.url, /^https:\/\/github\.com\//); } }
});
