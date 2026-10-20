// Used by .github/workflows/website-release.yml. Talks to the site's CI API with a CI token; never touches the database.
//   draft:   node --import tsx scripts/ci-release.ts draft --dir files --version 0.2.0 [--channel stable]
//            Creates a draft launcher release (installer) and a draft client-mod release (jars), uploads the files,
//            checks every server-computed SHA-256 against SHA256SUMS.txt, and writes the release ids to $GITHUB_OUTPUT.
//   publish: node --import tsx scripts/ci-release.ts publish --ids <id>,<id>
//            Runs the preflight checks and publishes. Needs a token with the releases:publish scope.
// Env: AURORAS_SITE_URL (https://...), AURORAS_SITE_CI_TOKEN.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2), cmd = args[0];
const opt = (n: string, d?: string) => { const i = args.indexOf("--" + n); return i > 0 ? args[i + 1] : d; };
const SITE = (process.env.AURORAS_SITE_URL || "").replace(/\/$/, ""), TOKEN = process.env.AURORAS_SITE_CI_TOKEN || "";
if (!/^https:\/\//.test(SITE) && !process.env.ALLOW_HTTP_FOR_TESTS) throw new Error("AURORAS_SITE_URL must be an https:// URL");
if (!TOKEN) throw new Error("AURORAS_SITE_CI_TOKEN is not set");

async function call(method: string, p: string, body?: unknown, raw?: Buffer) {
  const r = await fetch(SITE + p, { method, headers: { Authorization: "Bearer " + TOKEN, "Content-Type": raw ? "application/octet-stream" : "application/json" }, body: raw ? new Uint8Array(raw) : body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch {} // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status}: ${j?.error?.message ?? t.slice(0, 300)}`);
  return j;
}
function sums(dir: string) {
  const f = path.join(dir, "SHA256SUMS.txt"), m = new Map<string, string>();
  if (fs.existsSync(f)) for (const line of fs.readFileSync(f, "utf8").split("\n")) { const x = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line.trim()); if (x) m.set(x[2], x[1]); }
  return m;
}
async function upload(id: string, dir: string, file: string, q: Record<string, string>, expected: Map<string, string>) {
  const buf = fs.readFileSync(path.join(dir, file));
  const { asset } = await call("PUT", `/api/ci/releases/${id}/assets?` + new URLSearchParams({ filename: file, ...q }), undefined, buf);
  const want = expected.get(file);
  if (want && want !== asset.sha256) throw new Error(`Checksum mismatch for ${file}: server ${asset.sha256}, SHA256SUMS ${want}`);
  console.log(`uploaded ${file} sha256=${asset.sha256}${want ? " (matches SHA256SUMS.txt)" : ""}`);
}

async function main() {
  if (cmd === "draft") {
    const dir = opt("dir", "files")!, version = opt("version")!.replace(/^v/, ""), channel = opt("channel", "stable")!;
    const files = fs.readdirSync(dir), expected = sums(dir), ids: string[] = [];
    const exe = files.find((f) => /^AurorasClientSetup-.+\.exe$/.test(f));
    if (!exe) throw new Error("No AurorasClientSetup-*.exe in " + dir);
    const notes = { title: `Auroras Client ${version}`, summary: opt("summary", "") };
    const launcher = (await call("POST", "/api/ci/releases", { version, channel, ...notes })).release;
    await upload(launcher.id, dir, exe, { kind: "installer", platform: "windows", arch: "x64" }, expected);
    ids.push(launcher.id);
    const jars = files.filter((f) => /^auroras-client-fabric-[0-9.]+\.jar$/.test(f));
    if (jars.length) {
      const mod = (await call("POST", "/api/ci/releases", { version, channel, moduleSlug: "auroras-client-mod", title: `Auroras client mod ${version}` })).release;
      for (const j of jars) await upload(mod.id, dir, j, { kind: "mod_jar", platform: "any", arch: "any", mc: /fabric-([0-9.]+)\.jar$/.exec(j)![1], loader: "fabric" }, expected);
      ids.push(mod.id);
    }
    console.log("Draft release ids: " + ids.join(","));
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `ids=${ids.join(",")}\n`);
  } else if (cmd === "publish") {
    const ids = (opt("ids") || "").split(",").filter(Boolean);
    if (!ids.length) throw new Error("Give --ids");
    for (const id of ids) {
      const pf = await call("GET", `/api/ci/releases/${id}/preflight`);
      for (const c of pf.checks) console.log(`${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`);
      if (!pf.ok) throw new Error("Preflight failed for " + id);
    }
    for (const id of ids) { const r = await call("POST", `/api/ci/releases/${id}/publish`, { confirm: true }); console.log("published", id, JSON.stringify(r.hooks ?? [])); }
  } else { console.log("Commands: draft, publish"); process.exitCode = 2; }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
