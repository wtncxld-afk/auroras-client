const test = require("node:test"), assert = require("node:assert");
const v = require("../versions.js");

const manifest = { versions: [
  { id: "26.1", type: "release", releaseTime: "2026-03-24T10:00:00+00:00", url: "https://piston-meta.mojang.com/a" },
  { id: "26.1-snapshot-2", type: "snapshot", releaseTime: "2025-12-02T10:00:00+00:00", url: "https://piston-meta.mojang.com/b" },
  { id: "1.21.11", type: "release", releaseTime: "2025-12-09T10:00:00+00:00", url: "https://piston-meta.mojang.com/c" },
  { id: "1.21.4", type: "release", releaseTime: "2024-12-03T10:00:00+00:00", url: "https://piston-meta.mojang.com/d" },
  { id: "1.21.4-rc1", type: "snapshot", releaseTime: "2024-11-27T10:00:00+00:00", url: "https://piston-meta.mojang.com/e" },
  { id: "25w14craftmine", type: "snapshot", releaseTime: "2025-04-01T10:00:00+00:00", url: "https://piston-meta.mojang.com/f" },
  { id: "1.21", type: "release", releaseTime: "2024-06-13T10:00:00+00:00", url: "https://piston-meta.mojang.com/g" },
  { id: "1.20.6", type: "release", releaseTime: "2024-04-29T10:00:00+00:00", url: "https://piston-meta.mojang.com/h" },
  { id: "24w14a", type: "snapshot", releaseTime: "2024-04-03T10:00:00+00:00", url: "https://piston-meta.mojang.com/i" },
  { id: "b1.7.3", type: "old_beta", releaseTime: "2011-07-07T00:00:00+00:00", url: "https://piston-meta.mojang.com/j" } ] };

