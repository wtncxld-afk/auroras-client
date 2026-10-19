// Spotify "now playing" for the Spotify HUD. The launcher signs in with Spotify (Authorization Code with PKCE, using the
// player's own Spotify app client ID), polls the currently playing track while a game is running, and writes it to
// <instance>/config/auroras/nowplaying.json, which the mod reads off the render thread. Only what Spotify returns is shown.
// Network and time are injected, so everything here is testable offline.
const crypto = require("crypto"), fs = require("fs"), path = require("path");
const AUTH = "https://accounts.spotify.com/authorize", TOKEN = "https://accounts.spotify.com/api/token", NOW = "https://api.spotify.com/v1/me/player/currently-playing";
const SCOPE = "user-read-currently-playing user-read-playback-state";
const REDIRECT = "http://127.0.0.1:43117/callback";
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function pkce() { const verifier = b64url(crypto.randomBytes(48)); return { verifier, challenge: b64url(crypto.createHash("sha256").update(verifier).digest()), state: b64url(crypto.randomBytes(16)) }; }
function authUrl(clientId, p) {
  if (!/^[0-9a-f]{32}$/i.test(String(clientId))) throw new Error("That doesn’t look like a Spotify client ID (32 letters and numbers).");
  return AUTH + "?" + new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: REDIRECT, code_challenge_method: "S256", code_challenge: p.challenge, scope: SCOPE, state: p.state });
}
/** Checks the redirect Spotify sent back. Throws on a wrong state (possible forgery) or a refusal. Returns the code. */
function parseCallback(url, expectedState) {
  const u = new URL(url, "http://127.0.0.1:43117"); if (u.pathname !== "/callback") throw new Error("Unexpected callback path");
  if (u.searchParams.get("state") !== expectedState) throw new Error("Spotify sign-in didn’t match this request. Try again.");
  if (u.searchParams.get("error")) throw new Error(u.searchParams.get("error") === "access_denied" ? "Spotify access was declined." : "Spotify sign-in failed: " + u.searchParams.get("error"));
  const code = u.searchParams.get("code"); if (!code) throw new Error("Spotify didn’t send a sign-in code."); return code;
}
async function tokenRequest(fetchFn, body) {
  const r = await fetchFn(TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body).toString() });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error_description || j.error || "Spotify sign-in failed (" + r.status + ")");
  return { access: j.access_token, refresh: j.refresh_token || body.refresh_token, expiresAt: Date.now() + (j.expires_in || 3600) * 1000 };
}
const exchange = (fetchFn, clientId, code, verifier) => tokenRequest(fetchFn, { grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: verifier });
const refresh = (fetchFn, clientId, refreshToken) => tokenRequest(fetchFn, { grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId });
/** Spotify's currently-playing response to the HUD's fields. 204/empty = nothing playing; podcasts show their episode. */
/** Smallest cover of at least 64 px (Spotify sends 640, 300 and 64), from Spotify's image host only. */
function pickArt(images) {
  if (!Array.isArray(images)) return ""; const ok = images.filter((i) => i && typeof i.url === "string" && /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/.test(i.url));
  if (!ok.length) return ""; const big = ok.filter((i) => (i.width || 0) >= 64).sort((a, b) => a.width - b.width); return (big[0] || ok.sort((a, b) => (b.width || 0) - (a.width || 0))[0]).url;
}
function parseNowPlaying(status, json, now = Date.now()) {
  if (status === 204 || !json || !json.item) return { status: "", title: "", artist: "", playing: false, progressMs: 0, durationMs: 0, at: now };
  const it = json.item, artist = Array.isArray(it.artists) ? it.artists.map((a) => a.name).filter(Boolean).join(", ") : it.show && it.show.name ? it.show.name : "";
  const imgs = (it.album && it.album.images) || it.images || (it.show && it.show.images), artUrl = pickArt(imgs), artId = artUrl ? String((it.album && it.album.id) || it.id || artUrl.split("/").pop()).replace(/[^A-Za-z0-9]/g, "").slice(0, 40) : "";
  return { status: "", title: String(it.name || "").slice(0, 120), artist: String(artist).slice(0, 120), playing: !!json.is_playing, progressMs: Math.max(0, json.progress_ms | 0), durationMs: Math.max(0, it.duration_ms | 0), at: now, artId, artUrl };
}
const statusOnly = (status, now = Date.now()) => ({ status, title: "", artist: "", playing: false, progressMs: 0, durationMs: 0, at: now });
/** One poll: refreshes the token when needed. Returns { np, token }. Errors become a status line, never invented track data. */
async function poll(fetchFn, clientId, token, now = Date.now()) {
  if (!token || !token.refresh) return { np: statusOnly("not connected", now), token };
  let t = token;
  try { if (!t.access || t.expiresAt < now + 30000) t = await refresh(fetchFn, clientId, t.refresh); } catch (e) { return { np: statusOnly("sign-in expired", now), token: null }; }
  try {
    const r = await fetchFn(NOW, { headers: { Authorization: "Bearer " + t.access } });
    if (r.status === 401) return { np: statusOnly("sign-in expired", now), token: { ...t, access: null } };
    if (r.status === 429) return { np: statusOnly("rate limited, retrying", now), token: t };
    if (r.status !== 200 && r.status !== 204) return { np: statusOnly("unavailable", now), token: t };
    return { np: parseNowPlaying(r.status, r.status === 204 ? null : await r.json(), now), token: t };
  } catch { return { np: statusOnly("offline", now), token: t }; }
}
/** Writes nowplaying.json for the mod. artUrl stays in the launcher; "art" says whether nowplaying-art.png holds this artId's cover. */
function writeNowPlaying(configDir, np, artReady = false) { fs.mkdirSync(configDir, { recursive: true }); const { artUrl, ...rest } = np, f = path.join(configDir, "nowplaying.json"), tmp = f + ".tmp"; fs.writeFileSync(tmp, JSON.stringify({ ...rest, artId: rest.artId || "", art: !!(artReady && rest.artId) })); fs.renameSync(tmp, f); }
/** Saves a cover (already resized to a 64x64 PNG by the caller) atomically next to nowplaying.json. */
function writeArt(configDir, png) { if (!Buffer.isBuffer(png) || png.length < 8 || png.readUInt32BE(0) !== 0x89504e47) throw new Error("Not a PNG"); fs.mkdirSync(configDir, { recursive: true }); const f = path.join(configDir, "nowplaying-art.png"), tmp = f + ".tmp"; fs.writeFileSync(tmp, png); fs.renameSync(tmp, f); }
/**
 * No-account mode (Windows): the Spotify desktop app names its window "Artist - Song" while a song plays and
 * "Spotify Premium" / "Spotify Free" / "Spotify" when paused. `tasklist /v /fo csv /nh /fi "imagename eq Spotify.exe"`
 * lists its windows; nothing is sent anywhere and no sign-in is needed. No cover art or progress in this mode.
 */
