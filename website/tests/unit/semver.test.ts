import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { compareVersions, isVersion } from "../../src/lib/semver";
const updater = createRequire(import.meta.url)("../../../updater.js");

test("compareVersions agrees with the launcher's updater.js", () => {
  const vs = ["0.1.1", "0.1.9", "0.1.10", "0.2.0", "1.0.0", "1.0.0-beta.1", "1.0.0-beta.2", "1.0.0-rc.1", "0.1.9-beta", "2.0.0"];
  for (const a of vs) for (const b of vs) assert.equal(Math.sign(compareVersions(a, b)), Math.sign(updater.compareVersions(a, b)), `${a} vs ${b}`);
});
test("isVersion accepts semver and rejects junk", () => {
  for (const v of ["0.1.9", "1.2.3-beta.1", "10.0.0"]) assert.ok(isVersion(v), v);
  for (const v of ["", "1.2", "v1.2.3", "1.2.3 ", "1.2.3/../x", "../../etc"]) assert.ok(!isVersion(v), v);
});
