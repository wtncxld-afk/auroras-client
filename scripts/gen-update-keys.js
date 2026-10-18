// node scripts/gen-update-keys.js  -> writes update-public-key.pem (commit it) and update-private-key.pem (NEVER commit it)
const crypto = require("crypto"), fs = require("fs");
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
fs.writeFileSync("update-public-key.pem", publicKey.export({ type: "spki", format: "pem" }));
fs.writeFileSync("update-private-key.pem", privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
console.log("Wrote update-public-key.pem and update-private-key.pem. Keep the private key secret and add it to .gitignore.");
