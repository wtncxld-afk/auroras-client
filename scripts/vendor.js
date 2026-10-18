// Copies the 3D and zip libraries next to the UI so the app never loads remote scripts.
const fs = require("fs"), p = require("path");
const out = p.join(__dirname, "..", "renderer", "vendor");
fs.mkdirSync(out, { recursive: true });
const nm = p.join(__dirname, "..", "node_modules");
fs.copyFileSync(p.join(nm, "three", "build", "three.min.js"), p.join(out, "three.min.js"));
fs.copyFileSync(p.join(nm, "jszip", "dist", "jszip.min.js"), p.join(out, "jszip.min.js"));
