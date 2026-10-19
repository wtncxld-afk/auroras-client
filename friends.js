// Launcher side of Auroras friends: signs in to the friends server (friends-server/) with the player's Minecraft
// account the way a Minecraft server checks a joining player, then lists friends and sends requests. Pure logic: the
// HTTP call and Mojang's join are passed in, so tests run without the network.
const ACTIONS = { request: "name", accept: "uuid", decline: "uuid", cancel: "uuid", remove: "uuid", invite: "uuid" };

/** The friends server address: Settings first, then the one shipped in auth.json. Must be https (http only for localhost). */
function friendsUrl(settings, shipped) {
  for (const v of [settings && settings.friendsUrl, shipped && shipped.friendsUrl]) { const u = checkUrl(v); if (u) return u; }
  return "";
}
function checkUrl(v) {
  const s = String(v || "").trim().replace(/\/+$/, ""); if (!s) return "";
  let u; try { u = new URL(s); } catch { return ""; }
  return u.protocol === "https:" || (u.protocol === "http:" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) ? s : "";
}

/**
 * http(method, url, body, token) -> { status, json }. join(serverId) tells Mojang the player is joining with serverId
 * (POST sessionserver /session/minecraft/join with the player's own Minecraft token). tokens is a Map uuid -> session.
 */
function createClient({ base, http, join, tokens = new Map() }) {
  const fail = (r) => { const e = new Error((r.json && r.json.error) || `The friends server answered ${r.status}.`); e.status = r.status; return e; };
  async function signIn(acct) {
    const c = await http("POST", base + "/auth/challenge", { name: acct.name });
    if (c.status !== 200) throw fail(c);
    await join(c.json.serverId);
    const v = await http("POST", base + "/auth/verify", { name: acct.name, serverId: c.json.serverId });
    if (v.status !== 200) throw fail(v);
    if (v.json.uuid !== acct.uuid) throw new Error("The friends server signed in a different Minecraft account.");
    tokens.set(acct.uuid, v.json.token); return v.json;
  }
  /** One call as this account; signs in first if needed, and once more if the server forgot the session. */
  async function call(acct, method, p, body) {
    if (!tokens.has(acct.uuid)) await signIn(acct);
    let r = await http(method, base + p, body, tokens.get(acct.uuid));
    if (r.status === 401) { tokens.delete(acct.uuid); await signIn(acct); r = await http(method, base + p, body, tokens.get(acct.uuid)); }
    if (r.status !== 200) throw fail(r); return r.json;
  }
  return {
    signIn, call,
    overview: async (acct) => cleanOverview(await call(acct, "GET", "/friends")),
    presence: (acct, p) => call(acct, "POST", "/presence", p),
    async act(acct, action, arg) {
      const key = ACTIONS[action]; if (!key) throw new Error("Unknown friends action.");
      const v = String(arg || "").trim(); if (key === "name" ? !/^[A-Za-z0-9_]{3,16}$/.test(v) : !/^[0-9a-f]{32}$/.test(v)) throw new Error(key === "name" ? "Type a Minecraft username (3 to 16 letters, numbers or _)." : "Unknown player.");
      return call(acct, "POST", "/friends/" + action, { [key]: v });
    },
  };
}
/**
 * The friends server is someone else's computer, so everything it sends is checked before the launcher shows it:
 * only real Minecraft names and ids, known states and plain server addresses get through; anything else is dropped.
 */
const NAME = /^[A-Za-z0-9_]{1,16}$/, UUID = /^[0-9a-f]{32}$/, ADDR = /^[A-Za-z0-9.\-]{1,253}(:\d{1,5})?$/, STATES = ["online", "playing", "away", "offline"];
const person = (p) => p && UUID.test(String(p.uuid)) && NAME.test(String(p.name)) ? { uuid: String(p.uuid), name: String(p.name) } : null;
const addr = (v) => (typeof v === "string" && ADDR.test(v) ? v : null);
const list = (v, f, max = 500) => (Array.isArray(v) ? v.slice(0, max).map(f).filter(Boolean) : []);
function cleanOverview(o) {
  if (!o || typeof o !== "object") throw new Error("The friends server sent something Auroras couldn’t read.");
  const me = person(o.me); if (!me) throw new Error("The friends server sent something Auroras couldn’t read.");
  return {
    me,
    friends: list(o.friends, (f) => { const p = person(f); if (!p) return null; const state = STATES.includes(f.state) ? f.state : "offline", out = { ...p, state };
      if (state === "offline") out.lastSeen = typeof f.lastSeen === "string" && !isNaN(Date.parse(f.lastSeen)) ? new Date(Date.parse(f.lastSeen)).toISOString() : null;
      else { out.server = state === "playing" ? addr(f.server) : null; if (typeof f.instance === "string") out.instance = f.instance.slice(0, 32); }
      return out; }),
    incoming: list(o.incoming, person), outgoing: list(o.outgoing, person),
    invites: list(o.invites, (v) => { const p = person(v), s = addr(v && v.server); return p && s ? { ...p, server: s } : null; }, 50),
  };
}
module.exports = { createClient, friendsUrl, checkUrl, cleanOverview, ACTIONS };
