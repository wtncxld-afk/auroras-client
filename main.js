const { app, BrowserWindow, ipcMain, shell, net, safeStorage, dialog, nativeImage } = require("electron");
const path = require("path"), fs = require("fs"), crypto = require("crypto"), { spawn } = require("child_process");
const launcher = require("./launcher"), launchplan = require("./launchplan");
const modconfig = require("./modconfig");
const capelib = require("./capelib"), serverlist = require("./serverlist");
const securestore = require("./securestore");
// Secrets are only written encrypted by the OS (see securestore.js). If it can't encrypt, they live in memory until quit.
const vault = securestore.createVault({ available: () => safeStorage.isEncryptionAvailable(), encrypt: (t) => safeStorage.encryptString(t), decrypt: (b) => safeStorage.decryptString(b) });
const memSecrets = new Map();
/** The featured server: first in every instance's in-game server list, and the Join button on Home. */
const FEATURED = { name: "VexVanilla", ip: "vexvanilla.net" };
const ziputil = require("./ziputil");

// Modrinth asks every app to send a descriptive User-Agent. Add your GitHub URL or contact email here.
const UA = "AurorasClient/0.1.0 (desktop launcher)";
const HOSTS = new Set(["api.github.com", "api.modrinth.com", "api.curseforge.com", "api.minecraftservices.com", "sessionserver.mojang.com", "piston-meta.mojang.com", "meta.fabricmc.net", "maven.neoforged.net", "files.minecraftforge.net"]);
const versions = require("./versions");
const updater = require("./updater");
const LDM = { Fabric: "fabric", Quilt: "quilt", Forge: "forge", NeoForge: "neoforge" };
const LDC = { Forge: 1, Fabric: 4, Quilt: 5, NeoForge: 6 };

const user = () => app.getPath("userData");
const settingsFile = () => path.join(user(), "settings.json");
const readSettings = () => securestore.readJson(settingsFile());
const writeSettings = (s) => securestore.writePrivate(settingsFile(), JSON.stringify(s));
function cfKey() {
  if (memSecrets.has("cf")) return memSecrets.get("cf");
  const s = readSettings(); if (!s.cf) return "";
  return vault.open({ enc: s.enc, data: s.cf }) || "";
}
/** Keeps the CurseForge key encrypted on disk, or in memory only when this PC can't encrypt. */
function storeCfKey(key) {
  const s = readSettings(), rec = key ? vault.seal(key) : null; delete s.cf; delete s.enc; memSecrets.delete("cf");
  if (rec) { s.enc = true; s.cf = rec.data; } else if (key) memSecrets.set("cf", key);
  writeSettings(s);
}
const instDir = (id) => path.join(user(), "instances", String(id).replace(/[^\w-]/g, "_"));
const manFile = (id) => path.join(instDir(id), "mods.json");
const readMan = (id) => { try { return JSON.parse(fs.readFileSync(manFile(id), "utf8")); } catch { return {}; } };
const writeMan = (id, m) => { fs.mkdirSync(instDir(id), { recursive: true }); fs.writeFileSync(manFile(id), JSON.stringify(m, null, 2)); };

async function getJson(url) {
  const u = new URL(url);
  if (u.protocol !== "https:" || !HOSTS.has(u.hostname)) throw new Error("Blocked host");
  const headers = { "User-Agent": UA, Accept: "application/json" };
  if (u.hostname === "api.curseforge.com") { const k = cfKey(); if (!k) throw new Error("Add your CurseForge API key first"); headers["x-api-key"] = k; }
  const r = await net.fetch(url, { headers });
  if (!r.ok) throw new Error(`${u.hostname} returned ${r.status}`);
  return r.json();
}

async function mrResolve(id, inst) {
  const q = `loaders=${encodeURIComponent(JSON.stringify([LDM[inst.loader]]))}&game_versions=${encodeURIComponent(JSON.stringify([inst.mc]))}`;
  const vs = await getJson(`https://api.modrinth.com/v2/project/${id}/version?${q}`);
  if (!vs.length) throw new Error(`No ${inst.loader} build for ${inst.mc}`);
  const v = vs.find((x) => x.version_type === "release") || vs[0];
  const f = v.files.find((x) => x.primary) || v.files[0];
  const deps = [];
  for (const d of v.dependencies || []) {
    if (d.dependency_type !== "required") continue;
    let pid = d.project_id;
    if (!pid && d.version_id) pid = (await getJson(`https://api.modrinth.com/v2/version/${d.version_id}`)).project_id;
    if (pid) deps.push(["m", pid]);
  }
  return { key: "m:" + id, filename: f.filename, url: f.url, hash: f.hashes && f.hashes.sha512, algo: "sha512", version: v.version_number, deps };
}
async function cfResolve(id, inst) {
  const p = new URLSearchParams({ gameVersion: inst.mc, modLoaderType: LDC[inst.loader], pageSize: 10 });
  const r = await getJson(`https://api.curseforge.com/v1/mods/${id}/files?${p}`);
  const files = r.data || [];
  const f = files.find((x) => x.releaseType === 1) || files[0];
  if (!f) throw new Error(`No ${inst.loader} build for ${inst.mc}`);
  if (!f.downloadUrl) throw new Error("The author doesn’t allow downloads outside CurseForge. Use Open page to get it manually.");
  const h = (f.hashes || []).find((x) => x.algo === 1);
  return { key: "c:" + id, filename: f.fileName, url: f.downloadUrl, hash: h && h.value, algo: "sha1", version: f.displayName,
    deps: (f.dependencies || []).filter((d) => d.relationType === 3).map((d) => ["c", d.modId]) };
}
async function download(r, dir, cb) {
  const u = new URL(r.url);
  if (u.protocol !== "https:" || !(u.hostname === "cdn.modrinth.com" || u.hostname.endsWith(".forgecdn.net"))) throw new Error("Unexpected download host");
  const res = await net.fetch(r.url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const total = +res.headers.get("content-length") || 0, chunks = [], reader = res.body.getReader();
  let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(Buffer.from(value)); got += value.length; if (total) cb(got / total); }
  const buf = Buffer.concat(chunks);
  if (r.hash && crypto.createHash(r.algo).update(buf).digest("hex") !== r.hash.toLowerCase()) throw new Error("Checksum mismatch for " + r.filename);
  const name = path.basename(r.filename).replace(/[^\w.\- +()]/g, "_");
  if (!name.toLowerCase().endsWith(".jar")) throw new Error("Not a .jar file");
  fs.writeFileSync(path.join(dir, name), buf);
  r.filename = name;
}

