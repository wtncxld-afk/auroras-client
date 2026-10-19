// Auroras friends server: a small HTTP JSON API with no dependencies (Node 18+). Run: node server.js
// Settings come from the environment: PORT (default 8787), DATA (default ./data/friends.json).
// Put it behind HTTPS (a reverse proxy such as Caddy or your host's TLS) before players use it: session tokens travel in
// the Authorization header.
//
// Sign-in works the way Minecraft servers check players: the launcher asks for a one-time server id, tells Mojang's
// session server it is joining with that id (using the player's own Minecraft token, which never reaches this server),
// and this server asks Mojang whether that player joined. No passwords, emails or Microsoft tokens are ever sent here.
const http = require("http"), path = require("path");
const { createStore } = require("./store");

const MOJANG = "https://sessionserver.mojang.com/session/minecraft/hasJoined";
/** Mojang's answer for (name, serverId): the profile { id, name } when that player joined, otherwise null. */
async function mojangHasJoined(name, serverId) {
  const r = await fetch(`${MOJANG}?username=${encodeURIComponent(name)}&serverId=${encodeURIComponent(serverId)}`, { signal: AbortSignal.timeout(8000) });
  if (r.status === 204) return null; if (!r.ok) throw Object.assign(new Error("Mojang’s session server didn’t answer. Try again."), { code: 503 });
  const j = await r.json(); return { id: j.id, name: j.name };
}

function createServer({ store = createStore(), hasJoined = mojangHasJoined, now = () => Date.now(), limit = 120 } = {}) {
  const hits = new Map(); // per address, requests in the current minute
  const limited = (ip) => { const m = Math.floor(now() / 60000), h = hits.get(ip); if (!h || h.m !== m) { hits.set(ip, { m, n: 1 }); if (hits.size > 50000) hits.clear(); return false; } return ++h.n > limit; };
  // Oversized bodies are read to the end and dropped (not cut off), so the client still gets its 413.
  const body = (req) => new Promise((ok, no) => { let n = 0; const parts = []; req.on("data", (c) => { n += c.length; if (n <= 8192) parts.push(c); else if (n > 1 << 20) req.destroy(); });
    req.on("end", () => { if (n > 8192) return no(Object.assign(new Error("Request too large."), { code: 413 })); if (!n) return ok({}); try { const j = JSON.parse(Buffer.concat(parts).toString("utf8")); ok(j && typeof j === "object" ? j : {}); } catch { no(Object.assign(new Error("That isn’t JSON."), { code: 400 })); } }); req.on("error", no); });
  const token = (req) => { const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization || ""); if (!m) throw Object.assign(new Error("Sign in first."), { code: 401 }); return m[1]; };
  const me = (req) => store.auth(token(req));
  const uuidArg = (b) => { const u = String(b.uuid || ""); if (!/^[0-9a-f]{32}$/.test(u)) throw Object.assign(new Error("Unknown player."), { code: 400 }); return u; };

  const routes = {
    "GET /health": () => ({ ok: true, service: "auroras-friends" }),
    "POST /auth/challenge": (req, b) => store.challenge(b.name),
    "POST /auth/verify": async (req, b) => store.verify(String(b.serverId || ""), String(b.name || ""), await hasJoined(String(b.name || ""), String(b.serverId || ""))),
    "POST /auth/signout": (req) => store.signOut(token(req)),
    "GET /friends": (req) => store.overview(me(req)),
    "POST /presence": (req, b) => { const u = me(req); b.state === "offline" ? store.offline(u) : store.setPresence(u, b); return { ok: true }; },
    "POST /friends/request": (req, b) => store.request(me(req), String(b.name || "")),
    "POST /friends/accept": (req, b) => store.accept(me(req), uuidArg(b)),
    "POST /friends/decline": (req, b) => store.decline(me(req), uuidArg(b)),
    "POST /friends/cancel": (req, b) => store.cancel(me(req), uuidArg(b)),
    "POST /friends/remove": (req, b) => store.remove(me(req), uuidArg(b)),
    "POST /friends/invite": (req, b) => store.invite(me(req), uuidArg(b)),
  };
  return http.createServer(async (req, res) => {
    const send = (code, obj) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(JSON.stringify(obj)); };
    try {
      const ip = (req.socket.remoteAddress || "") + ""; if (limited(ip)) return send(429, { error: "Too many requests. Slow down a little." });
      const route = routes[req.method + " " + new URL(req.url, "http://x").pathname]; if (!route) return send(404, { error: "Not found." });
      const b = req.method === "POST" ? await body(req) : {}; send(200, await route(req, b));
    } catch (e) { const code = Number.isInteger(e.code) && e.code >= 400 && e.code < 600 ? e.code : 500; if (code === 500) console.error(e); send(code, { error: code === 500 ? "Something went wrong on the friends server." : e.message }); }
  });
}

if (require.main === module) {
  const store = createStore({ file: process.env.DATA || path.join(__dirname, "data", "friends.json") });
  const port = Number(process.env.PORT) || 8787; createServer({ store }).listen(port, () => console.log(`Auroras friends server on port ${port}`));
  for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { store.flush(); process.exit(0); });
}
module.exports = { createServer, mojangHasJoined };
