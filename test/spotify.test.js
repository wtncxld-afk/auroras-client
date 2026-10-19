const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const S = require("../spotify.js");
const CID = "0123456789abcdef0123456789abcdef";
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("PKCE: challenge is the SHA-256 of the verifier; auth URL carries it with a state", () => {
  const p = S.pkce(); assert.strictEqual(p.challenge, crypto.createHash("sha256").update(p.verifier).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  const u = new URL(S.authUrl(CID, p)); assert.deepStrictEqual([u.searchParams.get("code_challenge"), u.searchParams.get("state"), u.searchParams.get("redirect_uri"), u.searchParams.get("code_challenge_method")], [p.challenge, p.state, S.REDIRECT, "S256"]);
  assert.throws(() => S.authUrl("nope", p), /client ID/);
});
test("callback: wrong state, refusal and missing code are refused", () => {
  assert.strictEqual(S.parseCallback("/callback?code=abc&state=s1", "s1"), "abc");
  assert.throws(() => S.parseCallback("/callback?code=abc&state=evil", "s1"), /didn’t match/); assert.throws(() => S.parseCallback("/callback?error=access_denied&state=s1", "s1"), /declined/);
  assert.throws(() => S.parseCallback("/callback?state=s1", "s1"), /code/); assert.throws(() => S.parseCallback("/other?code=a&state=s1", "s1"), /path/);
});
test("now playing: track, podcast, nothing playing", () => {
  const np = S.parseNowPlaying(200, { is_playing: true, progress_ms: 65000, item: { name: "Song", duration_ms: 200000, artists: [{ name: "A" }, { name: "B" }] } }, 5);
  assert.deepStrictEqual(np, { status: "", title: "Song", artist: "A, B", playing: true, progressMs: 65000, durationMs: 200000, at: 5, artId: "", artUrl: "" });
  const withArt = S.parseNowPlaying(200, { is_playing: true, item: { name: "S", duration_ms: 1, album: { id: "alb1", images: [{ url: "https://i.scdn.co/image/big", width: 640 }, { url: "https://i.scdn.co/image/mid", width: 300 }, { url: "https://i.scdn.co/image/small", width: 64 }] } } });
  assert.deepStrictEqual([withArt.artId, withArt.artUrl], ["alb1", "https://i.scdn.co/image/small"]);
  assert.strictEqual(S.pickArt([{ url: "https://evil.example/image/x", width: 64 }]), "", "covers only come from Spotify's image host");
  assert.strictEqual(S.pickArt([{ url: "https://i.scdn.co/image/a", width: 32 }, { url: "https://i.scdn.co/image/b", width: 48 }]), "https://i.scdn.co/image/b");
  assert.strictEqual(S.parseNowPlaying(200, { is_playing: false, item: { name: "Ep", duration_ms: 1, show: { name: "Pod" } } }).artist, "Pod");
  assert.strictEqual(S.parseNowPlaying(204, null).title, "");
});
test("poll: refreshes expiring tokens, reports expiry, offline and rate limits as status, never as fake tracks", async () => {
  const calls = []; const f = async (url, o) => { calls.push(url); if (url.includes("token")) return res(200, { access_token: "new", expires_in: 3600 }); return res(200, { is_playing: true, progress_ms: 1, item: { name: "T", duration_ms: 2, artists: [] } }); };
  const r = await S.poll(f, CID, { refresh: "r", access: "old", expiresAt: 0 }, 1000); assert.strictEqual(r.token.access, "new"); assert.strictEqual(r.token.refresh, "r"); assert.strictEqual(r.np.title, "T"); assert.ok(calls[0].includes("token"));
  assert.strictEqual((await S.poll(f, CID, null)).np.status, "not connected");
  assert.strictEqual((await S.poll(async () => res(400, { error: "invalid_grant" }), CID, { refresh: "r", expiresAt: 0 })).np.status, "sign-in expired");
  const ok = { refresh: "r", access: "a", expiresAt: Date.now() + 1e6 };
  assert.strictEqual((await S.poll(async () => res(429, {}), CID, ok)).np.status, "rate limited, retrying");
  assert.strictEqual((await S.poll(async () => { throw new Error("net"); }, CID, ok)).np.status, "offline");
  const exp = await S.poll(async () => res(401, {}), CID, ok); assert.strictEqual(exp.np.status, "sign-in expired"); assert.strictEqual(exp.token.access, null);
  assert.strictEqual((await S.poll(async () => res(204, null), CID, ok)).np.title, "");
});
test("writes nowplaying.json atomically for the mod", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "aur-sp-")); S.writeNowPlaying(d, { title: "T" });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(d, "nowplaying.json"), "utf8")), { title: "T", artId: "", art: false }); assert.deepStrictEqual(fs.readdirSync(d), ["nowplaying.json"]);
});