ipcMain.handle("http", (_e, { url }) => getJson(url));
ipcMain.handle("settings", () => ({ cfKey: !!cfKey() }));
ipcMain.handle("setCfKey", (_e, k) => {
  const key = String(k || "").trim(); if (!key) throw new Error("Empty key");
  storeCfKey(key); return true;
});
ipcMain.handle("installed", (_e, id) => {
  const man = readMan(id), dir = path.join(instDir(id), "mods"), out = {};
  for (const [k, v] of Object.entries(man)) if (fs.existsSync(path.join(dir, v.filename))) out[k] = v;
  return out;
});
ipcMain.handle("deps", async (_e, { id, inst }) => {
  if (!LDM[inst.loader]) return [];
  const r = await mrResolve(id, inst); if (!r.deps.length) return [];
  const ids = r.deps.map((d) => d[1]);
  const ps = await getJson(`https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`);
  return ps.map((p) => p.title);
});
ipcMain.handle("install", async (e, { inst, prov, id }) => {
  if (!LDM[inst.loader]) throw new Error("Pick a Fabric, Quilt, Forge or NeoForge instance first");
  const dir = path.join(instDir(inst.id), "mods"); fs.mkdirSync(dir, { recursive: true });
  const man = readMan(inst.id), seen = new Set(), plan = [];
  const walk = async (p, i) => {
    const k = p + ":" + i; if (seen.has(k) || man[k]) return; seen.add(k);
    const r = p === "m" ? await mrResolve(i, inst) : await cfResolve(i, inst);
    plan.push(r); for (const [dp, di] of r.deps) await walk(dp, di);
  };
  await walk(prov, id);
  const rootKey = prov + ":" + id;
  for (let n = 0; n < plan.length; n++) {
    const r = plan[n];
    await download(r, dir, (f) => e.sender.send("progress", { key: rootKey, pct: Math.round(((n + f) / plan.length) * 100) }));
    man[r.key] = { filename: r.filename, version: r.version }; writeMan(inst.id, man);
  }
  return { installed: Object.fromEntries(plan.map((r) => [r.key, man[r.key]])), count: plan.length };
});
ipcMain.handle("remove", (_e, { instId, key }) => {
  const man = readMan(instId), v = man[key]; if (!v) return true;
  try { fs.unlinkSync(path.join(instDir(instId), "mods", path.basename(v.filename))); } catch {}
  delete man[key]; writeMan(instId, man); return true;
});
ipcMain.handle("save", async (e, { filename, bytes }) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(w, { defaultPath: path.basename(String(filename)) });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, Buffer.from(bytes)); return true;
});
ipcMain.handle("open", (_e, url) => { try { if (new URL(url).protocol === "https:") shell.openExternal(url); } catch {} });
ipcMain.on("win", (e, a) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  if (a === "min") w.minimize(); else if (a === "max") (w.isMaximized() ? w.unmaximize() : w.maximize()); else if (a === "close") w.close();
});

