"use strict";
/**
 * Performance mods for Fabric instances: well-known, open-source mods from Modrinth that make Minecraft run faster,
 * installed with the Auroras mod when you press Play (Settings > "Install performance mods"). Pure logic, tested in
 * test/perfmods.test.js; main.js does the downloads with the same checked Modrinth path as the Mods page.
 */
const PERF_MODS = [
  { slug: "sodium", name: "Sodium", why: "a much faster renderer", files: /^sodium-(fabric-)?\d|^sodium-/i },
  { slug: "lithium", name: "Lithium", why: "faster game logic", files: /^lithium-/i },
  { slug: "ferrite-core", name: "FerriteCore", why: "lower memory use", files: /^ferritecore-/i },
  { slug: "entityculling", name: "EntityCulling", why: "skips drawing hidden entities", files: /^entityculling-/i },
  { slug: "immediatelyfast", name: "ImmediatelyFast", why: "faster HUD and text drawing", files: /^immediatelyfast-/i },
];
/** Mods that don't work alongside these (OptiFine replaces the same renderer Sodium does). */
const CONFLICTS = [{ files: /^(optifine|optifabric)/i, blocks: ["sodium"], reason: "OptiFine is installed" }];

/**
 * Which performance mods still need installing for an instance. man = the instance's mod manifest ({ "m:<project id>":
 * {filename} }), files = jar names in its mods folder, ids = slug -> Modrinth project id once known. Already installed
 * (by the Mods page, a modpack, or by hand) means skipped, never duplicated.
 */
function plan(man, files, ids = {}) {
  const jars = (files || []).filter((f) => /\.jar$/i.test(f)), out = [], skipped = [];
  for (const m of PERF_MODS) {
    const block = CONFLICTS.find((c) => c.blocks.includes(m.slug) && jars.some((f) => c.files.test(f)));
    if (block) { skipped.push({ slug: m.slug, reason: block.reason }); continue; }
    const id = ids[m.slug];
    if ((id && man && man["m:" + id]) || jars.some((f) => m.files.test(f))) continue;
    out.push(m);
  }
  return { install: out, skipped };
}
/** One readable line for the launch status, e.g. "Installed Sodium and Lithium for better performance". */
function summary(installed, failed) {
  const list = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
  const parts = [];
  if (installed.length) parts.push("Installed " + list(installed) + " for better performance");
  if (failed.length) parts.push(list(failed) + (failed.length === 1 ? " isn’t" : " aren’t") + " available for this Minecraft version yet");
  return parts.join(". ");
}
module.exports = { PERF_MODS, CONFLICTS, plan, summary };