const csvRow = (line) => { const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) { const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; }
  out.push(cur); return out; };
function parseTasklist(text) {
  const titles = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => /^"spotify\.exe"/i.test(l)).map((l) => csvRow(l).pop() || "");
  if (!titles.length) return { running: false };
  const song = titles.find((t) => t.includes(" - ") && !/^spotify\b/i.test(t));
  if (song) { const i = song.indexOf(" - "); return { running: true, playing: true, artist: song.slice(0, i).trim().slice(0, 120), title: song.slice(i + 3).trim().slice(0, 120) }; }
  return { running: true, playing: false };
}
/** Turns one window reading into what the HUD shows. A paused song keeps its last title, marked paused. */
function localNowPlaying(read, last, now = Date.now()) {
  if (!read.running) return statusOnly("open Spotify to show what's playing", now);
  if (read.playing) return { status: "", title: read.title, artist: read.artist, playing: true, progressMs: 0, durationMs: 0, at: now, artId: "" };
  if (last && last.title) return { ...last, status: "", playing: false, at: now };
  return statusOnly("paused", now);
}
module.exports = { parseTasklist, localNowPlaying, REDIRECT, SCOPE, pkce, authUrl, parseCallback, exchange, refresh, parseNowPlaying, pickArt, poll, writeNowPlaying, writeArt };