// ---------- Skins ----------
async function skinFor(uuid, name) {
  const prof = await getJson(`https://sessionserver.mojang.com/session/minecraft/profile/${encodeURIComponent(uuid)}`);
  const prop = (prof.properties || []).find((x) => x.name === "textures");
  const skin = prop && JSON.parse(Buffer.from(prop.value, "base64").toString()).textures.SKIN;
  name = prof.name || name;
  if (!skin) return { uuid, name, model: "classic", skin: null };
  const u = new URL(skin.url);
  if (u.protocol !== "https:" || u.hostname !== "textures.minecraft.net") throw new Error("Unexpected skin host");
  const r = await net.fetch(skin.url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("Couldn’t download the skin");
  return { uuid, name, model: skin.metadata && skin.metadata.model === "slim" ? "slim" : "classic", skin: "data:image/png;base64," + Buffer.from(await r.arrayBuffer()).toString("base64") };
}
ipcMain.handle("skin:lookup", async (_e, { name }) => {
  if (!/^\w{3,16}$/.test(String(name))) throw new Error("Usernames are 3-16 letters, numbers or underscores");
  let p; try { p = await getJson("https://api.minecraftservices.com/minecraft/profile/lookup/name/" + name); } catch (e) { if (/404/.test(e.message)) throw new Error("No Minecraft account has that name"); throw e; }
  return skinFor(p.id, p.name);
});
ipcMain.handle("skin:refresh", (_e, uuid) => skinFor(uuid));
// Uploads a 64x64 PNG as the account's skin through Minecraft's official profile API (needs a Microsoft sign-in).
ipcMain.handle("skin:upload", async (_e, { uuid, bytes, variant }) => {
  const png = Buffer.from(bytes || []); if (png.length < 24 || png.length > 64 * 1024 || png.readUInt32BE(0) !== 0x89504e47) throw new Error("That isn’t a PNG skin file.");
  if (png.readUInt32BE(16) !== 64 || png.readUInt32BE(20) !== 64) throw new Error("Skins must be 64×64 pixels.");
  const auth = await mcAuthFor(String(uuid)), form = new FormData();
  form.append("variant", variant === "slim" ? "slim" : "classic"); form.append("file", new Blob([png], { type: "image/png" }), "skin.png");
  const r = await net.fetch("https://api.minecraftservices.com/minecraft/profile/skins", { method: "POST", headers: { Authorization: "Bearer " + auth.token, "User-Agent": UA }, body: form });
  if (r.status === 401) throw new Error("Your sign-in has expired. Remove the account and sign in again.");
  if (r.status === 429) throw new Error("Minecraft is limiting skin changes right now. Try again in a minute.");
  if (!r.ok) throw new Error("Minecraft didn’t accept the skin (" + r.status + ").");
  return skinFor(String(uuid));
});

// ---------- Microsoft sign-in: Microsoft's sign-in window (main way) or a device code (fallback). See README ----------
const msauth = require("./msauth.js"), MSA = msauth.MSA;
// release.json is written by the GitHub release workflow: which repository this copy's downloads come from.
const clientmod = require("./clientmod.js");
let RELEASE = {}; try { RELEASE = JSON.parse(fs.readFileSync(path.join(__dirname, "release.json"), "utf8")); } catch {}
const RELEASES = clientmod.releaseSource(RELEASE.githubRepo, getJson);
/** Release files: only from this repository's own release downloads on github.com (GitHub then redirects to its file host). */
async function ghBytes(url) {
  const u = new URL(url); if (u.protocol !== "https:" || u.hostname !== "github.com" || !u.pathname.startsWith("/" + RELEASE.githubRepo + "/releases/download/")) throw new Error("Unexpected download address");
  const r = await net.fetch(url, { headers: { "User-Agent": UA } }); if (!r.ok) throw new Error("GitHub returned " + r.status);
  return Buffer.from(await r.arrayBuffer());
}
/** Before a Fabric launch: the Auroras mod from the latest release, plus Fabric API (which it needs) from Modrinth. */
const FABRIC_API = "P7dR8mSH";
async function prepareAuroras(I, gameDir, send) {
  if (readSettings().autoMod === false) return null;
  const say = (m) => send("downloading", 0, m);
  const r = await clientmod.ensureMod({ gameDir, mc: String(I.mc), loader: String(I.loader), latest: RELEASES, getBytes: ghBytes, emit: say });
  if (["installed", "updated", "current"].includes(r.status) || (r.status === "offline" && r.kept)) {
    const man = readMan(I.id), mods = path.join(gameDir, "mods");
    const has = man["m:" + FABRIC_API] || (fs.existsSync(mods) && fs.readdirSync(mods).some((f) => /^fabric-api.*\.jar$/i.test(f)));
    if (!has) try {
      say("Downloading Fabric API"); const fr = await mrResolve(FABRIC_API, { loader: "Fabric", mc: String(I.mc) });
      fs.mkdirSync(mods, { recursive: true }); await download(fr, mods, () => {}); man[fr.key] = { filename: fr.filename, version: fr.version }; writeMan(I.id, man);
    } catch (e) { r.fabricApi = "Fabric API couldn’t be downloaded (" + e.message + "). Install it from the Mods page."; }
  }
  return r;
}
let SHIPPED_AUTH = {}; try { SHIPPED_AUTH = JSON.parse(fs.readFileSync(path.join(__dirname, "auth.json"), "utf8")); } catch {}
/** The Azure app ID to use: Settings first, then the one shipped in auth.json. "" when neither is set. */
const msClient = () => msauth.clientId(readSettings(), SHIPPED_AUTH);
async function post(url, body, json) {
  const r = await net.fetch(url, { method: "POST", headers: { "Content-Type": json ? "application/json" : "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": UA }, body: json ? JSON.stringify(body) : new URLSearchParams(body).toString() });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
async function minecraftLogin(msAccessToken) {
  const xbl = await post("https://user.auth.xboxlive.com/user/authenticate", { Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: "d=" + msAccessToken }, RelyingParty: "http://auth.xboxlive.com", TokenType: "JWT" }, true);
  if (xbl.status !== 200) throw new Error(`Xbox Live sign-in failed (${xbl.status})`);
  const xsts = await post("https://xsts.auth.xboxlive.com/xsts/authorize", { Properties: { SandboxId: "RETAIL", UserTokens: [xbl.json.Token] }, RelyingParty: "rp://api.minecraftservices.com/", TokenType: "JWT" }, true);
  if (xsts.status !== 200) { const x = xsts.json.XErr; throw new Error(x === 2148916233 ? "This Microsoft account has no Xbox profile yet. Create one at xbox.com first." : x === 2148916238 ? "This is a child account. An adult must add it to a Microsoft family." : `Xbox authorization failed (${x || xsts.status})`); }
  const mc = await post("https://api.minecraftservices.com/authentication/login_with_xbox", { identityToken: `XBL3.0 x=${xbl.json.DisplayClaims.xui[0].uhs};${xsts.json.Token}` }, true);
  if (mc.status !== 200) throw new Error(`Minecraft services rejected the login (${mc.status}). New Azure apps must be approved by Mojang first.`);
  const pr = await net.fetch("https://api.minecraftservices.com/minecraft/profile", { headers: { Authorization: "Bearer " + mc.json.access_token, "User-Agent": UA } });
  if (pr.status === 404) throw new Error("This Microsoft account doesn’t own Minecraft: Java Edition.");
  if (!pr.ok) throw new Error(`Couldn’t read the Minecraft profile (${pr.status})`);
  const p = await pr.json();
  return { mcToken: mc.json.access_token, expiresIn: +mc.json.expires_in || 3600, uuid: p.id, name: p.name };
}
const accFile = () => path.join(user(), "accounts.json");
const readAcc = () => securestore.readJson(accFile());
const writeAcc = (a) => securestore.writePrivate(accFile(), JSON.stringify(a));
/** The Microsoft refresh token, encrypted by the OS. Without OS encryption it stays in memory and you sign in again next time. */
function saveRefresh(uuid, name, token) {
  const rec = vault.seal(token), a = readAcc(); memSecrets.delete("acc:" + uuid);
  if (rec) a[uuid] = { name, enc: true, refresh: rec.data }; else { a[uuid] = { name }; memSecrets.set("acc:" + uuid, token); }
  writeAcc(a);
}
const readRefresh = (uuid, a) => memSecrets.get("acc:" + uuid) || (a && a.refresh ? vault.open({ enc: a.enc, data: a.refresh }) : null);
function pollSignIn(sender, cid, d) {
  let wait = (d.interval || 5) * 1000; const end = Date.now() + d.expires_in * 1000;
  const done = (p) => { if (!sender.isDestroyed()) sender.send("auth:done", p); };
  const tick = async () => {
    try {
      if (Date.now() > end) return done({ ok: false, error: "The sign-in code expired. Try again." });
      const t = await post(MSA + "/token", { grant_type: "urn:ietf:params:oauth:grant-type:device_code", client_id: cid, device_code: d.device_code });
      if (t.json.error === "authorization_pending") return setTimeout(tick, wait);
      if (t.json.error === "slow_down") { wait += 5000; return setTimeout(tick, wait); }
      if (t.json.error) return done({ ok: false, error: t.json.error === "authorization_declined" ? "Sign-in was declined." : t.json.error_description || "Sign-in failed" });
      done({ ok: true, account: await finishSignIn(t.json) });
    } catch (e) { done({ ok: false, error: e.message }); }
  };
  setTimeout(tick, wait);
}
/** Microsoft tokens -> Minecraft account; keeps the refresh token encrypted on this PC. */
async function finishSignIn(t) {
  const acct = await minecraftLogin(t.access_token);
  if (t.refresh_token) saveRefresh(acct.uuid, acct.name, t.refresh_token);
  tokens.set(acct.uuid, { token: acct.mcToken, name: acct.name, exp: Date.now() + acct.expiresIn * 1000 });
  return { ...(await skinFor(acct.uuid, acct.name)), microsoft: true };
}
/**
 * Sign in with Microsoft in a window, like other launchers: Microsoft's own page in a separate, sandboxed window with
 * a fresh in-memory session (so you can pick any account and nothing is left behind). The launcher never sees your
 * password; it only receives a one-time code at Microsoft's desktop redirect address, checked with PKCE and state.
 */
let authWin = null;
ipcMain.handle("auth:window", async (e) => {
  const cid = msClient(); if (!cid) return { needsClientId: true };
  if (authWin && !authWin.isDestroyed()) { authWin.focus(); return { busy: true }; }
  const p = msauth.pkce(), parent = BrowserWindow.fromWebContents(e.sender);
  const part = "msauth-" + Date.now(), ses = require("electron").session.fromPartition(part, { cache: false }); denyPermissions(ses);
  const w = authWin = new BrowserWindow({ width: 500, height: 680, parent, modal: false, title: "Sign in with Microsoft", autoHideMenuBar: true, backgroundColor: "#ffffff",
    webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: true, spellcheck: false } });
  w.webContents.setWindowOpenHandler(({ url }) => { try { if (new URL(url).protocol === "https:") shell.openExternal(url); } catch {} return { action: "deny" }; });
  const result = await new Promise((resolve) => {
    let settled = false; const finish = (r) => { if (settled) return; settled = true; resolve(r); if (!w.isDestroyed()) w.close(); };
    // Catch the redirect before it loads (it has no page of its own).
    ses.webRequest.onBeforeRequest({ urls: [msauth.REDIRECT + "*"] }, (d, cb) => { cb({ cancel: true }); finish(msauth.parseRedirect(d.url, p.state)); });
    const nav = (ev, url) => { if (msauth.isRedirect(url)) { ev.preventDefault(); finish(msauth.parseRedirect(url, p.state)); } };
    w.webContents.on("will-redirect", nav); w.webContents.on("will-navigate", nav);
    w.webContents.on("did-fail-load", (_ev, code, desc, url, main) => { if (main && !msauth.isRedirect(url) && code !== -3) finish({ error: "Couldn’t load Microsoft’s sign-in page (" + desc + "). Check your internet connection." }); });
    w.on("closed", () => finish({ cancelled: true }));
    w.loadURL(msauth.authorizeUrl(cid, p)).catch(() => {});
  });
  authWin = null; ses.clearStorageData().catch(() => {});
  if (result.cancelled) return { cancelled: true };
  if (result.error) return { ok: false, error: result.error };
  const t = await post(MSA + "/token", msauth.tokenBody(cid, result.code, p.verifier));
  if (t.status !== 200) return { ok: false, error: t.json.error_description ? t.json.error_description.split(/\r?\n/)[0] : "Microsoft didn’t accept the sign-in code (" + t.status + ")." };
  try { return { ok: true, account: await finishSignIn(t.json) }; } catch (x) { return { ok: false, error: x.message }; }
});
ipcMain.handle("auth:cancel", () => { if (authWin && !authWin.isDestroyed()) authWin.close(); return true; });
ipcMain.handle("auth:start", async (e) => {
  // Not set up yet is a normal state, not an error: the window shows the setup steps instead.
  const cid = msClient(); if (!cid) return { needsClientId: true };
  const d = await post(MSA + "/devicecode", { client_id: cid, scope: "XboxLive.signin offline_access" });
  if (d.status !== 200) throw new Error(d.json.error_description || "Couldn’t start Microsoft sign-in");
  pollSignIn(e.sender, cid, d.json);
  return { userCode: d.json.user_code, url: d.json.verification_uri, expiresIn: d.json.expires_in };
});
// Which saved accounts still have a sign-in on this computer (a stored refresh token). Nothing is sent anywhere.
ipcMain.handle("accounts:status", () => { const a = readAcc(); return Object.fromEntries(Object.keys(a).map((k) => [k, { signedIn: !!a[k].refresh || memSecrets.has("acc:" + k), encrypted: !!a[k].enc }])); });
// Live server status (Minecraft's Server List Ping), cached for 20 seconds per address.
const serverping = require("./serverping.js"); const pingCache = new Map();
ipcMain.handle("server:status", async (_e, addr) => {
  const key = String(addr).trim().toLowerCase(), c = pingCache.get(key); if (c && Date.now() - c.at < 20000) return c.v;
  const v = await serverping.ping(key, { timeout: 5000 }); pingCache.set(key, { at: Date.now(), v }); return v;
});
ipcMain.handle("accounts:remove", (_e, uuid) => { const k = String(uuid), a = readAcc(); delete a[k]; writeAcc(a); memSecrets.delete("acc:" + k); tokens.delete(k); friendTokens.delete(k); return true; });
ipcMain.handle("settings:set", (_e, o) => {
  const s = readSettings();
  if (typeof o.msClientId === "string") s.msClientId = /^[0-9a-f-]{36}$/i.test(o.msClientId.trim()) ? o.msClientId.trim() : (o.msClientId.trim() === "" ? "" : (() => { throw new Error("That doesn’t look like an Azure application (client) ID"); })());
  if (typeof o.autoMod === "boolean") s.autoMod = o.autoMod;
  if (typeof o.spotifyClientId === "string") { const v = o.spotifyClientId.trim(); if (v && !/^[0-9a-f]{32}$/i.test(v)) throw new Error("That doesn’t look like a Spotify client ID (32 letters and numbers)."); s.spotifyClientId = v; }
  if (typeof o.friendsUrl === "string") { const v = o.friendsUrl.trim(); if (v && !friends.checkUrl(v)) throw new Error("The friends server address must start with https://"); s.friendsUrl = v ? friends.checkUrl(v) : ""; }
  if (typeof o.updateUrl === "string") { if (o.updateUrl) { if (new URL(o.updateUrl).protocol !== "https:") throw new Error("Update URL must be https"); } s.updateUrl = o.updateUrl.trim(); }
  writeSettings(s); return true;
});
ipcMain.handle("settings:all", () => { const s = readSettings(); return { autoMod: s.autoMod !== false, releaseRepo: RELEASES ? RELEASE.githubRepo : "", cfKey: !!cfKey(), msClientId: s.msClientId || "", msShipped: !!msauth.clientId({}, SHIPPED_AUTH), updateUrl: s.updateUrl || "", friendsUrl: s.friendsUrl || "", friendsShipped: !!friends.friendsUrl({}, SHIPPED_AUTH), spotifyClientId: s.spotifyClientId || "", spotifyConnected: !!readSpotifyToken(), secureStorage: vault.available(), version: app.getVersion() }; });

