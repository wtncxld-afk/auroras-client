// Launcher auto-update (selfupdate.js): picks the newer release's installer, verifies it against SHA256SUMS.txt.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const U = require("../selfupdate.js");
const R = "https://github.com/me/auroras/releases/download/v0.2.0/";
const exe = Buffer.from("MZ fake installer bytes"), sum = crypto.createHash("sha256").update(exe).digest("hex");
const rel = (tag, extra = []) => ({ tag_name: tag, body: "Added Halloween backgrounds", assets: [{ name: `AurorasClientSetup-${tag.slice(1)}.exe`, browser_download_url: R + `AurorasClientSetup-${tag.slice(1)}.exe`, size: exe.length }, { name: "SHA256SUMS.txt", browser_download_url: R + "SHA256SUMS.txt" }, ...extra] });
const bytes = (map) => async (u) => { if (!(u in map)) throw new Error("unexpected " + u); return map[u]; };

test("only a newer release with an installer and checksums is offered", () => {
  const p = U.plan(rel("v0.2.0"), "0.1.0");
  assert.deepStrictEqual(p, { version: "0.2.0", exe: { name: "AurorasClientSetup-0.2.0.exe", url: R + "AurorasClientSetup-0.2.0.exe", size: exe.length }, sumsUrl: R + "SHA256SUMS.txt", notes: "Added Halloween backgrounds" });
  assert.strictEqual(U.plan(rel("v0.1.0"), "0.1.0"), null); assert.strictEqual(U.plan(rel("v0.0.9"), "0.1.0"), null);
  assert.strictEqual(U.plan({ tag_name: "v0.2.0", assets: [{ name: "a.exe", browser_download_url: R + "a.exe" }] }, "0.1.0"), null, "no checksums, no update");
  assert.strictEqual(U.plan(null, "0.1.0"), null);
});
test("downloads, verifies, and reuses an already downloaded installer", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auroras-upd-")), p = U.plan(rel("v0.2.0"), "0.1.0");
  fs.writeFileSync(path.join(dir, "AurorasClientSetup-0.1.5.exe"), "old");
  let n = 0; const get = async (u) => { n++; return bytes({ [R + "SHA256SUMS.txt"]: Buffer.from(`${sum}  AurorasClientSetup-0.2.0.exe\n${"0".repeat(64)}  other.jar\n`), [R + "AurorasClientSetup-0.2.0.exe"]: exe })(u); };
  const r = await U.fetchInstaller(p, dir, get);
  assert.deepStrictEqual(r, { file: path.join(dir, "AurorasClientSetup-0.2.0.exe"), version: "0.2.0" }); assert.deepStrictEqual(fs.readFileSync(r.file), exe);
  assert.deepStrictEqual(fs.readdirSync(dir), ["AurorasClientSetup-0.2.0.exe"], "older downloads are cleaned up"); assert.strictEqual(n, 2);
  await U.fetchInstaller(p, dir, get); assert.strictEqual(n, 3, "second time only re-reads the checksums");
});
test("a tampered or unlisted installer is never kept", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auroras-upd-")), p = U.plan(rel("v0.2.0"), "0.1.0");
  await assert.rejects(U.fetchInstaller(p, dir, bytes({ [R + "SHA256SUMS.txt"]: Buffer.from(`${sum}  AurorasClientSetup-0.2.0.exe\n`), [R + "AurorasClientSetup-0.2.0.exe"]: Buffer.from("evil") })), /didn't match its checksum/);
  assert.deepStrictEqual(fs.readdirSync(dir), []);
  await assert.rejects(U.fetchInstaller(p, dir, bytes({ [R + "SHA256SUMS.txt"]: Buffer.from("") })), /no checksum/);
  assert.deepStrictEqual(U.INSTALL_ARGS, ["/S", "--updated", "--force-run"]);
});
