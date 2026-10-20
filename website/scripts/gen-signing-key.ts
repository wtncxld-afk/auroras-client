// Prints a new Ed25519 key pair for signing the update manifest, in the same format as the launcher's
// scripts/gen-update-keys.js. Nothing is written to disk.
//  - Put the PRIVATE key in the server's UPDATE_SIGNING_KEY secret (base64 line below). Never commit it.
//  - Ship the PUBLIC key in the launcher as update-public-key.pem.
// If the launcher already has update-public-key.pem, use its existing private key instead of generating a new one:
//   base64 -w0 update-private-key.pem   ->  UPDATE_SIGNING_KEY
import crypto from "node:crypto";
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const priv = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
console.log("update-public-key.pem (commit this in the launcher):\n" + publicKey.export({ type: "spki", format: "pem" }));
console.log("UPDATE_SIGNING_KEY (server secret, one line):\n" + Buffer.from(priv).toString("base64"));