// ---------- Updates (signed manifest; nothing is applied unless it verifies) ----------
async function fetchBytes(url) { const r = await net.fetch(updater.httpsUrl ? updater.httpsUrl(url) : url, { headers: { "User-Agent": UA } }); if (!r.ok) throw new Error(`Update server returned ${r.status}`); return Buffer.from(await r.arrayBuffer()); }
ipcMain.handle("update:check", async (_e, { channel, mc, loader, installedClient }) => {
  const url = readSettings().updateUrl; if (!url) return { status: "not-configured" };
  let pub; try { pub = fs.readFileSync(path.join(__dirname, "update-public-key.pem"), "utf8"); } catch { return { status: "not-configured", reason: "This build has no update public key" }; }
  if (new URL(url).protocol !== "https:") throw new Error("Update URL must be https");
  const m = updater.verifyManifest(await fetchBytes(url), (await fetchBytes(url + ".sig")).toString("utf8"), pub);
  return { status: "ok", launcher: updater.selectLauncherUpdate(m, app.getVersion(), channel), client: updater.selectClientBuild(m, { mc, loader: String(loader).toLowerCase(), channel, installed: installedClient || undefined }) };
});
ipcMain.handle("update:installClient", async (_e, { instId, build }) => {
  const dir = path.join(instDir(instId), "mods"), target = path.join(dir, "auroras-client.jar"), stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bytes = await fetchBytes(build.url);
  const r = updater.applyFile({ targetPath: target, newBytes: bytes, expectedSha256: build.sha256, backupDir: path.join(instDir(instId), "backups", stamp) });
  if (r.ok) { try { fs.cpSync(path.join(instDir(instId), "config"), path.join(instDir(instId), "backups", stamp, "config"), { recursive: true }); } catch {} fs.writeFileSync(path.join(instDir(instId), "client.json"), JSON.stringify({ version: build.version })); }
  return r.ok ? { ok: true, version: build.version, restartRequired: true } : { ok: false, error: r.error, restored: r.restored };
});

