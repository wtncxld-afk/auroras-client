// Friends: the server's rules (friends-server/store.js), its HTTP API, and the launcher's client (friends.js) talking to
// a real running server on localhost. Mojang is stood in for by a fake session server with the same join/hasJoined
// contract: join records (serverId -> profile) using the player's token, hasJoined answers from that record.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path");
const { createStore } = require("../friends-server/store.js"), { createServer } = require("../friends-server/server.js");
const F = require("../friends.js");
const U = { steve: { uuid: "a".repeat(32), name: "Steve" }, alex: { uuid: "b".repeat(32), name: "Alex" }, cxld: { uuid: "c".repeat(32), name: "cxld" } };

function fakeMojang() { const joined = new Map(); return { join: (acct) => async (serverId) => { joined.set(serverId, { id: acct.uuid, name: acct.name }); }, hasJoined: async (name, sid) => { const p = joined.get(sid); return p && p.name.toLowerCase() === name.toLowerCase() ? p : null; } }; }
async function start(opts = {}) {
  const mj = fakeMojang(), store = createStore(opts), srv = createServer({ store, hasJoined: mj.hasJoined, ...opts.server });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const base = `http://127.0.0.1:${srv.address().port}`;
  const http = async (method, url, body, token) => { const r = await fetch(url, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body && method !== "GET" ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
  const client = (acct) => ({ c: F.createClient({ base, http, join: mj.join(acct) }), acct });
  return { srv, store, base, http, client, close: () => new Promise((ok) => srv.close(ok)) };
}

test("sign in through the session-server check, request, accept, see each other online with the server you're on", async () => {
  const S = await start(); try {
    const s = S.client(U.steve), a = S.client(U.alex);
    assert.deepStrictEqual((await s.c.overview(s.acct)).me, { uuid: U.steve.uuid, name: "Steve" });
    await a.c.overview(a.acct); // Alex signs in once, so Steve can find them
    assert.deepStrictEqual(await s.c.act(s.acct, "request", "alex"), { ok: true, sent: "Alex" });
    let ao = await a.c.overview(a.acct); assert.deepStrictEqual(ao.incoming.map((r) => r.name), ["Steve"]);
    assert.deepStrictEqual((await s.c.overview(s.acct)).outgoing.map((r) => r.name), ["Alex"]);
    await a.c.act(a.acct, "accept", U.steve.uuid);
    await s.c.presence(s.acct, { state: "playing", server: "VexVanilla.net", instance: "VexVanilla" });
    ao = await a.c.overview(a.acct); assert.deepStrictEqual(ao.friends, [{ uuid: U.steve.uuid, name: "Steve", state: "playing", server: "vexvanilla.net", instance: "VexVanilla" }]);
    assert.deepStrictEqual(ao.incoming, []);
    await s.c.act(s.acct, "invite", U.alex.uuid); ao = await a.c.overview(a.acct); assert.deepStrictEqual(ao.invites.map((v) => [v.name, v.server]), [["Steve", "vexvanilla.net"]]);
    await s.c.presence(s.acct, { state: "offline" }); assert.strictEqual((await a.c.overview(a.acct)).friends[0].state, "offline");
    await a.c.act(a.acct, "remove", U.steve.uuid); assert.deepStrictEqual((await s.c.overview(s.acct)).friends, []);
  } finally { await S.close(); }
});
test("asking someone who already asked you makes you friends; duplicates, yourself and strangers are refused clearly", async () => {
  const S = await start(); try {
    const s = S.client(U.steve), a = S.client(U.alex); await s.c.overview(s.acct); await a.c.overview(a.acct);
    await s.c.act(s.acct, "request", "Alex"); await assert.rejects(s.c.act(s.acct, "request", "Alex"), /already asked Alex/);
    assert.deepStrictEqual(await a.c.act(a.acct, "request", "Steve"), { ok: true, friend: "Steve" });
    await assert.rejects(s.c.act(s.acct, "request", "Alex"), /already friends/); await assert.rejects(s.c.act(s.acct, "request", "Steve"), /That’s you/);
    await assert.rejects(s.c.act(s.acct, "request", "Notch"), /hasn’t signed in to Auroras friends yet/);
    await assert.rejects(s.c.act(s.acct, "request", "bad name!"), /Minecraft username/);
  } finally { await S.close(); }
});
test("only friends see presence; invites need friendship and a server; decline and cancel work", async () => {
  const S = await start(); try {
    const s = S.client(U.steve), a = S.client(U.alex), c = S.client(U.cxld); for (const x of [s, a, c]) await x.c.overview(x.acct);
    await s.c.presence(s.acct, { state: "online" }); assert.deepStrictEqual((await a.c.overview(a.acct)).friends, [], "a stranger sees nothing");
    await assert.rejects(s.c.act(s.acct, "invite", U.alex.uuid), /only invite friends/);
    await s.c.act(s.acct, "request", "Alex"); await a.c.act(a.acct, "decline", U.steve.uuid); assert.deepStrictEqual((await s.c.overview(s.acct)).outgoing, []);
    await s.c.act(s.acct, "request", "cxld"); await s.c.act(s.acct, "cancel", U.cxld.uuid); assert.deepStrictEqual((await c.c.overview(c.acct)).incoming, []);
    await s.c.act(s.acct, "request", "cxld"); await c.c.act(c.acct, "accept", U.steve.uuid); await assert.rejects(s.c.act(s.acct, "invite", U.cxld.uuid), /Join a server first/);
  } finally { await S.close(); }
});
test("sign-in is refused when the session server didn't see the join, for the wrong name, or a reused challenge", async () => {
  const S = await start(); try {
    const ch = (await S.http("POST", S.base + "/auth/challenge", { name: "Steve" })).json.serverId; assert.match(ch, /^[0-9a-f]{40}$/);
    let r = await S.http("POST", S.base + "/auth/verify", { name: "Steve", serverId: ch }); assert.strictEqual(r.status, 401); assert.match(r.json.error, /Mojang didn’t confirm/);
    // Alex joins with Steve's challenge: still not Steve.
    const ch2 = (await S.http("POST", S.base + "/auth/challenge", { name: "Steve" })).json.serverId; const bad = F.createClient({ base: S.base, http: S.http, join: async () => {} });
    r = await S.http("POST", S.base + "/auth/verify", { name: "Alex", serverId: ch2 }); assert.strictEqual(r.status, 401);
    r = await S.http("POST", S.base + "/auth/verify", { name: "Steve", serverId: ch2 }); assert.strictEqual(r.status, 401, "a challenge works once");
    await assert.rejects(bad.overview(U.steve), /Mojang didn’t confirm/);
    r = await S.http("GET", S.base + "/friends", null, "f".repeat(64)); assert.strictEqual(r.status, 401);
    r = await S.http("GET", S.base + "/friends"); assert.strictEqual(r.status, 401);
  } finally { await S.close(); }
});
test("an expired session signs in again by itself; presence goes offline after 90 s without a heartbeat", async () => {
  let t = 1e12; const S = await start({ now: () => t }); try {
    const s = S.client(U.steve), a = S.client(U.alex); await s.c.overview(s.acct); await a.c.overview(a.acct);
    await s.c.act(s.acct, "request", "Alex"); await a.c.act(a.acct, "accept", U.steve.uuid); await s.c.presence(s.acct, { state: "online" });
    assert.strictEqual((await a.c.overview(a.acct)).friends[0].state, "online"); t += 91000; assert.strictEqual((await a.c.overview(a.acct)).friends[0].state, "offline");
    t += 31 * 24 * 3600 * 1000; assert.strictEqual((await s.c.overview(s.acct)).me.name, "Steve", "signed in again after the 30-day session ran out");
  } finally { await S.close(); }
});
test("bad input: big bodies, broken JSON, unknown routes and bad server addresses get clear errors, never a crash", async () => {
  const S = await start(); try {
    let r = await fetch(S.base + "/auth/challenge", { method: "POST", body: "x".repeat(9000) }); assert.strictEqual(r.status, 413);
    r = await fetch(S.base + "/auth/challenge", { method: "POST", body: "{" }); assert.strictEqual(r.status, 400);
    r = await fetch(S.base + "/nope"); assert.strictEqual(r.status, 404); assert.strictEqual((await fetch(S.base + "/health")).status, 200);
    const s = S.client(U.steve); await assert.rejects(s.c.presence(s.acct, { state: "playing", server: "not a host!" }), /server address/);
  } finally { await S.close(); }
});
test("too many requests from one address are slowed down", async () => {
  const S = await start({ server: { limit: 5 } }); try { const codes = []; for (let i = 0; i < 7; i++) codes.push((await fetch(S.base + "/health")).status); assert.deepStrictEqual(codes, [200, 200, 200, 200, 200, 429, 429]); } finally { await S.close(); }
});
test("friendships survive a server restart; presence doesn't", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "aur-fr-")), "friends.json");
  let S = await start({ file }); const s = S.client(U.steve), a = S.client(U.alex); await s.c.overview(s.acct); await a.c.overview(a.acct);
  await s.c.act(s.acct, "request", "Alex"); await a.c.act(a.acct, "accept", U.steve.uuid); await s.c.presence(s.acct, { state: "online" }); S.store.flush(); await S.close();
  S = await start({ file }); try {
    const o = await S.client(U.alex).c.overview(U.alex); assert.deepStrictEqual(o.friends.map((f) => [f.name, f.state]), [["Steve", "offline"]]);
  } finally { await S.close(); }
  assert.ok(!fs.readFileSync(file, "utf8").includes("online"), "presence isn't written to disk");
});
test("friends server address: https only (http just for this computer); Settings wins over the shipped one", () => {
  assert.strictEqual(F.friendsUrl({ friendsUrl: "https://f.example.net/" }, { friendsUrl: "https://shipped.example" }), "https://f.example.net");
  assert.strictEqual(F.friendsUrl({}, { friendsUrl: "https://shipped.example" }), "https://shipped.example");
  assert.strictEqual(F.friendsUrl({ friendsUrl: "http://f.example.net" }, {}), ""); assert.strictEqual(F.checkUrl("http://localhost:8787"), "http://localhost:8787"); assert.strictEqual(F.checkUrl("javascript:alert(1)"), "");
});
