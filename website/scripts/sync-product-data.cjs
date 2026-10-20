// Copies the client's own data files into the website so it can be built and deployed on its own:
//   ../visuals/registry.json  (every module, its category and whether it has in-game code)
//   ../visuals/compat.json    (Minecraft versions and the Auroras mod's state on each)
//   ../visuals/adapters.json  (which Minecraft versions have an adapter)
// Run after the client's registry changes: node scripts/sync-product-data.cjs
// tests/unit/product-data.test.ts fails while the copies differ from the originals.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", ".."), out = path.join(__dirname, "..", "src", "data");
for (const f of ["registry.json", "compat.json", "adapters.json"]) { fs.copyFileSync(path.join(root, "visuals", f), path.join(out, f)); console.log("copied", f); }
