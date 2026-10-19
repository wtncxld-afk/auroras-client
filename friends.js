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
    overview: (acct) => call(acct, "GET", "/friends"),
    presence: (acct, p) => call(acct, "POST", "/presence", p),
    async act(acct, action, arg) {
      const key = ACTIONS[action]; if (!key) throw new Error("Unknown friends action.");
      const v = String(arg || "").trim(); if (key === "name" ? !/^[A-Za-z0-9_]{3,16}$/.test(v) : !/^[0-9a-f]{32}$/.test(v)) throw new Error(key === "name" ? "Type a Minecraft username (3 to 16 letters, numbers or _)." : "Unknown player.");
      return call(acct, "POST", "/friends/" + action, { [key]: v });
    },
  };
}
module.exports = { createClient, friendsUrl, checkUrl, ACTIONS };
