// Server status: the launcher's Server List Ping client against a local stand-in server that speaks the protocol.
const { test } = require("node:test");
const assert = require("node:assert");
const net = require("net");
const P = require("../serverping.js");

function fakeServer(reply, { closeEarly = false, garbage = false } = {}) {
  return new Promise((res) => {
    const seen = {};
    const srv = net.createServer((s) => {
      let buf = Buffer.alloc(0), stage = 0;
      s.on("data", (d) => {
        buf = Buffer.concat([buf, d]);
        for (;;) {
          const l = P.readVarint(buf, 0); if (!l) return; const [len, o] = l; if (buf.length < o + len) return;
          const body = buf.subarray(o, o + len); buf = buf.subarray(o + len); const [id, p] = P.readVarint(body, 0);
          if (stage === 0 && id === 0) { const [proto, p2] = P.readVarint(body, p); const [hl, p3] = P.readVarint(body, p2); seen.host = body.subarray(p3, p3 + hl).toString(); seen.port = body.readUInt16BE(p3 + hl); seen.proto = proto; stage = 1; }
          else if (stage === 1 && id === 0) { if (garbage) { s.write(Buffer.from([5, 0, 0xff, 0xff, 0xff, 0x0f])); return; } if (closeEarly) return s.destroy(); s.write(P.packet(0, P.mcString(JSON.stringify(reply)))); stage = 2; }
          else if (stage === 2 && id === 1) { s.write(P.packet(1, body.subarray(p))); }
        }
      });
    });
    srv.listen(0, "127.0.0.1", () => res({ port: srv.address().port, seen, close: () => srv.close() }));
  });
}

test("reads version, players, plain-text MOTD, icon and latency", async () => {
  const icon = "data:image/png;base64,iVBORw0KGgo=";
  const f = await fakeServer({ version: { name: "Paper 1.21.4", protocol: 769 }, players: { online: 37, max: 200 }, description: { text: "§bVex§fVanilla ", extra: [{ text: "§7survival" }] }, favicon: icon });
  try {
    const r = await P.ping("127.0.0.1:" + f.port, { timeout: 2000 });
    assert.deepStrictEqual({ ...r, latency: typeof r.latency }, { address: "127.0.0.1:" + f.port, online: true, version: "Paper 1.21.4", protocol: 769, players: { online: 37, max: 200 }, motd: "VexVanilla survival", icon, latency: "number" });
    assert.strictEqual(f.seen.host, "127.0.0.1"); assert.strictEqual(f.seen.port, f.port);
  } finally { f.close(); }
});
test("missing fields stay empty instead of being invented; bad icons are dropped", async () => {
  const f = await fakeServer({ description: "Hi", favicon: "javascript:alert(1)" });
  try { const r = await P.ping("127.0.0.1:" + f.port, { timeout: 2000 }); assert.strictEqual(r.players, null); assert.strictEqual(r.version, null); assert.strictEqual(r.icon, null); assert.strictEqual(r.motd, "Hi"); } finally { f.close(); }
});
test("offline, silent and broken servers give a clear error", async () => {
  const dead = net.createServer(); await new Promise((r) => dead.listen(0, "127.0.0.1", r)); const port = dead.address().port; dead.close();
  await assert.rejects(P.ping("127.0.0.1:" + port, { timeout: 1500 }), /refused|offline/);
  const quiet = net.createServer(() => {}); await new Promise((r) => quiet.listen(0, "127.0.0.1", r));
  await assert.rejects(P.ping("127.0.0.1:" + quiet.address().port, { timeout: 300 }), /didn’t answer in time/); quiet.close();
  const f = await fakeServer({}, { closeEarly: true }); await assert.rejects(P.ping("127.0.0.1:" + f.port, { timeout: 1500 }), /closed the connection/); f.close();
  const g = await fakeServer({}, { garbage: true }); await assert.rejects(P.ping("127.0.0.1:" + g.port, { timeout: 1500 }), /couldn’t read|closed/); g.close();
});
test("addresses: SRV lookup without a port, none with one; junk refused", async () => {
  const f = await fakeServer({ description: "srv" });
  try {
    let asked = null; const r = await P.ping("play.example.test", { timeout: 2000, resolveSrv: async (n) => { asked = n; return [{ name: "127.0.0.1", port: f.port }]; } });
    assert.strictEqual(asked, "_minecraft._tcp.play.example.test"); assert.strictEqual(r.motd, "srv"); assert.strictEqual(f.seen.host, "play.example.test", "the handshake carries the name you typed");
  } finally { f.close(); }
  assert.deepStrictEqual(P.parseAddress("mc.example.net:25570"), { host: "mc.example.net", port: 25570, explicitPort: true });
  assert.deepStrictEqual(P.parseAddress("[::1]"), { host: "::1", port: 25565, explicitPort: false });
  for (const bad of ["", "a b", "x:0", "x:70000", "http://x", "x;rm"]) assert.throws(() => P.parseAddress(bad), /server address|port/, bad);
});
