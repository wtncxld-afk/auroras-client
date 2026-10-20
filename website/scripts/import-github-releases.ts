// Imports the project's GitHub releases into the database as published release records (files stay on GitHub).
//   npm run import:github                 import src/data/github-releases.json (skips versions that exist)
//   npm run import:github -- --refresh    first rebuild that snapshot from the GitHub REST API and local git tags
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { closeDb } from "@/db";
import { importSnapshot, type Snapshot } from "@/lib/importer";

const FILE = path.join(__dirname, "..", "src", "data", "github-releases.json");
async function refresh(repo: string) {
  const gh = async (u: string) => { const r = await fetch(u, { headers: { Accept: "application/vnd.github+json", "User-Agent": "auroras-website-import" } }); if (!r.ok) throw new Error(u + " -> " + r.status); return r; };
  const list = (await (await gh(`https://api.github.com/repos/${repo}/releases?per_page=100`)).json()) as { tag_name: string; draft: boolean; published_at: string; body: string; html_url: string; assets: { name: string; size: number; browser_download_url: string }[] }[];
  const rels = list.filter((r) => !r.draft && /^v\d+\.\d+\.\d+$/.test(r.tag_name)).sort((a, b) => a.tag_name.localeCompare(b.tag_name, undefined, { numeric: true }));
  const out: Snapshot["releases"] = []; let prev: string | null = null;
  for (const r of rels) {
    const sumsAsset = r.assets.find((a) => a.name === "SHA256SUMS.txt");
    if (!sumsAsset) { console.warn("skipping " + r.tag_name + ": no SHA256SUMS.txt"); continue; }
    const sums = Object.fromEntries((await (await gh(sumsAsset.browser_download_url)).text()).trim().split("\n").map((l) => { const [h, n] = l.trim().split(/\s+/); return [n, h]; }));
    let commits: string[] = [];
    try { commits = execFileSync("git", ["log", "--no-merges", "--format=%s", prev ? `${prev}..${r.tag_name}` : r.tag_name], { encoding: "utf8" }).trim().split("\n").filter(Boolean); } catch { console.warn("no git history for " + r.tag_name); }
    out.push({ version: r.tag_name.slice(1), publishedAt: r.published_at, body: r.body || "", htmlUrl: r.html_url, commits, assets: r.assets.filter((a) => a.name !== "SHA256SUMS.txt" && sums[a.name]).map((a) => ({ name: a.name, size: a.size, sha256: sums[a.name], url: a.browser_download_url })) });
    prev = r.tag_name;
  }
  const snap = { ...JSON.parse(fs.readFileSync(FILE, "utf8")), repo, releases: out.map((r) => ({ tag: "v" + r.version, ...r })) };
  fs.writeFileSync(FILE, JSON.stringify(snap, null, 1) + "\n");
  console.log("Snapshot refreshed:", out.length, "releases");
}
async function main() {
  const snap = JSON.parse(fs.readFileSync(FILE, "utf8")) as Snapshot;
  if (process.argv.includes("--refresh")) await refresh(snap.repo);
  console.log("Imported", await importSnapshot(JSON.parse(fs.readFileSync(FILE, "utf8"))), "release record(s).");
}
main().then(closeDb).catch(async (e) => { console.error("Import failed:", e.message); await closeDb(); process.exit(1); });