test("the mod's reader understands the file the launcher writes", (t) => {
  const { execFileSync } = require("child_process"), core = path.join(__dirname, "..", "client-mod", "core");
  try { execFileSync(process.platform === "win32" ? "where" : "which", ["java"]); } catch { return t.skip("java not available"); }
  if (!fs.existsSync(path.join(core, "out", "gg", "auroras", "core", "NowPlayingCheck.class"))) { try { execFileSync("java", ["Build.java"], { cwd: core, stdio: "pipe" }); } catch { return t.skip("couldn't build the core"); } }
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "aur-np-"));
  S.writeNowPlaying(d, S.parseNowPlaying(200, { is_playing: true, progress_ms: 65000, item: { name: 'Song "Live"', duration_ms: 200000, artists: [{ name: "A" }, { name: "B" }] } }, 5));
  const out = execFileSync("java", ["-cp", path.join(core, "out"), "gg.auroras.core.NowPlayingCheck", path.join(d, "nowplaying.json")], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  assert.strictEqual(out, 'Song "Live"|A, B|true|65000|200000||66000');
  S.writeNowPlaying(d, { ...S.parseNowPlaying(200, { is_playing: false, item: { name: "S", duration_ms: 9, album: { id: "alb9", images: [{ url: "https://i.scdn.co/image/c", width: 64 }] } } }, 5) }, true);
  const f = JSON.parse(fs.readFileSync(path.join(d, "nowplaying.json"), "utf8")); assert.strictEqual(f.artUrl, undefined, "the image URL stays in the launcher"); assert.deepStrictEqual([f.artId, f.art], ["alb9", true]);
  const out2 = execFileSync("java", ["-cp", path.join(core, "out"), "gg.auroras.core.NowPlayingCheck", path.join(d, "nowplaying.json"), "art"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  assert.strictEqual(out2, "alb9|true");
  assert.throws(() => S.writeArt(d, Buffer.from("nope")), /PNG/);
});

// No-account mode: reading the Spotify app's window title from Windows' tasklist.
const SPT = require("../spotify.js");
const row = (title) => `"Spotify.exe","4242","Console","1","120,000 K","Running","PC\\me","0:00:12","${title.replace(/"/g, '""')}"`;
test("no-account mode: a playing song is read from the window title", () => {
  const out = [row("N/A"), row("N/A"), row("Daft Punk - One More Time - Radio Edit")].join("\r\n");
  assert.deepStrictEqual(SPT.parseTasklist(out), { running: true, playing: true, artist: "Daft Punk", title: "One More Time - Radio Edit" });
  const np = SPT.localNowPlaying(SPT.parseTasklist(out), null, 5);
  assert.deepStrictEqual(np, { status: "", title: "One More Time - Radio Edit", artist: "Daft Punk", playing: true, progressMs: 0, durationMs: 0, at: 5, artId: "" });
});
test("no-account mode: paused keeps the last song, closed says to open Spotify", () => {
  const paused = SPT.parseTasklist([row("N/A"), row("Spotify Premium")].join("\n"));
  assert.deepStrictEqual(paused, { running: true, playing: false });
  const last = { status: "", title: "Song", artist: "Band", playing: true, progressMs: 0, durationMs: 0, at: 1, artId: "" };
  assert.deepStrictEqual(SPT.localNowPlaying(paused, last, 9), { ...last, playing: false, at: 9 });
  assert.strictEqual(SPT.localNowPlaying(paused, null, 9).status, "paused");
  const none = SPT.parseTasklist("INFO: No tasks are running which match the specified criteria.");
  assert.deepStrictEqual(none, { running: false }); assert.match(SPT.localNowPlaying(none, last).status, /open Spotify/);
  assert.strictEqual(SPT.parseTasklist(row("Spotify Free")).playing, false);
});
