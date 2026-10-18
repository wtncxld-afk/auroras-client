// Compatibility matrix: for every Minecraft version in the official manifest, what Auroras can honestly say it supports.
// Inputs: visuals/adapters.json (exported from the Java core: which adapter covers which versions and which features it
// has code for) and validated.json (what has actually been built and tested in a real game). Nothing else can raise a state.
const V = require("./versions");
const STATES = { tested: "Tested", partial: "Partially Supported", experimental: "Experimental", unsupported: "Unsupported" };

function adapterFor(id, loader, adapters) {
  const p = V.parseMc(id); if (!p) return null;
  return adapters.adapters.find((a) => a.loader === loader && V.compareMc(id, a.min) >= 0 && V.compareMc(id, a.max) <= 0) || null;
}
/** One row: build / launch / per-feature states for a version + loader. */
function row(v, loader, adapters, validated) {
  const rec = (validated.validated || []).find((e) => e.mc === v.id && e.loader === loader) || null, ad = v.kind === "release" ? adapterFor(v.id, loader, adapters) : null;
  const issues = []; const features = {};
  for (const f of adapters.features) {
    let st = "unsupported";
    if (ad && ad.features.includes(f.id)) {
      const t = rec && rec.features && rec.features[f.id];
      st = t === "tested" ? "tested" : t === "partial" ? "partial" : "experimental";
    }
    features[f.id] = st;
  }
  if (!ad) issues.push(v.kind === "release" ? "No Auroras adapter for this version yet; the client mod stays disabled." : "Auroras builds are only made for releases; the client mod stays disabled on development builds.");
  else if (!rec || !rec.built) issues.push("Adapter code exists but has never been built.");
  if (rec && Array.isArray(rec.issues)) issues.push(...rec.issues.map(String));
  return { mc: v.id, type: v.kind, loader, adapter: ad ? ad.id : null, build: rec && rec.built ? "built" : ad ? "not built" : "no adapter",
    launch: rec && rec.launch === "tested" ? "tested" : "untested", features, issues };
}
function matrix(manifest, adapters, validated, { loaders = ["fabric"] } = {}) {
  const versions = V.listVersions(manifest, { snapshots: true });
  return { features: adapters.features, rows: versions.flatMap((v) => loaders.map((l) => row(v, l, adapters, validated))) };
}
const TYPE = { release: "Release", prerelease: "Pre-release", rc: "Release candidate", snapshot: "Snapshot", experimental: "Experimental" };
function markdown(m, note) {
  const head = ["Minecraft", "Type", "Loader", "Build", "Launch test", ...m.features.map((f) => f.label), "Known issues"];
  const lines = ["# Auroras Client compatibility matrix", "", "Generated from a Minecraft version list (normally Mojang's official one), the adapter table in the client core, and `validated.json` (real in-game test results). A version listed here can be installed and launched by the launcher; the columns say what the Auroras client mod does on it.", "",
    ...(note ? ["> " + note, ""] : []), "States: **Tested** (verified in a real game), **Partially Supported** (some checks passed), **Experimental** (code exists, never verified), **Unsupported** (no code for this version).", "",
    "| " + head.join(" | ") + " |", "|" + head.map(() => "---").join("|") + "|"];
  for (const r of m.rows) lines.push("| " + [r.mc, TYPE[r.type] || r.type, r.loader, r.build, r.launch, ...m.features.map((f) => STATES[r.features[f.id]]), r.issues.join(" ").replace(/\|/g, "/") || ""].join(" | ") + " |");
  return lines.join("\n") + "\n";
}
module.exports = { STATES, TYPE, adapterFor, row, matrix, markdown };
