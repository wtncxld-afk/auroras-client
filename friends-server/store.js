// Auroras friends: the data and rules, with no networking, so every rule is unit-tested. server.js puts it on HTTP.
// Players are identified by their Minecraft UUID, proven through Mojang's session server (see server.js), never by a
// password. Only friends see each other's presence; nobody sees anyone's requests but their own.
const crypto = require("crypto"), fs = require("fs"), path = require("path");

const NAME = /^[A-Za-z0-9_]{3,16}$/, UUID = /^[0-9a-f]{32}$/, SERVER = /^(\[[0-9a-f:]+\]|[a-z0-9.\-_]+)(:\d{1,5})?$/i;
const ONLINE_MS = 90 * 1000, INVITE_MS = 10 * 60 * 1000, CHALLENGE_MS = 2 * 60 * 1000, SESSION_MS = 30 * 24 * 3600 * 1000;
const MAX_FRIENDS = 300, MAX_PENDING = 100;
const STATES = ["online", "playing", "away"];
const err = (code, msg) => Object.assign(new Error(msg), { code });

function createStore({ file = null, now = () => Date.now(), random = (n) => crypto.randomBytes(n).toString("hex") } = {}) {
  // Saved: users, friendships, requests, sessions. Kept in memory only: presence, challenges, invites.
  let D = { users: {}, friends: {}, requests: [], sessions: {} };
  if (file) try { D = { ...D, ...JSON.parse(fs.readFileSync(file, "utf8")) }; } catch {}
  const presence = new Map(), challenges = new Map(); let invites = [];
  let saveTimer = null; const save = () => { if (!file || saveTimer) return; saveTimer = setTimeout(flush, 200); };
  function flush() { saveTimer = null; if (!file) return; fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = file + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(D)); fs.renameSync(tmp, file); }
  const fl = (u) => D.friends[u] || (D.friends[u] = []);
  const areFriends = (a, b) => fl(a).includes(b);
  const user = (u) => { const x = D.users[u]; if (!x) throw err(404, "Unknown player."); return x; };
  const byName = (n) => Object.values(D.users).find((x) => x.name.toLowerCase() === String(n).toLowerCase());

  /** Step 1 of signing in: a one-time server id the launcher hands to Mojang's join endpoint. */
  function challenge(name) {
    if (!NAME.test(String(name))) throw err(400, "That isn’t a Minecraft username.");
    for (const [k, c] of challenges) if (c.exp < now()) challenges.delete(k);
    if (challenges.size > 10000) throw err(429, "Too many sign-ins right now. Try again in a minute.");
    const serverId = random(20); challenges.set(serverId, { name: String(name), exp: now() + CHALLENGE_MS }); return { serverId };
  }
  /** Step 2: Mojang confirmed (profile = hasJoined's answer) that this player joined with that server id. */
  function verify(serverId, name, profile) {
    const c = challenges.get(serverId); challenges.delete(serverId);
    if (!c || c.exp < now() || c.name.toLowerCase() !== String(name).toLowerCase()) throw err(401, "That sign-in expired. Try again.");
    if (!profile || !UUID.test(String(profile.id)) || !NAME.test(String(profile.name)) || profile.name.toLowerCase() !== c.name.toLowerCase()) throw err(401, "Mojang didn’t confirm this account. Sign in to Minecraft again in the launcher.");
    const u = profile.id; D.users[u] = { uuid: u, name: profile.name, joined: (D.users[u] && D.users[u].joined) || new Date(now()).toISOString() };
    const token = random(32); D.sessions[hash(token)] = { uuid: u, exp: now() + SESSION_MS };
    for (const [h, s] of Object.entries(D.sessions)) if (s.exp < now()) delete D.sessions[h];
    save(); return { token, uuid: u, name: profile.name };
  }
  const hash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
  /** Who a session token belongs to, or a 401. */
  function auth(token) { const s = D.sessions[hash(token)]; if (!s || s.exp < now()) throw err(401, "Signed out of Auroras friends. Sign in again."); return s.uuid; }
  function signOut(token) { const s = D.sessions[hash(token)]; if (s) presence.delete(s.uuid); delete D.sessions[hash(token)]; save(); return { ok: true }; }

  function setPresence(u, { state, server, instance } = {}) {
    if (!STATES.includes(state)) throw err(400, "Unknown status.");
    if (server != null && server !== "" && !SERVER.test(String(server))) throw err(400, "That isn’t a server address.");
    presence.set(u, { state, server: state === "playing" && server ? String(server).toLowerCase() : null, instance: state === "playing" && instance ? String(instance).slice(0, 40) : null, seen: now() });
  }
  function offline(u) { presence.delete(u); }
  const statusOf = (u) => { const p = presence.get(u); if (!p || now() - p.seen > ONLINE_MS) return { state: "offline", lastSeen: p ? new Date(p.seen).toISOString() : null }; return { state: p.state, server: p.server, instance: p.instance }; };

  function request(from, name) {
    const to = byName(name); if (!to) throw err(404, `${NAME.test(String(name)) ? name : "That player"} hasn’t signed in to Auroras friends yet. Ask them to open Friends in the launcher once.`);
    if (to.uuid === from) throw err(400, "That’s you.");
    if (areFriends(from, to.uuid)) throw err(409, `You’re already friends with ${to.name}.`);
    const back = D.requests.find((r) => r.from === to.uuid && r.to === from); if (back) return accept(from, to.uuid);
    if (D.requests.some((r) => r.from === from && r.to === to.uuid)) throw err(409, `You’ve already asked ${to.name}.`);
    if (D.requests.filter((r) => r.from === from).length >= MAX_PENDING) throw err(429, "You have too many requests waiting. Cancel some first.");
    if (fl(from).length >= MAX_FRIENDS) throw err(429, `You can have up to ${MAX_FRIENDS} friends.`);
    D.requests.push({ from, to: to.uuid, at: new Date(now()).toISOString() }); save(); return { ok: true, sent: to.name };
  }
  function accept(me, other) {
    const i = D.requests.findIndex((r) => r.from === other && r.to === me); if (i < 0) throw err(404, "That request is gone.");
    if (fl(me).length >= MAX_FRIENDS || fl(other).length >= MAX_FRIENDS) throw err(429, `Friends lists hold up to ${MAX_FRIENDS} people.`);
    D.requests.splice(i, 1); D.requests = D.requests.filter((r) => !(r.from === me && r.to === other));
    if (!areFriends(me, other)) { fl(me).push(other); fl(other).push(me); } save(); return { ok: true, friend: user(other).name };
  }
  function decline(me, other) { D.requests = D.requests.filter((r) => !(r.from === other && r.to === me)); save(); return { ok: true }; }
  function cancel(me, other) { D.requests = D.requests.filter((r) => !(r.from === me && r.to === other)); save(); return { ok: true }; }
  function remove(me, other) { D.friends[me] = fl(me).filter((x) => x !== other); D.friends[other] = fl(other).filter((x) => x !== me); invites = invites.filter((v) => !(v.from === me && v.to === other || v.from === other && v.to === me)); save(); return { ok: true }; }
  /** Ask a friend to join you: they see it in their list for 10 minutes. You must be playing on a server. */
  function invite(me, other) {
    if (!areFriends(me, other)) throw err(403, "You can only invite friends.");
    const s = statusOf(me); if (s.state !== "playing" || !s.server) throw err(409, "Join a server first, then invite friends to it.");
    invites = invites.filter((v) => v.exp > now() && !(v.from === me && v.to === other)); invites.push({ from: me, to: other, server: s.server, exp: now() + INVITE_MS }); return { ok: true };
  }
  /** Everything the launcher shows: friends with presence (sorted online first), requests both ways, live invites. */
  function overview(me) {
    const friends = fl(me).filter((u) => D.users[u]).map((u) => ({ uuid: u, name: D.users[u].name, ...statusOf(u) }));
    const rank = { playing: 0, online: 1, away: 2, offline: 3 }; friends.sort((a, b) => rank[a.state] - rank[b.state] || a.name.localeCompare(b.name));
    return { me: { uuid: me, name: user(me).name }, friends,
      incoming: D.requests.filter((r) => r.to === me && D.users[r.from]).map((r) => ({ uuid: r.from, name: D.users[r.from].name, at: r.at })),
      outgoing: D.requests.filter((r) => r.from === me && D.users[r.to]).map((r) => ({ uuid: r.to, name: D.users[r.to].name, at: r.at })),
      invites: invites.filter((v) => v.to === me && v.exp > now() && areFriends(me, v.from)).map((v) => ({ uuid: v.from, name: D.users[v.from].name, server: v.server, expires: new Date(v.exp).toISOString() })) };
  }
  return { challenge, verify, auth, signOut, setPresence, offline, request, accept, decline, cancel, remove, invite, overview, flush, _data: () => D };
}
module.exports = { createStore, NAME, UUID };
