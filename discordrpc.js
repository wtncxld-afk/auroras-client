// Discord Rich Presence over the local Discord app's IPC socket (a named pipe on Windows, a unix socket elsewhere).
// Nothing goes over the network: the launcher only talks to the Discord app already running on this computer, and
// only to say what's being played. If Discord isn't running, nothing happens.
//
// Framing (Discord's documented RPC transport): an 8-byte header, opcode int32 LE + body length int32 LE, then a JSON body.
const net = require("net"), path = require("path"), crypto = require("crypto");

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const MAX_FRAME = 64 * 1024; // Discord's replies are tiny; anything bigger is not Discord.
const SNOWFLAKE = /^\d{17,20}$/;
const isSnowflake = (s) => SNOWFLAKE.test(String(s == null ? "" : s).trim());

/** The Discord Application ID: the one in Settings, otherwise the one shipped in auth.json, otherwise "" (presence off). */
function clientId(settings, shipped) {
  const s = String((settings && settings.discordClientId) || "").trim(); if (isSnowflake(s)) return s;
  const b = String((shipped && shipped.discordClientId) || "").trim(); return isSnowflake(b) ? b : "";
}

function encode(op, body) {
  const json = Buffer.from(JSON.stringify(body == null ? {} : body), "utf8"), h = Buffer.alloc(8);
  h.writeInt32LE(op, 0); h.writeInt32LE(json.length, 4); return Buffer.concat([h, json]);
}
/** Splits a byte stream into frames. push(chunk) returns the complete frames so far ({op, data}; data null if the JSON is bad). */
function createDecoder() {
  let buf = Buffer.alloc(0);
  return { push(chunk) {
    buf = buf.length ? Buffer.concat([buf, chunk]) : Buffer.from(chunk); const out = [];
    while (buf.length >= 8) {
      const op = buf.readInt32LE(0), len = buf.readInt32LE(4);
      if (len < 0 || len > MAX_FRAME) throw new Error("bad frame");
      if (buf.length < 8 + len) break;
      let data = null; try { data = JSON.parse(buf.subarray(8, 8 + len).toString("utf8")); } catch {}
      out.push({ op, data }); buf = buf.subarray(8 + len);
    }
    return out;
  } };
}

/** Where the Discord app listens, in the order to try. Covers the normal, Flatpak and Snap installs on Linux. */
function socketPaths({ platform = process.platform, env = process.env } = {}) {
  const out = [];
  if (platform === "win32") { for (let i = 0; i < 10; i++) out.push("\\\\?\\pipe\\discord-ipc-" + i); return out; }
  const dirs = [...new Set([env.XDG_RUNTIME_DIR, env.TMPDIR, env.TMP, env.TEMP, "/tmp"].filter(Boolean).map((d) => String(d).replace(/\/+$/, "") || "/"))];
  const subs = ["", "app/com.discordapp.Discord", "app/com.discordapp.DiscordCanary", "snap.discord", "snap.discord-canary"];
  for (let i = 0; i < 10; i++) for (const d of dirs) for (const s of subs) out.push(path.posix.join(d, s, "discord-ipc-" + i));
  return out;
}

// Discord wants 2 to 128 characters in each text field.
const field = (s) => { s = String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, " ").trim(); if (s.length > 128) s = s.slice(0, 127) + "…"; return s.length >= 2 ? s : ""; };
/** "vexvanilla.net:25565" -> "vexvanilla.net"; other ports are kept. */
const serverLabel = (server) => String(server || "").trim().replace(/:25565$/, "");
/** What Discord shows while a game runs. */
function gameActivity({ mc, loader, server, startedAt } = {}) {
  const ver = field(mc), ld = String(loader || "").trim(), srv = field(serverLabel(server));
  const state = field("Minecraft" + (ver ? " " + ver : "") + (ld && ld !== "Vanilla" ? " · " + ld : ""));
  const a = { details: srv ? field("Playing on " + srv) : "In game", state, assets: { large_image: "logo", large_text: "Auroras Client" }, instance: false };
  const t = Math.floor(Number(startedAt)); if (t > 0) a.timestamps = { start: t };
  return a;
}
/** What Discord shows while the launcher is open and no game runs (only if the player turned that on). */
const idleActivity = () => ({ details: "In the launcher", assets: { large_image: "logo", large_text: "Auroras Client" }, instance: false });
const setActivityFrame = (pid, activity, nonce = crypto.randomUUID()) => ({ cmd: "SET_ACTIVITY", args: activity ? { pid, activity } : { pid }, nonce });

/**
 * A presence connection that never throws and never blocks: set(activity) or set(null) to clear. While an activity is
 * wanted and Discord isn't reachable it retries quietly every retryMs. close() clears and disconnects.
 */
function createPresence({ clientId: id, pid = process.pid, paths = socketPaths(), connect = (p) => net.createConnection(p), retryMs = 15000, readyMs = 5000 } = {}) {
  let sock = null, ready = false, connecting = false, want = null, sent = undefined, timer = null, closed = false;
  const write = (op, body) => { try { if (sock && !sock.destroyed) sock.write(encode(op, body)); } catch {} };
  const flush = () => { if (!ready || sent === want) return; sent = want; write(OP.FRAME, setActivityFrame(pid, want)); };
  const drop = () => { const s = sock; sock = null; ready = false; sent = undefined; if (s) try { s.destroy(); } catch {} schedule(); };
  const schedule = () => { if (closed || timer || !want) return; timer = setTimeout(() => { timer = null; tryConnect(); }, retryMs); if (timer.unref) timer.unref(); };
  function attempt(list, i) {
    if (closed) { connecting = false; return; }
    if (i >= list.length) { connecting = false; schedule(); return; }
    let s, done = false; const next = () => { if (done) return; done = true; try { s && s.destroy(); } catch {} attempt(list, i + 1); };
    try { s = connect(list[i]); } catch { return next(); }
    s.once("error", next);
    s.once("connect", () => {
      if (done) return; done = true; s.removeListener("error", next); connecting = false; sock = s;
      const dec = createDecoder(), wait = setTimeout(() => { if (sock === s && !ready) drop(); }, readyMs); if (wait.unref) wait.unref();
      s.on("data", (chunk) => { let frames; try { frames = dec.push(chunk); } catch { return drop(); }
        for (const f of frames) {
          if (f.op === OP.PING) write(OP.PONG, f.data);
          else if (f.op === OP.CLOSE) return drop();
          else if (f.op === OP.FRAME && f.data && f.data.evt === "READY" && !ready) { ready = true; clearTimeout(wait); flush(); }
        } });
      s.on("error", () => {}); s.on("close", () => { clearTimeout(wait); if (sock === s) drop(); });
      write(OP.HANDSHAKE, { v: 1, client_id: id });
    });
  }
  function tryConnect() { if (closed || connecting || sock || !isSnowflake(id)) return; connecting = true; attempt(paths, 0); }
  return {
    set(activity) { if (closed) return; want = activity || null; if (ready) flush(); else if (want) tryConnect(); },
    get connected() { return ready; },
    close() { if (closed) return; want = null; flush(); closed = true; clearTimeout(timer); timer = null; const s = sock; sock = null; ready = false; if (s) try { s.end(); } catch {} },
  };
}

module.exports = { OP, isSnowflake, clientId, encode, createDecoder, socketPaths, gameActivity, idleActivity, setActivityFrame, createPresence };
