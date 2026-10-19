// Used by .github/workflows/release.yml before building. Stamps this copy with:
//  - its version (0.1.<build number>), in package.json and the mod's gradle.properties;
//  - release.json: the GitHub repository whose releases hold the installer and the mod (so the app finds its downloads);
//  - auth.json: the Azure app (client) ID for Microsoft sign-in, from the repository variable AZURE_CLIENT_ID, and the
//    friends server address, from FRIENDS_URL (https), each if set.
// Usage: node scripts/ci-release.js <owner/repo> <build number>
const fs = require("fs"), path = require("path");
const [repo, run] = process.argv.slice(2), root = path.join(__dirname, "..");
if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo || "") || !/^\d+$/.test(run || "")) { console.error("usage: ci-release.js <owner/repo> <build number>"); process.exit(2); }
const version = "0.1." + run;
const pj = path.join(root, "package.json"), pkg = JSON.parse(fs.readFileSync(pj, "utf8")); pkg.version = version; fs.writeFileSync(pj, JSON.stringify(pkg, null, 2) + "\n");
fs.writeFileSync(path.join(root, "release.json"), JSON.stringify({ githubRepo: repo }, null, 2) + "\n");
const id = String(process.env.AZURE_CLIENT_ID || "").trim(), friendsUrl = String(process.env.FRIENDS_URL || "").trim().replace(/\/+$/, "");
if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { console.error("AZURE_CLIENT_ID doesn't look like an Application (client) ID"); process.exit(2); }
if (friendsUrl && !/^https:\/\/[^\s/]+(\/\S*)?$/.test(friendsUrl)) { console.error("FRIENDS_URL must be an https:// address"); process.exit(2); }
// Keeps what auth.json already ships (such as the owner's Azure ID) unless a repository variable replaces it.
if (id || friendsUrl) { const f = path.join(root, "auth.json"); let cur = {}; try { cur = JSON.parse(fs.readFileSync(f, "utf8")); } catch {} fs.writeFileSync(f, JSON.stringify({ ...cur, ...(id ? { msClientId: id } : {}), ...(friendsUrl ? { friendsUrl } : {}) }, null, 2) + "\n"); }
for (const dir of fs.readdirSync(path.join(root, "client-mod", "adapters"))) {
  const gp = path.join(root, "client-mod", "adapters", dir, "gradle.properties"); if (!fs.existsSync(gp)) continue;
  fs.writeFileSync(gp, fs.readFileSync(gp, "utf8").replace(/^mod_version=.*$/m, "mod_version=" + version));
}
// Exposed to later workflow steps.
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\nsignin=${id ? "yes" : "no"}\n`);
console.log("Version " + version + " for " + repo + (id ? ", with Microsoft sign-in" : ", without a shipped Azure app ID"));