// ---------- Minecraft versions (official metadata, never a hardcoded list) ----------
async function getText(url) {
  const u = new URL(url); if (u.protocol !== "https:" || !HOSTS.has(u.hostname)) throw new Error("Blocked host");
  const r = await net.fetch(url, { headers: { "User-Agent": UA } }); if (!r.ok) throw new Error(`${u.hostname} returned ${r.status}`); return r.text();
}
const vCache = () => path.join(user(), "versions-cache.json");
let lastVersionData = null; // reused for 5 minutes while the dialog switches filters; Refresh clears it
async function loadVersionData() {
  if (lastVersionData && Date.now() - lastVersionData.at < 300000) return lastVersionData.r;
  const r = await loadVersionDataFresh(); if (!r.stale) lastVersionData = { at: Date.now(), r }; return r;
}
async function loadVersionDataFresh() {
  const warnings = [], [m, fg, fl, neo, forge] = await Promise.allSettled([
    getJson("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"), getJson("https://meta.fabricmc.net/v2/versions/game"), getJson("https://meta.fabricmc.net/v2/versions/loader"),
    getText("https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml"), getJson("https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json")]);
  const old = (() => { try { return JSON.parse(fs.readFileSync(vCache(), "utf8")); } catch { return null; } })();
  if (m.status !== "fulfilled") { if (old) return { data: old, stale: true, warnings: ["Couldn’t reach Mojang: " + m.reason.message] }; throw m.reason; }
  const pick = (r, key, fallback, label) => { if (r.status === "fulfilled") return r.value; warnings.push(label + " list unavailable" + (old && old[key] ? ", using the last downloaded one" : "")); return old && old[key] ? old[key] : fallback; };
  const data = { at: Date.now(), manifest: m.value, fabricGames: pick(fg, "fabricGames", [], "Fabric"), fabricLoaders: pick(fl, "fabricLoaders", [], "Fabric loader"), forge: pick(forge, "forge", { promos: {} }, "Forge"),
    neoforge: neo.status === "fulfilled" ? [...neo.value.matchAll(/<version>([^<]+)<\/version>/g)].map((x) => x[1]) : (warnings.push("NeoForge list unavailable"), old ? old.neoforge : []) };
  fs.writeFileSync(vCache(), JSON.stringify(data)); return { data, stale: false, warnings };
}
const compat = require("./compat");
const adaptersTable = () => JSON.parse(fs.readFileSync(path.join(__dirname, "visuals", "adapters.json"), "utf8"));
const validatedMatrix = () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "validated.json"), "utf8")); } catch { return { validated: [] }; } };
// filter: "latest" (newest patch of each release line), "releases" (every release from 1.21), "dev" (snapshots, pre-releases, RCs).
// Always read from Mojang's manifest (cached copy only when offline), so new versions show up without an update.
ipcMain.handle("versions:list", async (_e, { snapshots, filter, refresh } = {}) => {
  if (refresh) lastVersionData = null;
  const { data, stale, warnings } = await loadVersionData(), vm = validatedMatrix();
  const ad = adaptersTable(), f = versions.FILTERS.includes(filter) ? filter : snapshots ? null : "releases";
  return { stale, warnings, filter: f, latest: data.manifest.latest, fetchedAt: data.at, features: ad.features, versions: versions.listVersions(data.manifest, { snapshots: !!snapshots, filter: f }).map((v) => ({ id: v.id, kind: v.kind, stable: v.stable, line: v.line, latest: v.latest, latestInLine: v.latestInLine, base: v.base, releaseTime: v.releaseTime, loaders: versions.loadersFor(v.id, data, vm), auroras: compat.row(v, "fabric", ad, vm) })) };
});
ipcMain.handle("versions:meta", async (_e, id) => {
  const { data } = await loadVersionData(), entry = data.manifest.versions.find((v) => v.id === id); if (!entry) throw new Error("Unknown Minecraft version");
  return { java: versions.javaFor(await getJson(entry.url)) };
});
ipcMain.handle("instance:prepare", (_e, i) => {
  const d = instDir(i.id); for (const s of ["mods", "config", "resourcepacks", "saves", "logs", "hud"]) fs.mkdirSync(path.join(d, s), { recursive: true });
  const f = path.join(d, "instance.json"); let old = {}; try { old = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
  fs.writeFileSync(f, JSON.stringify({ schema: 1, ...old, name: String(i.name || "").slice(0, 32), mc: String(i.mc), loader: String(i.loader), loaderVersion: i.loaderVersion || null, java: i.java || { mode: "auto" }, memMb: Math.max(512, Math.min(65536, (+i.mem || 4) * 1024)), args: String(i.args || ""), client: old.client || null }, null, 2)); return true;
});

// ---------- Launching ----------
const hostEnv = () => ({ os: process.platform === "win32" ? "windows" : process.platform === "darwin" ? "osx" : "linux", arch: process.arch === "arm64" ? "arm64" : process.arch === "ia32" ? "x86" : "x86_64" });
async function fetchBuf(url) {
  if (!launchplan.urlAllowed(url)) throw new Error("Download host not allowed: " + url);
  const r = await net.fetch(url, { headers: { "User-Agent": UA } }); if (!r.ok) throw new Error(`${new URL(url).hostname} returned ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
/** Major version of a Java executable, from "java -version" (printed on stderr). null when it can't be run or read. */
const javaMajor = (p) => new Promise((res) => { try { require("child_process").execFile(p, ["-version"], { timeout: 8000, windowsHide: true }, (err, out, errOut) => res(launcher.parseJavaVersion(String(errOut) + String(out)))); } catch { res(null); } });
const launchDeps = { javaMajor, fetchBytes: fetchBuf, fetchText: async (u) => (await fetchBuf(u)).toString("utf8"), fetchJson: async (u) => JSON.parse((await fetchBuf(u)).toString("utf8")) };
const tokens = new Map(), running = new Set();
/** A fresh Minecraft token for a signed-in account, from the encrypted refresh token. Kept in memory only. */
async function mcAuthFor(uuid) {
  const c = tokens.get(uuid); if (c && c.exp > Date.now() + 60000) return c;
  const a = readAcc()[uuid]; if (!a) throw new Error("This account isn’t signed in on this PC. Remove it and sign in with Microsoft again.");
  const cid = msClient(); if (!cid) throw new Error("Add your Azure app ID in Settings so the sign-in can be refreshed.");
  const refresh = readRefresh(uuid, a); if (!refresh) throw new Error("Couldn’t read the saved sign-in. Remove the account and sign in again.");
  const t = await post(MSA + "/token", { grant_type: "refresh_token", client_id: cid, refresh_token: refresh, scope: "XboxLive.signin offline_access" });
  if (t.status !== 200) throw new Error("Your Microsoft sign-in has expired. Remove the account and sign in again.");
  const acct = await minecraftLogin(t.json.access_token);
  if (acct.uuid !== uuid) throw new Error("That Microsoft login belongs to a different Minecraft account.");
  if (t.json.refresh_token) saveRefresh(acct.uuid, acct.name, t.json.refresh_token);
  const v = { token: acct.mcToken, name: acct.name, exp: Date.now() + acct.expiresIn * 1000 }; tokens.set(uuid, v); return v;
}
const lastModStatus = new Map();
ipcMain.handle("mod:status", (_e, id) => lastModStatus.get(String(id)) || null);
// ---------- Auto-update: download a newer launcher in the background, verify it, then offer "Restart to update" ----------
const selfupdate = require("./selfupdate.js");
let updReady = null, updBusy = false, updTimer = null;
async function selfUpdateTick() {
  if (!RELEASES || updBusy || updReady) return; updBusy = true;
  try { const p = selfupdate.plan(await RELEASES(true), app.getVersion());
    if (p) { updReady = await selfupdate.fetchInstaller(p, path.join(user(), "updates"), ghBytes); updReady.notes = p.notes;
      for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send("update:ready", { version: updReady.version, notes: updReady.notes }); }
  } catch (x) { console.log("[auroras] update: " + x.message); } finally { updBusy = false; }
}
ipcMain.handle("update:auto", (_e, on) => {
  if (updTimer) { clearInterval(updTimer); updTimer = null; }
  if (!on || !RELEASES) return { enabled: false, configured: !!RELEASES };
  setTimeout(selfUpdateTick, 4000); updTimer = setInterval(selfUpdateTick, 20 * 60 * 1000);
  return { enabled: true, configured: true, ready: updReady && { version: updReady.version, notes: updReady.notes } };
});
ipcMain.handle("update:install", () => {
  if (!updReady || !fs.existsSync(updReady.file)) throw new Error("No update is ready yet.");
  if (running.size) throw new Error("Close Minecraft first, then restart to update.");
  // The installer (verified against SHA256SUMS.txt above) runs silently and opens the new launcher when it's done.
  spawn(updReady.file, selfupdate.INSTALL_ARGS, { detached: true, stdio: "ignore", windowsHide: true }).unref();
  setTimeout(() => app.quit(), 300); return true;
});
ipcMain.handle("release:check", async () => { try { return await clientmod.launcherUpdate(RELEASES, app.getVersion()); } catch (e) { return { configured: true, error: e.message }; } });
ipcMain.handle("launch", async (e, { inst: I, uuid, face, head }) => {
  const key = String(I && I.id); if (!I || !/^\d+$/.test(key)) throw new Error("Unknown instance");
  if (running.has(key)) throw new Error("This instance is already starting or running.");
  running.add(key);
  const send = (state, pct, msg) => { if (!e.sender.isDestroyed()) e.sender.send("launch:state", { instId: I.id, state, pct, msg }); };
  try {
    const auth = await mcAuthFor(String(uuid)), gameDir = instDir(I.id);
    if (String(I.loader) === "Fabric") lastModStatus.set(key, await prepareAuroras(I, gameDir, send));
    // Your face for the in-game Auroras menu (8x8 PNG from your skin, made by the launcher page). Never blocks the launch.
    if (typeof face === "string") try { modconfig.writeFace(path.join(gameDir, "config", "auroras"), face); } catch (x) { console.log("[auroras] face not saved: " + x.message); }
    if (typeof head === "string") try { modconfig.writeHead(path.join(gameDir, "config", "auroras"), head); } catch (x) { console.log("[auroras] head not saved: " + x.message); }
    // VexVanilla stays first under Multiplayer in game (the rest of the player's list is untouched). Never blocks the launch.
    try { serverlist.pin(gameDir, FEATURED); } catch (x) { console.log("[auroras] server list not updated: " + x.message); }
    const cmd = await launcher.prepare({
      inst: { id: I.id, mc: String(I.mc), loader: String(I.loader), loaderVersion: I.loaderVersion ? String(I.loaderVersion) : null, memMb: Math.max(512, Math.min(65536, Math.round((+I.mem || 4) * 1024))), args: String(I.args || ""), java: I.java && I.java.mode === "custom" ? { mode: "custom", path: String(I.java.path || "") } : { mode: "auto" }, server: I.server ? String(I.server) : null },
      auth: { name: auth.name, uuid: String(uuid), token: auth.token, xuid: "", clientId: readSettings().msClientId, userType: "msa" } },
      { root: path.join(user(), "game"), gameDir, env: hostEnv(), ...launchDeps, exists: (p) => fs.existsSync(p), emit: send, launcherVersion: app.getVersion() });
    send("launching", 100, "");
    const child = spawn(cmd.file, cmd.args, { cwd: gameDir, windowsHide: false });
    startSpotify(key, path.join(gameDir, "config", "auroras"));
    friendsPlaying.set(String(uuid), { server: I.server ? String(I.server) : null, instance: String(I.name || "") }); pushPresence(String(uuid));
    launcher.supervise(child, { logFile: path.join(gameDir, "logs", "auroras-launch.log"), emit: send }).finally(() => { running.delete(key); stopSpotify(key); friendsPlaying.delete(String(uuid)); pushPresence(String(uuid)); });
    return true;
  } catch (err) { running.delete(key); throw err; }
});

// ---------- Friends (friends-server/): sign in with the Minecraft account, list friends, requests, presence ----------
const friends = require("./friends");
const friendsPlaying = new Map(), friendTokens = new Map();
const friendsBase = () => friends.friendsUrl(readSettings(), SHIPPED_AUTH);
async function friendsHttp(method, url, body, token) {
  const r = await net.fetch(url, { method, headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA, ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body && method !== "GET" ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
/** A friends client for one signed-in Microsoft account. Mojang's join uses the player's own token; it never leaves for the friends server. */
async function friendsFor(uuid) {
  const base = friendsBase(); if (!base) throw new Error("NO_FRIENDS_SERVER");
  const a = readAcc()[uuid]; if (!a) throw new Error("Friends needs a Microsoft account signed in on this PC.");
  const auth = await mcAuthFor(uuid);
  const join = async (serverId) => { const r = await post("https://sessionserver.mojang.com/session/minecraft/join", { accessToken: auth.token, selectedProfile: uuid, serverId }, true); if (r.status !== 204 && r.status !== 200) throw new Error(`Mojang didn’t accept the sign-in (${r.status}). Try again in a minute.`); };
  return { client: friends.createClient({ base, http: friendsHttp, join, tokens: friendTokens }), acct: { uuid, name: auth.name } };
}
/** Tells the friends server what this account is doing: playing (with the server, if any) while a game runs, otherwise online. */
async function pushPresence(uuid, state) {
  try { if (!friendsBase() || !friendTokens.has(uuid)) return; const { client, acct } = await friendsFor(uuid); const g = friendsPlaying.get(uuid);
    await client.presence(acct, state === "offline" ? { state: "offline" } : g ? { state: "playing", server: g.server, instance: g.instance } : { state: state || "online" }); } catch (e) { console.log("[auroras] presence: " + e.message); }
}
ipcMain.handle("friends:state", () => ({ url: friendsBase(), shipped: !!friends.friendsUrl({}, SHIPPED_AUTH) }));
ipcMain.handle("friends:overview", async (_e, uuid) => { const { client, acct } = await friendsFor(String(uuid)); const o = await client.overview(acct); pushPresence(String(uuid)); return o; });
ipcMain.handle("friends:act", async (_e, { uuid, action, arg }) => { const { client, acct } = await friendsFor(String(uuid)); return client.act(acct, String(action), arg); });
ipcMain.handle("friends:presence", (_e, { uuid, state }) => pushPresence(String(uuid), state === "away" ? "away" : state === "offline" ? "offline" : "online"));
app.on("before-quit", () => { for (const u of friendTokens.keys()) pushPresence(u, "offline"); });

// ---------- Auroras mod settings per instance (config/auroras in the instance folder; the mod reads these) ----------
const cfgDir = (id) => { if (!/^\d+$/.test(String(id))) throw new Error("Unknown instance"); return path.join(instDir(id), "config", "auroras"); };
ipcMain.handle("modcfg:read", (_e, id) => modconfig.read(cfgDir(id)));
ipcMain.handle("modcfg:update", (_e, { id, profile, set, activate }) => modconfig.update(cfgDir(id), { profile: String(profile), set: Object(set), activate: !!activate }));
ipcMain.handle("modcfg:assign", (_e, { id, place, profile }) => modconfig.assignPlace(cfgDir(id), String(place), profile === null ? null : String(profile)));

// Vanilla textures for side-by-side previews, read from the player's own downloaded game jar (never bundled).
ipcMain.handle("vanilla:texture", (_e, { mc, path: entry }) => {
  // "any": the most recently downloaded release that has a game jar (the totem creator's real texture when this instance isn't downloaded yet)
  if (mc === "any") { const vd = path.join(user(), "game", "versions"); let best = null;
    try { for (const v of fs.readdirSync(vd)) { if (!/^\d{1,3}\.\d{1,3}(\.\d{1,3})?$/.test(v)) continue; const j = path.join(vd, v, v + ".jar"); try { const t = fs.statSync(j).mtimeMs; if (!best || t > best.t) best = { v, t }; } catch {} } } catch {}
    if (!best) throw new Error("No Minecraft version is downloaded yet"); mc = best.v; }
  if (!/^\d{1,3}\.\d{1,3}(\.\d{1,3})?$/.test(String(mc))) throw new Error("Unknown Minecraft version");
  if (!/^assets\/minecraft\/textures\/[a-z0-9_\/]+\.png$/.test(String(entry)) || String(entry).includes("..")) throw new Error("Only Minecraft textures can be read");
  const jar = path.join(user(), "game", "versions", mc, mc + ".jar"); if (!fs.existsSync(jar)) throw new Error(`Minecraft ${mc} is not downloaded yet`);
  const data = ziputil.readEntry(jar, entry, 1024 * 1024); if (!data) throw new Error("That texture isn’t in this version");
  return { dataUrl: "data:image/png;base64," + data.toString("base64") };
});

// Totem Studio's "Get the real totem": downloads only Minecraft's game jar for this version from Mojang (no sign-in needed).
ipcMain.handle("vanilla:fetch", async (_e, { mc }) => {
  if (!/^\d{1,3}\.\d{1,3}(\.\d{1,3})?$/.test(String(mc))) throw new Error("Unknown Minecraft version");
  await launcher.fetchClientJar(String(mc), { root: path.join(user(), "game"), ...launchDeps }); return { ok: true };
});

// ---------- Spotify now playing (for the Spotify HUD). Polls only while a game is running. ----------
const spotify = require("./spotify"), http = require("http");
const spTokFile = () => path.join(user(), "spotify.json");
function readSpotifyToken() { try { return JSON.parse(memSecrets.get("spotify") || vault.open(securestore.readJson(spTokFile()))); } catch { return null; } }
function writeSpotifyToken(t) { memSecrets.delete("spotify"); if (!t) { try { fs.unlinkSync(spTokFile()); } catch {} return; }
  const txt = JSON.stringify({ refresh: t.refresh, access: t.access, expiresAt: t.expiresAt }), rec = vault.seal(txt);
  if (rec) securestore.writePrivate(spTokFile(), JSON.stringify(rec)); else { try { fs.unlinkSync(spTokFile()); } catch {} memSecrets.set("spotify", txt); } }
const spFetch = (url, o) => { const u = new URL(url); if (u.protocol !== "https:" || !["accounts.spotify.com", "api.spotify.com"].includes(u.hostname)) throw new Error("Blocked host"); return net.fetch(url, o); };
let spServer = null;
ipcMain.handle("spotify:connect", async () => {
  const cid = readSettings().spotifyClientId; if (!cid) throw new Error("Add your Spotify app’s client ID first.");
  if (spServer) { try { spServer.close(); } catch {} spServer = null; }
  const p = spotify.pkce();
  const code = await new Promise((resolve, reject) => {
    const done = (err, c) => { clearTimeout(timer); try { spServer.close(); } catch {} spServer = null; err ? reject(err) : resolve(c); };
    spServer = http.createServer((req, res) => { let c, err; try { c = spotify.parseCallback(req.url, p.state); } catch (e) { err = e; }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(`<p style="font:16px system-ui">${err ? "Spotify sign-in didn’t work. You can close this tab and try again from Auroras." : "Spotify is connected. You can close this tab."}</p>`); done(err, c); });
    spServer.on("error", (e) => done(new Error(e.code === "EADDRINUSE" ? "Port 43117 is busy, so Spotify sign-in can’t finish. Close the program using it and try again." : e.message)));
    spServer.listen(43117, "127.0.0.1", () => shell.openExternal(spotify.authUrl(cid, p)));
    const timer = setTimeout(() => done(new Error("Spotify sign-in timed out.")), 5 * 60 * 1000);
  });
  writeSpotifyToken(await spotify.exchange(spFetch, cid, code, p.verifier)); return true;
});
ipcMain.handle("spotify:disconnect", () => { writeSpotifyToken(null); return true; });
const spPollers = new Map();
function startSpotify(key, configDir) {
  const cid = readSettings().spotifyClientId; if (!cid || !readSpotifyToken()) return startLocalSpotify(key, configDir);
  let busy = false, artId = ""; const tick = async () => { if (busy) return; busy = true;
    try { const r = await spotify.poll(spFetch, cid, readSpotifyToken()); if (r.token) writeSpotifyToken(r.token); else writeSpotifyToken(null);
      // Cover art: downloaded once per album from Spotify's image host, shrunk to 64x64 and saved as PNG for the mod.
      if (r.np.artId && r.np.artId !== artId && r.np.artUrl) { try { const ar = await net.fetch(r.np.artUrl); if (ar.ok) { const img = nativeImage.createFromBuffer(Buffer.from(await ar.arrayBuffer())); if (!img.isEmpty()) { spotify.writeArt(configDir, img.resize({ width: 64, height: 64, quality: "best" }).toPNG()); artId = r.np.artId; } } } catch {} }
      spotify.writeNowPlaying(configDir, r.np, !!r.np.artId && r.np.artId === artId); } catch {} busy = false; };
  tick(); spPollers.set(key, setInterval(tick, 5000));
}
/** No Spotify account connected: on Windows, read what the Spotify app is playing from its window title (see spotify.js). */
function startLocalSpotify(key, configDir) {
  if (process.platform !== "win32") return;
  let busy = false, last = null; const tick = () => { if (busy) return; busy = true;
    require("child_process").execFile("tasklist", ["/v", "/fo", "csv", "/nh", "/fi", "imagename eq Spotify.exe"], { timeout: 5000, windowsHide: true }, (err, out) => {
      busy = false; if (err) return; try { const np = spotify.localNowPlaying(spotify.parseTasklist(out), last); if (np.title) last = np; spotify.writeNowPlaying(configDir, np, false); } catch {} });
  };
  tick(); spPollers.set(key, setInterval(tick, 2500));
}
function stopSpotify(key) { const t = spPollers.get(key); if (t) clearInterval(t); spPollers.delete(key); }

// ---------- HUD layout presets per instance (config/auroras/hud-layouts) ----------
ipcMain.handle("layouts:list", (_e, id) => modconfig.listLayouts(cfgDir(id)));
ipcMain.handle("layouts:save", (_e, { id, name, layout }) => modconfig.saveLayout(cfgDir(id), String(name), Object(layout)));
ipcMain.handle("layouts:delete", (_e, { id, name }) => modconfig.deleteLayout(cfgDir(id), String(name)));
ipcMain.handle("emotes:list", (_e, id) => modconfig.listEmotes(cfgDir(id)));
ipcMain.handle("emotes:save", (_e, { id, emote }) => modconfig.saveEmote(cfgDir(id), emote));
ipcMain.handle("emotes:delete", (_e, { id, emoteId }) => modconfig.deleteEmote(cfgDir(id), String(emoteId)));
ipcMain.handle("cape:write", (_e, { id, png }) => modconfig.writeCape(cfgDir(id), png));
ipcMain.handle("cape:clear", (_e, id) => modconfig.clearCape(cfgDir(id)));
const capeLibDir = () => path.join(user(), "capes");
ipcMain.handle("capelib:list", () => capelib.list(capeLibDir()));
ipcMain.handle("capelib:save", (_e, d) => capelib.save(capeLibDir(), d || {}));
ipcMain.handle("capelib:rename", (_e, d) => capelib.rename(capeLibDir(), d || {}));
ipcMain.handle("capelib:delete", (_e, id) => capelib.remove(capeLibDir(), id));
ipcMain.handle("emotes:wheel", (_e, { id, slots }) => modconfig.saveWheel(cfgDir(id), slots));

/**
 * Earlier versions saved secrets as plain base64 when the OS couldn't encrypt. Re-save them encrypted, or move them
 * to memory and delete them from disk, and make the private files owner-only. Runs once at start.
 */
function migrateSecrets() {
  securestore.lockDir(user());
  try { const s = readSettings(); if (s.cf && !s.enc) { const k = vault.open({ enc: false, data: s.cf }); storeCfKey(k || ""); } else if (fs.existsSync(settingsFile())) writeSettings(s); } catch (x) { console.log("[auroras] settings migration: " + x.message); }
  try { const a = readAcc(); let changed = false;
    for (const [k, v] of Object.entries(a)) if (v && v.refresh && !v.enc) { const t = vault.open({ enc: false, data: v.refresh }); delete v.refresh; delete v.enc; changed = true; if (t) saveRefresh(k, v.name, t); }
    if (changed) { const b = readAcc(); for (const [k, v] of Object.entries(b)) if (v && v.refresh && !v.enc) { delete v.refresh; delete v.enc; } writeAcc(b); } else if (fs.existsSync(accFile())) writeAcc(a);
  } catch (x) { console.log("[auroras] accounts migration: " + x.message); }
  try { const j = securestore.readJson(spTokFile()); if (j.data && !j.enc) { const t = vault.open(j); try { fs.unlinkSync(spTokFile()); } catch {} if (t) writeSpotifyToken(JSON.parse(t)); } } catch (x) { console.log("[auroras] spotify migration: " + x.message); }
}

// Lock down every window: no webviews, no surprise navigation away from the launcher, no camera/mic/location/etc.
app.on("web-contents-created", (_e, c) => {
  c.on("will-attach-webview", (ev) => ev.preventDefault());
});
function lockWindow(w) {
  const home = w.webContents;
  home.on("will-navigate", (ev, url) => { ev.preventDefault(); try { if (new URL(url).protocol === "https:") shell.openExternal(url); } catch {} });
  home.on("will-redirect", (ev) => ev.preventDefault());
}
function denyPermissions(ses) {
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
}

function createWindow() {
  const w = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600, frame: false, backgroundColor: "#0b0d12",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  lockWindow(w);
  w.loadFile(path.join(__dirname, "renderer", "index.html"));
  w.webContents.setWindowOpenHandler(({ url }) => { try { if (new URL(url).protocol === "https:") shell.openExternal(url); } catch {} return { action: "deny" }; });
}
app.whenReady().then(() => { migrateSecrets(); denyPermissions(require("electron").session.defaultSession); createWindow(); app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
