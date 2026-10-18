// Minecraft Java server status (the "Server List Ping" the multiplayer screen uses): handshake, status request, JSON
// reply, then a ping/pong for latency. Resolves _minecraft._tcp SRV records like the game does. No account or login.
const net = require("net"), dns = require("dns").promises;

function varint(n) { const out = []; n >>>= 0; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n); return Buffer.from(out); }
function readVarint(buf, off) { let n = 0, shift = 0, b; do { if (off >= buf.length) return null; b = buf[off++]; n |= (b & 0x7f) << shift; shift += 7; if (shift > 35) throw new Error("Bad reply from server"); } while (b & 0x80); return [n >>> 0, off]; }
const packet = (id, ...parts) => { const body = Buffer.concat([varint(id), ...parts]); return Buffer.concat([varint(body.length), body]); };
const mcString = (s) => { const b = Buffer.from(s, "utf8"); return Buffer.concat([varint(b.length), b]); };

/** "play.example.net", "play.example.net:25570", "[::1]:25565" -> { host, port, explicitPort } */
function parseAddress(addr) {
  const a = String(addr || "").trim(); if (!a || a.length > 255 || /\s/.test(a)) throw new Error("Enter a server address like play.example.net");
  let m = a.match(/^\[([0-9a-f:]+)\](?::(\d+))?$/i) || a.match(/^([^:]+)(?::(\d+))?$/);
  if (!m) throw new Error("Enter a server address like play.example.net");
  const port = m[2] ? +m[2] : 25565; if (!(port >= 1 && port <= 65535)) throw new Error("The port must be between 1 and 65535");
  if (!/^[a-z0-9.\-_:]+$/i.test(m[1])) throw new Error("Enter a server address like play.example.net");
  return { host: m[1], port, explicitPort: !!m[2] };
}
/** Strips § formatting codes and flattens a chat component description into plain text. */
function motdText(d) {
  const flat = (c) => (typeof c === "string" ? c : !c ? "" : (c.text || "") + (Array.isArray(c.extra) ? c.extra.map(flat).join("") : ""));
  return flat(d).replace(/§[0-9a-fk-or]/gi, "").replace(/\s+\n/g, "\n").trim().slice(0, 300);
}
/** Turns the server's JSON into what the launcher shows. Missing fields stay null rather than being made up. */
function summarize(j, ms) {
  const icon = typeof j.favicon === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(j.favicon) && j.favicon.length < 70000 ? j.favicon : null;
  const players = j.players && Number.isFinite(j.players.online) ? { online: j.players.online, max: Number.isFinite(j.players.max) ? j.players.max : null } : null;
  return { online: true, version: j.version && typeof j.version.name === "string" ? j.version.name.slice(0, 64) : null, protocol: j.version && Number.isFinite(j.version.protocol) ? j.version.protocol : null, players, motd: motdText(j.description), icon, latency: ms };
}

/** Talks to one host:port. Rejects with a readable error on timeout, refusal or a malformed reply. */
function query(host, port, { timeout = 5000, handshakeHost = host, handshakePort = port } = {}) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0), json = null, sentPing = 0, done = false;
    const sock = net.createConnection({ host, port });
    const finish = (err, val) => { if (done) return; done = true; clearTimeout(timer); sock.destroy(); err ? reject(err) : resolve(val); };
    const timer = setTimeout(() => finish(new Error("The server didn’t answer in time.")), timeout);
    sock.on("error", (e) => finish(new Error(e.code === "ECONNREFUSED" ? "The server refused the connection. It may be offline." : e.code === "ENOTFOUND" ? "That server address doesn’t exist." : "Couldn’t reach the server (" + (e.code || e.message) + ").")));
    sock.on("connect", () => {
      const hp = Buffer.alloc(2); hp.writeUInt16BE(handshakePort);
      sock.write(Buffer.concat([packet(0x00, varint(767), mcString(handshakeHost), hp, varint(1)), packet(0x00)]));
    });
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]); if (buf.length > 1 << 20) return finish(new Error("The server sent too much data."));
      try {
        for (;;) {
          const l = readVarint(buf, 0); if (!l) return; const [len, o] = l; if (buf.length < o + len) return;
          const body = buf.subarray(o, o + len); buf = buf.subarray(o + len);
          const [id, p] = readVarint(body, 0);
          if (id === 0x00 && json === null) {
            const [sl, so] = readVarint(body, p); json = JSON.parse(body.subarray(so, so + sl).toString("utf8"));
            const pl = Buffer.alloc(8); pl.writeBigInt64BE(BigInt(Date.now())); sentPing = Date.now(); sock.write(packet(0x01, pl));
          } else if (id === 0x01 && json) return finish(null, summarize(json, Date.now() - sentPing));
        }
      } catch (e) { finish(new Error("The server sent a reply Auroras couldn’t read.")); }
    });
    sock.on("close", () => { if (json) finish(null, summarize(json, null)); else finish(new Error("The server closed the connection without a status.")); });
  });
}

/** Full lookup: SRV record (unless a port was given), then the status query. */
async function ping(addr, opts = {}) {
  const a = parseAddress(addr); let host = a.host, port = a.port;
  if (!a.explicitPort && !net.isIP(host) && opts.srv !== false) {
    try { const r = await (opts.resolveSrv || dns.resolveSrv)("_minecraft._tcp." + host); if (r && r[0]) { host = r[0].name; port = r[0].port; } } catch {}
  }
  return { address: a.host + (a.explicitPort ? ":" + a.port : ""), ...(await query(host, port, { timeout: opts.timeout || 5000, handshakeHost: a.host, handshakePort: port })) };
}
module.exports = { ping, query, parseAddress, motdText, summarize, varint, readVarint, packet, mcString };
