"use strict";
const test = require("node:test"), assert = require("node:assert");
const P = require("../perfmods.js");

test("performance mods: all five on a fresh instance", () => {
  const p = P.plan({}, []);
  assert.deepStrictEqual(p.install.map((m) => m.slug), ["sodium", "lithium", "ferrite-core", "entityculling", "immediatelyfast"]);
  assert.deepStrictEqual(p.skipped, []);
});
test("performance mods: anything already there is never installed twice", () => {
  const byFile = P.plan({}, ["sodium-fabric-0.6.13+mc1.21.11.jar", "Lithium-fabric-0.15.0.jar", "notes.txt"]);
  assert.deepStrictEqual(byFile.install.map((m) => m.slug), ["ferrite-core", "entityculling", "immediatelyfast"]);
  const byManifest = P.plan({ "m:AAA": { filename: "renamed.jar" } }, ["renamed.jar"], { "ferrite-core": "AAA" });
  assert.ok(!byManifest.install.some((m) => m.slug === "ferrite-core"));
});
test("performance mods: Sodium is skipped when OptiFine is installed", () => {
  const p = P.plan({}, ["OptiFine_1.21.11_HD_U_J7.jar"]);
  assert.ok(!p.install.some((m) => m.slug === "sodium") && p.install.some((m) => m.slug === "lithium"));
  assert.deepStrictEqual(p.skipped, [{ slug: "sodium", reason: "OptiFine is installed" }]);
});
test("performance mods: a readable status line", () => {
  assert.strictEqual(P.summary(["Sodium", "Lithium"], []), "Installed Sodium and Lithium for better performance");
  assert.strictEqual(P.summary(["Sodium"], ["EntityCulling"]), "Installed Sodium for better performance. EntityCulling isn’t available for this Minecraft version yet");
  assert.strictEqual(P.summary([], ["A", "B", "C"]), "A, B and C aren’t available for this Minecraft version yet");
  assert.strictEqual(P.summary([], []), "");
});
