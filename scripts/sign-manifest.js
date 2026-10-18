// node scripts/sign-manifest.js manifest.json  -> writes manifest.json.sig (upload both files to your release host over https)
const crypto = require("crypto"), fs = require("fs");
const file = process.argv[2]; if (!file) { console.error("usage: node scripts/sign-manifest.js manifest.json"); process.exit(1); }
const sig = crypto.sign(null, fs.readFileSync(file), crypto.createPrivateKey(fs.readFileSync("update-private-key.pem")));
fs.writeFileSync(file + ".sig", sig.toString("base64")); console.log("Signed", file);
