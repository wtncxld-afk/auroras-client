// Discord Rich Presence (discordrpc.js): the IPC framing, where the Discord app listens, what the activity says, and a
// fake Discord app on a local socket that checks the handshake and SET_ACTIVITY frames end to end.
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), os = require("os"), path = require("path"), net = require("net");
const D = require("../discordrpc.js");
const ID = "123456789012345678";

test("frames: 8-byte little-endian header (opcode, length) then JSON; split and joined chunks decode", () => {
  const f = D.encode(D.OP.HANDSHAKE, { v: 1, client_id: ID });
  assert.strictEqual(f.readInt32LE(0), 0); assert.strictEqual(f.readInt32LE(4), f.length - 8);
  assert.deepStrictEqual(JSON.parse(f.subarray(8).toString()), { v: 1, client_id: ID });
  const two = Buffer.concat([f, D.encode(D.OP.PING, { n: "é" })]), dec = D.createDecoder();
  assert.deepStrictEqual(dec.push(two.subarray(0, 5)), []);
  assert.deepStrictEqual(dec.push(two.subarray(5, f.length + 3)).map((x) => x.op), [0]);
  assert.deepStrictEqual(dec.push(two.subarray(f.length + 3)), [{ op: 3, data: { n: "é" } }]);
  const bad = Buffer.alloc(10); bad.writeInt32LE(1, 0); bad.writeInt32LE(2, 4); bad.write("{x", 8);
  assert.deepStrictEqual(D.createDecoder().push(bad), [{ op: 1, data: null }], "bad JSON is dropped, not thrown");
  const huge = Buffer.alloc(8); huge.writeInt32LE(1, 0); huge.writeInt32LE(10 * 1024 * 1024, 4);
  assert.throws(() => D.createDecoder().push(huge), /bad frame/);
});

test("socket paths: Windows named pipes 0..9; elsewhere runtime/temp dirs, Flatpak and Snap folders", () => {
  const w = D.socketPaths({ platform: "win32", env: {} });
  assert.strictEqual(w.length, 10); assert.strictEqual(w[0], "\\\\?\\pipe\\discord-ipc-0"); assert.strictEqual(w[9], "\\\\?\\pipe\\discord-ipc-9");
  const l = D.socketPaths({ platform: "linux", env: { XDG_RUNTIME_DIR: "/run/user/1000/", TMPDIR: "/tmp" } });
  assert.strictEqual(l[0], "/run/user/1000/discord-ipc-0");
  for (const p of ["/run/user/1000/app/com.discordapp.Discord/discord-ipc-0", "/run/user/1000/snap.discord/discord-ipc-0", "/tmp/discord-ipc-0", "/tmp/discord-ipc-9"]) assert.ok(l.includes(p), p);
  assert.strictEqual(new Set(l).size, l.length, "/tmp only once");
  const mac = D.socketPaths({ platform: "darwin", env: { TMPDIR: "/var/folders/ab/T/" } });
  assert.strictEqual(mac[0], "/var/folders/ab/T/discord-ipc-0"); assert.ok(mac.includes("/tmp/discord-ipc-0"));
});

test("application ID: Settings first, then auth.json; must be a 17-20 digit snowflake", () => {
  assert.strictEqual(D.clientId({ discordClientId: " " + ID + " " }, { discordClientId: "98765432109876543" }), ID);
  assert.strictEqual(D.clientId({ discordClientId: "nope" }, { discordClientId: "98765432109876543" }), "98765432109876543");
  for (const bad of ["", "1234567890123456", "123456789012345678901", "12345678901234567a", null]) assert.strictEqual(D.isSnowflake(bad), false, String(bad));
  assert.strictEqual(D.clientId({}, require("../auth.json")), "1562026097141358592", "the owner's own Discord app ID ships in auth.json");
  assert.strictEqual(D.clientId({}, { discordClientId: "" }), "", "no ID anywhere: presence is off");
});
test("the presence code only uses the local IPC socket: no web requests, no Discord web API", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "discordrpc.js"), "utf8");
  assert.doesNotMatch(src, /https?:|wss?:|require\("(https?|tls|dgram)"\)|fetch\(/);
  assert.match(src, /net\.createConnection\(p\)/);
});

test("activity: version and loader, server when known, start time, Auroras art", () => {
  const a = D.gameActivity({ mc: "1.21.11", loader: "Fabric", server: "vexvanilla.net:25565", startedAt: 1700000000123.7 });
  assert.deepStrictEqual(a, { details: "Playing on vexvanilla.net", state: "Minecraft 1.21.11 · Fabric", assets: { large_image: "logo", large_text: "Auroras Client" }, instance: false, timestamps: { start: 1700000000123 } });
  const b = D.gameActivity({ mc: "26.3", loader: "Vanilla", server: null, startedAt: 5 });
  assert.strictEqual(b.details, "In game"); assert.strictEqual(b.state, "Minecraft 26.3");
  assert.strictEqual(D.gameActivity({ mc: "1.21.11", loader: "Fabric", server: "play.example.net:25570" }).details, "Playing on play.example.net:25570");
  assert.strictEqual(D.gameActivity({ mc: "1", server: "x".repeat(300) }).details.length, 128, "Discord's 128 character limit");
  assert.strictEqual(D.gameActivity({}).timestamps, undefined);
  assert.strictEqual(D.idleActivity().details, "In the launcher");
  assert.deepStrictEqual(D.setActivityFrame(42, null, "n"), { cmd: "SET_ACTIVITY", args: { pid: 42 }, nonce: "n" }, "clearing sends no activity");
});