test("release versions order correctly, including year-based releases; snapshots do not parse", () => {
  const lt = (a, b) => assert.strictEqual(v.compareMc(a, b), -1, `${a} < ${b}`);
  lt("1.21", "1.21.1"); lt("1.21.9", "1.21.10"); lt("1.21.11", "26.1"); lt("26.1", "26.1.1"); lt("1.20.6", "1.21");
  assert.strictEqual(v.parseMc("24w14a"), null); assert.strictEqual(v.parseMc("1.21.4-rc1"), null); assert.throws(() => v.compareMc("24w14a", "1.21"));
  assert.ok(v.atLeast121("1.21") && v.atLeast121("26.1") && !v.atLeast121("1.20.6") && !v.atLeast121("24w14a"));
});
test("stable list: 1.21 and newer releases only, newest first, from the official manifest", () => {
  const l = v.listVersions(manifest);
  assert.deepStrictEqual(l.map((x) => x.id), ["26.1", "1.21.11", "1.21.4", "1.21"]); assert.ok(l.every((x) => x.kind === "release"));
});
test("development builds are opt-in, typed, and nothing before 1.21 sneaks in", () => {
  const l = v.listVersions(manifest, { snapshots: true }), kind = Object.fromEntries(l.map((x) => [x.id, x.kind]));
  assert.strictEqual(kind["1.21.4-rc1"], "rc"); assert.strictEqual(kind["26.1-snapshot-2"], "snapshot"); assert.strictEqual(kind["25w14craftmine"], "experimental");
  assert.ok(!("24w14a" in kind) && !("1.20.6" in kind) && !("b1.7.3" in kind));
  assert.strictEqual(l.find((x) => x.id === "1.21.4-rc1").base, "1.21.4"); assert.strictEqual(l.find((x) => x.id === "26.1-snapshot-2").base, "26.1");
});
test("pre-releases and RCs of 1.21 itself count, even though they came out before 1.21; their week snapshots don't", () => {
  const m = { versions: [...manifest.versions, { id: "1.21-pre1", type: "snapshot", releaseTime: "2024-05-29T10:00:00Z" }, { id: "1.21-rc1", type: "snapshot", releaseTime: "2024-06-10T10:00:00Z" },
    { id: "24w21a", type: "snapshot", releaseTime: "2024-05-22T10:00:00Z" }, { id: "1.20.5-pre1", type: "snapshot", releaseTime: "2024-04-01T10:00:00Z" }, { id: "24w33a", type: "snapshot", releaseTime: "2024-08-14T10:00:00Z" }, { id: "1.21.4", type: "release", releaseTime: "2024-12-03T10:00:00Z" }] };
  const ids = v.listVersions(m, { snapshots: true }).map((x) => x.id);
  assert.ok(ids.includes("1.21-pre1") && ids.includes("1.21-rc1") && ids.includes("24w33a"));
  assert.ok(!ids.includes("24w21a") && !ids.includes("1.20.5-pre1")); assert.strictEqual(ids.filter((x) => x === "1.21.4").length, 1, "duplicate ids are listed once");
  assert.deepStrictEqual(v.listVersions(m, { snapshots: true, kinds: ["prerelease"] }).map((x) => x.id), ["1.21-pre1"]);
});
test("version types are recognised from Mojang's id patterns", () => {
  const c = (id, type = "snapshot") => v.classify({ id, type }).kind;
  assert.deepStrictEqual([c("1.21.5", "release"), c("1.21.5-pre2"), c("1.21.5-rc1"), c("25w10a"), c("26.1-snapshot-1"), c("24w14potato"), c("1.21-pre-3"), c("b1.7.3", "old_beta")],
    ["release", "prerelease", "rc", "snapshot", "snapshot", "experimental", "prerelease", "old"]);
});
test("Java requirement comes from the version JSON and is never guessed", () => {
  assert.deepStrictEqual(v.javaFor({ javaVersion: { component: "java-runtime-delta", majorVersion: 21 } }), { major: 21, component: "java-runtime-delta" });
  assert.strictEqual(v.javaFor({}), null); assert.strictEqual(v.javaFor(null), null);
});
test("Fabric availability and newest stable loader", () => {
  const games = [{ version: "1.21.4", stable: true }], loaders = [{ version: "0.17.0-beta", stable: false }, { version: "0.16.10", stable: true }];
  assert.deepStrictEqual(v.fabricFor("1.21.4", games, loaders), { available: true, loaderVersion: "0.16.10" }); assert.strictEqual(v.fabricFor("1.21.5", games, loaders).available, false);
});
test("NeoForge mapping: 1.21 is 21.0.x, picks the highest numeric build, flags beta-only, refuses unmapped schemes", () => {
  const list = ["21.0.5", "21.1.10", "21.1.9", "21.4.9", "21.4.88", "21.4.100-beta", "21.5.1-beta"];
  assert.deepStrictEqual(v.neoforgeFor("1.21", list), { available: true, loaderVersion: "21.0.5", beta: false });
  assert.strictEqual(v.neoforgeFor("1.21.1", list).loaderVersion, "21.1.10"); assert.strictEqual(v.neoforgeFor("1.21.4", list).loaderVersion, "21.4.88");
  assert.deepStrictEqual(v.neoforgeFor("1.21.5", list), { available: true, loaderVersion: "21.5.1-beta", beta: true });
  assert.strictEqual(v.neoforgeFor("1.21.2", list).available, false); const u = v.neoforgeFor("26.1", list); assert.ok(!u.available && /isn’t mapped/.test(u.reason));
});
test("Forge availability prefers recommended over latest", () => {
  const promos = { promos: { "1.21.1-latest": "52.0.40", "1.21.1-recommended": "52.0.2", "1.21.4-latest": "54.0.1" } };
  assert.strictEqual(v.forgeFor("1.21.1", promos).loaderVersion, "52.0.2"); assert.strictEqual(v.forgeFor("1.21.4", promos).loaderVersion, "54.0.1"); assert.strictEqual(v.forgeFor("1.21.2", promos).available, false);
});
test("compatibility labels: only the validation matrix can say validated", () => {
  const data = { fabricGames: [{ version: "1.21.4", stable: true }], fabricLoaders: [{ version: "0.16.10", stable: true }], neoforge: ["21.4.88"], forge: { promos: {} } };
  let m = v.loadersFor("1.21.4", data, { validated: [] });
  assert.strictEqual(m.Fabric.compat, "untested"); assert.strictEqual(m.NeoForge.compat, "untested"); assert.strictEqual(m.Forge.compat, "unavailable"); assert.strictEqual(m.Vanilla.compat, "vanilla");
  m = v.loadersFor("1.21.4", data, { validated: [{ mc: "1.21.4", loader: "fabric", client: "0.1.0" }] });
  assert.strictEqual(m.Fabric.compat, "validated"); assert.strictEqual(m.NeoForge.compat, "untested");
  assert.strictEqual(v.loadersFor("1.21.9", data, { validated: [{ mc: "1.21.4", loader: "fabric" }] }).Fabric.compat, "unavailable");
});

