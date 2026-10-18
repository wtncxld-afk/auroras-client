// node scripts/compat-matrix.js [manifest.json]
// Writes COMPATIBILITY.md and visuals/compat.json. Without an argument it downloads Mojang's official version list.
const fs = require("fs"), path = require("path"), C = require("../compat.js");
const root = path.join(__dirname, ".."), read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
(async () => {
  let manifest;
  if (process.argv[2]) manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  else { const r = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"); if (!r.ok) throw new Error("Mojang returned " + r.status); manifest = await r.json(); }
  const m = C.matrix(manifest, read("visuals/adapters.json"), read("validated.json"));
  fs.writeFileSync(path.join(root, "visuals", "compat.json"), JSON.stringify(m, null, 1)); fs.writeFileSync(path.join(root, "COMPATIBILITY.md"), C.markdown(m, manifest._note ? "**Generated from a sample version list, not Mojang's.** " + manifest._note : null));
  console.log(`Wrote COMPATIBILITY.md (${m.rows.length} rows).`);
})().catch((e) => { console.error("Couldn't build the matrix: " + e.message); process.exit(1); });