// ---------- A fake Discord app ----------
const sockPath = () => process.platform === "win32" ? "\\\\?\\pipe\\auroras-test-" + process.pid + "-" + Math.random().toString(36).slice(2) : path.join(fs.mkdtempSync(path.join(os.tmpdir(), "adrpc-")), "discord-ipc-0");
function fakeDiscord(file, { ready = true } = {}) {
  const frames = [], conns = [], waiters = [];
  const check = () => { for (const w of [...waiters]) if (w.pred()) { waiters.splice(waiters.indexOf(w), 1); w.resolve(); } };
  const server = net.createServer((c) => { conns.push(c); const dec = D.createDecoder();
    c.on("data", (b) => { for (const f of dec.push(b)) { frames.push(f);
      if (f.op === D.OP.HANDSHAKE && ready) c.write(D.encode(D.OP.FRAME, { cmd: "DISPATCH", evt: "READY", data: { v: 1 } }));
      if (f.op === D.OP.FRAME && f.data.cmd === "SET_ACTIVITY") c.write(D.encode(D.OP.FRAME, { cmd: "SET_ACTIVITY", nonce: f.data.nonce, data: f.data.args.activity || null })); }
      check(); });
    c.on("error", () => {}); c.on("close", check); });
  return { frames, conns,
    listen: () => new Promise((r) => server.listen(file, r)),
    stop: () => new Promise((r) => { for (const c of conns) c.destroy(); server.close(() => r()); }),
    until: (pred, ms = 3000) => new Promise((resolve, reject) => { if (pred()) return resolve(); const w = { pred, resolve }; waiters.push(w); setTimeout(() => reject(new Error("timed out; frames: " + JSON.stringify(frames))), ms).unref(); }) };
}
const acts = (fd) => fd.frames.filter((f) => f.op === D.OP.FRAME && f.data && f.data.cmd === "SET_ACTIVITY");

test("end to end: handshake with the app ID, SET_ACTIVITY with pid and activity, ping answered, clear on exit", async () => {
  const file = sockPath(), fd = fakeDiscord(file); await fd.listen();
  const p = D.createPresence({ clientId: ID, pid: 4321, paths: ["/nonexistent/discord-ipc-0", file] });
  const act = D.gameActivity({ mc: "1.21.11", loader: "Fabric", server: "vexvanilla.net", startedAt: 1700000000000 });
  p.set(act);
  await fd.until(() => acts(fd).length === 1);
  assert.deepStrictEqual(fd.frames[0], { op: 0, data: { v: 1, client_id: ID } });
  const f = acts(fd)[0].data; assert.strictEqual(f.args.pid, 4321); assert.deepStrictEqual(f.args.activity, act); assert.match(f.nonce, /^[0-9a-f-]{36}$/);
  assert.strictEqual(p.connected, true);
  // Discord pings; the launcher pongs with the same body.
  let pong = null; const dec = D.createDecoder(); fd.conns[0].on("data", (b) => { for (const x of dec.push(b)) if (x.op === D.OP.PONG) pong = x.data; });
  fd.conns[0].write(D.encode(D.OP.PING, { t: 7 })); await new Promise((r) => setTimeout(r, 100)); assert.deepStrictEqual(pong, { t: 7 });
  p.set(act); await new Promise((r) => setTimeout(r, 50)); assert.strictEqual(acts(fd).length, 1, "the same activity isn't sent twice");
  p.set(null); await fd.until(() => acts(fd).length === 2);
  assert.deepStrictEqual(acts(fd)[1].data.args, { pid: 4321 }, "game exited: activity cleared");
  p.close(); await fd.stop();
});

test("Discord not running never throws; it connects when Discord starts and recovers when Discord restarts mid-game", async () => {
  const file = sockPath(), act = D.gameActivity({ mc: "1.21.11", loader: "Fabric", startedAt: 1 });
  const p = D.createPresence({ clientId: ID, pid: 1, paths: [file], retryMs: 60 });
  p.set(act); await new Promise((r) => setTimeout(r, 150)); assert.strictEqual(p.connected, false);
  let fd = fakeDiscord(file); await fd.listen();
  await fd.until(() => acts(fd).length === 1, 2000);
  await fd.stop(); await new Promise((r) => setTimeout(r, 30)); assert.strictEqual(p.connected, false, "Discord closed mid-game");
  if (process.platform !== "win32") try { fs.unlinkSync(file); } catch {}
  fd = fakeDiscord(file); await fd.listen();
  await fd.until(() => acts(fd).length === 1, 2000);
  assert.deepStrictEqual(acts(fd)[0].data.args.activity, act, "the activity comes back after Discord restarts");
  p.close(); await fd.stop();
});

test("Discord closing the connection (op 2), never answering, or no app ID: no throw, no retries when nothing is wanted", async () => {
  const file = sockPath(), fd = fakeDiscord(file, { ready: false }); await fd.listen();
  const p = D.createPresence({ clientId: ID, pid: 1, paths: [file], retryMs: 40, readyMs: 80 });
  p.set(D.idleActivity()); await fd.until(() => fd.conns.length >= 2, 2000); // no READY: gave up and retried
  fd.conns.at(-1).write(D.encode(D.OP.CLOSE, { code: 4000, message: "Invalid Client ID" }));
  p.set(null); const n = fd.conns.length; await new Promise((r) => setTimeout(r, 250));
  assert.ok(fd.conns.length <= n + 1, "stops retrying once nothing is wanted");
  p.close(); p.set(D.idleActivity()); p.close();
  const off = D.createPresence({ clientId: "", paths: [file], retryMs: 10 }); off.set(D.idleActivity()); await new Promise((r) => setTimeout(r, 60));
  assert.strictEqual(off.connected, false); off.close();
  await fd.stop();
});
