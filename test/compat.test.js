const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const C = require("../compat.js");
const adapters = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "visuals", "adapters.json"), "utf8"));
const manifest = { versions: [
  { id: "26.1", type: "release", releaseTime: "2026-03-24T10:00:00Z" }, { id: "26.1-rc1", type: "snapshot", releaseTime: "2026-03-17T10:00:00Z" },
  { id: "1.21.5", type: "release", releaseTime: "2025-03-25T10:00:00Z" }, { id: "1.21.4", type: "release", releaseTime: "2024-12-03T10:00:00Z" },
  { id: "24w44a", type: "snapshot", releaseTime: "2024-10-30T10:00:00Z" }, { id: "1.21", type: "release", releaseTime: "2024-06-13T10:00:00Z" } ] };
const byMc = (m) => Object.fromEntries(m.rows.map((r) => [r.mc, r]));

test("with nothing validated, the best any feature can be is Experimental, and only where an adapter has code", () => {
  const m = byMc(C.matrix(manifest, adapters, { validated: [] }));
  assert.deepStrictEqual(Object.values(m["1.21.4"].features), ["experimental", "experimental", "experimental", "experimental", "experimental"]);
  assert.strictEqual(m["1.21.4"].build, "not built"); assert.strictEqual(m["1.21.4"].launch, "untested");
  for (const id of ["1.21.5", "1.21", "26.1-rc1", "24w44a"]) assert.ok(Object.values(m[id].features).every((s) => s === "unsupported"), id);
  // 26.1 has the Mojang-names adapter: experimental everywhere, custom skies included (ported 2026-10-19, unverified in game)
  assert.deepStrictEqual(m["26.1"].features, { module_gui: "experimental", hud: "experimental", hud_editor: "experimental", sky: "experimental", emotes: "experimental" });
  assert.match(m["26.1-rc1"].issues[0], /only made for releases/); assert.match(m["1.21.5"].issues[0], /No Auroras adapter/);
  assert.strictEqual(m["26.1-rc1"].type, "rc"); assert.strictEqual(m["24w44a"].type, "snapshot");
});
test("only validated.json can raise a state, per feature", () => {
  const vm = { validated: [{ mc: "1.21.4", loader: "fabric", built: true, launch: "tested", features: { hud: "tested", sky: "partial" }, issues: ["Sky ignores fog"] }] };
  const r = byMc(C.matrix(manifest, adapters, vm))["1.21.4"];
  assert.deepStrictEqual([r.build, r.launch, r.features.hud, r.features.sky, r.features.emotes], ["built", "tested", "tested", "partial", "experimental"]);
  assert.deepStrictEqual(r.issues, ["Sky ignores fog"]);
  const fake = byMc(C.matrix(manifest, adapters, { validated: [{ mc: "1.21.5", loader: "fabric", built: true, features: { hud: "tested" } }] }))["1.21.5"];
  assert.strictEqual(fake.features.hud, "unsupported", "a test record can't create support where no adapter code exists");
});
test("markdown matrix has one row per version and loader, with honest labels", () => {
  const md = C.markdown(C.matrix(manifest, adapters, { validated: [] }));
  assert.match(md, /\| Minecraft \| Type \| Loader \| Build \| Launch test \| Module menu \| HUD \| HUD editor \| Custom skies \| Emotes \| Known issues \|/);
  assert.match(md, /\| 1\.21\.4 \| Release \| fabric \| not built \| untested \| Experimental \| Experimental/); assert.match(md, /\| 26\.1-rc1 \| Release candidate \|/);
  assert.strictEqual(md.trim().split("\n").filter((l) => /^\| \d/.test(l)).length, 6); assert.doesNotMatch(md, /\| Tested \|/);
});