const m26 = { latest: { release: "26.1.1", snapshot: "26.2-snapshot-1" }, versions: [
  { id: "26.2-snapshot-1", type: "snapshot", releaseTime: "2026-05-05T10:00:00+00:00" }, { id: "26.1.1", type: "release", releaseTime: "2026-04-14T10:00:00+00:00" },
  { id: "26.1", type: "release", releaseTime: "2026-03-24T10:00:00+00:00" }, { id: "26.1-rc-1", type: "snapshot", releaseTime: "2026-03-17T10:00:00+00:00" },
  { id: "26.1-pre-1", type: "snapshot", releaseTime: "2026-03-03T10:00:00+00:00" }, { id: "26.1-snapshot-1", type: "snapshot", releaseTime: "2026-01-13T10:00:00+00:00" },
  { id: "1.21.11", type: "release", releaseTime: "2025-12-09T10:00:00+00:00" }, { id: "1.21.10", type: "release", releaseTime: "2025-10-07T10:00:00+00:00" },
  { id: "1.21.9-rc1", type: "snapshot", releaseTime: "2025-09-24T10:00:00+00:00" }, { id: "1.21.9", type: "snapshot", releaseTime: "2025-09-25T10:00:00+00:00" },
  { id: "1.21.1", type: "release", releaseTime: "2024-08-08T10:00:00+00:00" }, { id: "1.21", type: "release", releaseTime: "2024-06-13T10:00:00+00:00" } ] };
test("26.x numbering: snapshots, pre-releases, RCs and hotfixes are typed from the manifest, not from the number", () => {
  const k = Object.fromEntries(v.listVersions(m26, { snapshots: true }).map((x) => [x.id, [x.kind, x.stable]]));
  assert.deepStrictEqual(k["26.1-snapshot-1"], ["snapshot", false]); assert.deepStrictEqual(k["26.1-pre-1"], ["prerelease", false]); assert.deepStrictEqual(k["26.1-rc-1"], ["rc", false]);
  assert.deepStrictEqual(k["26.1.1"], ["release", true]); assert.deepStrictEqual(k["26.2-snapshot-1"], ["snapshot", false]);
  assert.deepStrictEqual(k["1.21.9"], ["snapshot", false], "a snapshot-typed build with a release-looking number is not stable");
  assert.ok(!v.listVersions(m26).some((x) => x.id === "1.21.9"), "and it never appears among releases");
});
test("filters: latest releases (newest patch per release line), all releases from 1.21, snapshots and pre-releases", () => {
  assert.deepStrictEqual(v.listVersions(m26, { filter: "latest" }).map((x) => x.id), ["26.1.1", "1.21.11"]);
  assert.deepStrictEqual(v.listVersions(m26, { filter: "releases" }).map((x) => x.id), ["26.1.1", "26.1", "1.21.11", "1.21.10", "1.21.1", "1.21"]);
  const dev = v.listVersions(m26, { filter: "dev" }); assert.ok(dev.every((x) => !x.stable)); assert.deepStrictEqual(dev.map((x) => x.id), ["26.2-snapshot-1", "26.1-rc-1", "26.1-pre-1", "26.1-snapshot-1", "1.21.9", "1.21.9-rc1"]);
  const l = v.listVersions(m26, { filter: "releases" }); assert.strictEqual(l.find((x) => x.id === "26.1.1").latest, true); assert.strictEqual(l.find((x) => x.id === "26.1").latestInLine, false);
  assert.deepStrictEqual([v.lineOf("26.1.2"), v.lineOf("1.21.11"), v.lineOf("24w14a")], ["26.1", "1.21", null]);
});
