// Auroras visuals: the JavaScript twin of client-mod/core (Sky, Particles, Cosmetics, Quality, Config validation).
// Used by the launcher previews and by tests. test/visuals.test.js checks it against visuals/sky-golden.json, which the
// Java side writes, so the launcher previews use the same colors, stars, cape motion and setting rules as the game.
(function (root) {
  "use strict";
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const THEME_IDS = ["aurora", "sakura", "cosmic", "midnight", "void", "sunset", "celestial", "vanillaPlus"];
  function hex(h) { if (typeof h !== "string" || !/^#[0-9a-fA-F]{6}$/.test(h)) throw new Error("Bad color " + h); return parseInt(h.slice(1), 16); }
  function loadThemes(data) {
    if (!data || data.schema !== 1) throw new Error("Unsupported themes schema");
    const out = {};
    for (const [id, t] of Object.entries(data.themes)) out[id] = { id, name: t.name, day: { zenith: hex(t.day.zenith), horizon: hex(t.day.horizon), sunset: hex(t.day.sunset) }, night: { zenith: hex(t.night.zenith), horizon: hex(t.night.horizon), sunset: hex(t.day.sunset) },
      ground: hex(t.ground), starDensity: t.stars.density, starSize: t.stars.size, starBrightness: t.stars.brightness, starTint: hex(t.stars.tint), aurora: t.aurora.enabled, auroraColors: t.aurora.colors.map(hex),
      auroraHeight: t.aurora.height, auroraSpeed: t.aurora.speed, auroraStrength: t.aurora.strength, nebula: t.nebula.enabled, nebulaColors: t.nebula.colors.map(hex),
      moonColor: hex(t.moon.color), moonSize: t.moon.size, moonGlow: t.moon.glow, sunColor: hex(t.sun.color), sunSize: t.sun.size, sunGlow: t.sun.glow, mountains: t.mountains, fx: parseFx(t.fx) };
    return out;
  }
  const NONE = { brightness: 1, saturation: 1, contrast: 1, tint: 0xffffff, tintStrength: 0 };
  const frac = (v) => v - Math.floor(v);
  const floorMod = (a, n) => ((a % n) + n) % n;
  function skyAngle(ticks) { const d = frac(floorMod(ticks, 24000) / 24000 - 0.25), e = 0.5 - Math.cos(d * Math.PI) / 2; return (d * 2 + e) / 3; }
  const daylight = (ticks) => clamp(Math.cos(skyAngle(ticks) * Math.PI * 2) * 2 + 0.5, 0, 1);
  function sunsetAmount(ticks) { const g = Math.cos(skyAngle(ticks) * Math.PI * 2); if (g < -0.4 || g > 0.4) return 0; const i = (g / 0.4) * 0.5 + 0.5, j = 1 - (1 - Math.sin(i * Math.PI)) * 0.99; return j * j; }
  const nightAmount = (ticks) => Math.pow(1 - daylight(ticks), 1.5);
  function mix(a, b, t) {
    t = clamp(t, 0, 1);
    const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t), g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t), bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
    return (r << 16) | (g << 8) | bl;
  }
  function adjust(c, a) {
    let r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255; const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = L + (r - L) * a.saturation; g = L + (g - L) * a.saturation; b = L + (b - L) * a.saturation;
    r = (r - 0.5) * a.contrast + 0.5; g = (g - 0.5) * a.contrast + 0.5; b = (b - 0.5) * a.contrast + 0.5;
    r *= a.brightness; g *= a.brightness; b *= a.brightness;
    const s = a.tintStrength; r += (((a.tint >> 16) & 255) / 255 - r) * s; g += (((a.tint >> 8) & 255) / 255 - g) * s; b += ((a.tint & 255) / 255 - b) * s;
    return (Math.round(clamp(r, 0, 1) * 255) << 16) | (Math.round(clamp(g, 0, 1) * 255) << 8) | Math.round(clamp(b, 0, 1) * 255);
  }
  function skyColor(t, elev, ticks, a) {
    const e = clamp(elev, 0, 1), k = Math.pow(e, 0.6), d = daylight(ticks), s = sunsetAmount(ticks);
    let c = mix(mix(t.night.horizon, t.night.zenith, k), mix(t.day.horizon, t.day.zenith, k), d);
    c = mix(c, t.day.sunset, s * 0.8 * (1 - e) * (1 - e));
    return adjust(c, a || NONE);
  }
  function Rng(seed) { let a = seed | 0; this.next = () => { a = (a + 0x6d2b79f5) | 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function StarField(seed, density, sizeMul) {
    const count = Math.round(1500 * clamp(density, 0, 3)), x = new Float32Array(count), y = new Float32Array(count), z = new Float32Array(count), size = new Float32Array(count), phase = new Float32Array(count), r = new Rng(seed);
    for (let k = 0; k < count; k++) { const u = r.next() * 2 - 1, phi = r.next() * Math.PI * 2, s = Math.sqrt(1 - u * u); x[k] = s * Math.cos(phi); y[k] = u; z[k] = s * Math.sin(phi); size[k] = (0.15 + r.next() * 0.1) * sizeMul; phase[k] = r.next() * Math.PI * 2; }
    return { count, x, y, z, size, phase, brightness: (k, seconds, twinkle, base, night) => clamp(base * (0.7 + 0.3 * Math.sin(seconds * twinkle * 2 + phase[k])) * night, 0, 1) };
  }
  const auroraElevation = (az, sec, r, height, speed) => height + 0.06 * Math.sin(az * 3 + sec * 0.35 * speed + r * 1.7) + 0.025 * Math.sin(az * 7.0 - sec * 0.4 * speed + r);
  // Animated sky effects: twin of SkyFx.java. Pure functions of (seed, index, time), written into caller-owned arrays.
  const FX_NONE = { meteorsPerMinute: 0, clouds: 0, cloudColor: 0xffffff, petals: 0, petalColor: 0xffffff, constellations: false, nebulaDrift: 0, auroraLayers: 1 };
  function fxRange(v, lo, hi, what) { if (!(typeof v === "number" && v >= lo && v <= hi)) throw new Error("fx." + what + " must be " + lo + ".." + hi); return v; }
  function parseFx(fx) {
    if (fx == null) return FX_NONE;
    if (typeof fx.constellations !== "boolean") throw new Error("fx.constellations must be true or false");
    return { meteorsPerMinute: fxRange(fx.meteorsPerMinute, 0, 30, "meteorsPerMinute"), clouds: fxRange(fx.clouds, 0, 1, "clouds"), cloudColor: hex(fx.cloudColor), petals: fxRange(fx.petals, 0, 1, "petals"), petalColor: hex(fx.petalColor),
      constellations: fx.constellations, nebulaDrift: fxRange(fx.nebulaDrift, 0, 3, "nebulaDrift"), auroraLayers: Math.trunc(fxRange(fx.auroraLayers, 1, 3, "auroraLayers")) };
  }
  const FX_BUDGET = { LOW: { meteors: 1, petals: 32, cloudPuffs: 10, nebulaBlobs: 0, auroraLayers: 0, ribbonSteps: 32, constellationGroups: 4 },
    BALANCED: { meteors: 2, petals: 96, cloudPuffs: 20, nebulaBlobs: 10, auroraLayers: 2, ribbonSteps: 64, constellationGroups: 6 },
    HIGH: { meteors: 4, petals: 220, cloudPuffs: 36, nebulaBlobs: 16, auroraLayers: 3, ribbonSteps: 96, constellationGroups: 8 } };
  /** Sky quality setting: "auto" follows the client-wide quality name, otherwise LOW / BALANCED / HIGH. Returns the name. */
  const skyQuality = (setting, global) => (QUALITY[setting] ? setting : QUALITY[global] ? global : "BALANCED");
  const fxClock = (seconds, speed, animate) => (animate ? seconds * clamp(speed, 0, 3) : 0);
  function fxU(seed, index, salt) {
    let h = (seed ^ Math.imul(index, 0x9e3779b1 | 0) ^ Math.imul(salt, 0x85ebca77 | 0)) | 0;
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b | 0); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35 | 0); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const SLOT = 1.5, METEOR_MAX_LIFE = 1.2, METEOR_FIELDS = 6;
  function meteors(seed, perMinute, t, max, out) {
    if (perMinute <= 0 || max <= 0) return 0;
    const p = Math.min(1, (perMinute / 60) * SLOT); let n = 0;
    const first = Math.floor((t - METEOR_MAX_LIFE) / SLOT), last = Math.floor(t / SLOT);
    for (let s = first; s <= last && n < max; s++) {
      const i = s | 0; if (fxU(seed, i, 0) >= p) continue;
      const start = s * SLOT + fxU(seed, i, 1) * SLOT, life = 0.6 + fxU(seed, i, 2) * 0.6, age = t - start;
      if (age < 0 || age >= life) continue;
      const prog = age / life, az = fxU(seed, i, 3) * Math.PI * 2, el = 0.35 + fxU(seed, i, 4) * 0.45, ang = -0.35 - fxU(seed, i, 5) * 0.8, len = 0.18 + fxU(seed, i, 6) * 0.14;
      const dAz = Math.cos(ang) * len * (fxU(seed, i, 7) < 0.5 ? -1 : 1), dEl = Math.sin(ang) * len, o = n * METEOR_FIELDS;
      out[o] = az + dAz * prog; out[o + 1] = el + dEl * prog; out[o + 2] = dAz; out[o + 3] = dEl; out[o + 4] = prog; out[o + 5] = Math.sin(prog * Math.PI) * (0.75 + fxU(seed, i, 8) * 0.25); n++;
    }
    return n;
  }
  function petal(seed, k, t, out) {
    const fall = 0.035 + fxU(seed, k, 1) * 0.035, phase = fxU(seed, k, 2), y = (phase + t * fall) % 1.0, el = 1.0 - y * 1.1, sway = 0.09 * Math.sin(t * (0.5 + fxU(seed, k, 3) * 0.7) + k * 1.3);
    out[0] = fxU(seed, k, 0) * Math.PI * 2 + sway; out[1] = el; out[2] = t * (0.8 + fxU(seed, k, 4) * 2.2) + k;
    out[3] = clamp((el + 0.1) / 0.15, 0, 1) * clamp((1 - el) / 0.1, 0, 1) * (0.55 + fxU(seed, k, 5) * 0.45);
  }
  function cloud(seed, k, t, out) {
    out[0] = fxU(seed, k, 0) * Math.PI * 2 + t * 0.006 * (0.5 + fxU(seed, k, 1)); out[1] = 0.04 + fxU(seed, k, 2) * 0.16; out[2] = 0.08 + fxU(seed, k, 3) * 0.12;
    out[3] = (0.35 + fxU(seed, k, 4) * 0.4) * (0.85 + 0.15 * Math.sin(t * 0.2 + k));
  }
  const cloudColor = (c, sky, day) => mix(sky, c, 0.25 + 0.6 * clamp(day, 0, 1));
  function nebula(seed, k, t, drift, out) {
    out[0] = fxU(seed, k, 0) * Math.PI * 2 + t * 0.012 * drift * (fxU(seed, k, 1) < 0.5 ? -1 : 1); out[1] = 0.12 + fxU(seed, k, 2) * 0.45; out[2] = 0.35 + fxU(seed, k, 3) * 0.4;
    out[3] = 0.3 * (0.7 + 0.3 * Math.sin(t * 0.15 * (0.5 + drift) + k * 2.1));
  }
  function auroraWave(az, t, r, layer, height, speed, waves) { const sp = speed * (1 + layer * 0.18); return height + layer * 0.04 + waves * (0.06 * Math.sin(az * 3 + t * 0.35 * sp + r * 1.7 + layer * 0.9) + 0.025 * Math.sin(az * 7.0 - t * 0.4 * sp + r + layer * 2.3)); }
  const auroraShimmer = (az, t, r, layer, speed) => (0.65 + 0.35 * Math.sin(az * 11 + t * 1.3 * speed + r * 2 + layer)) * (1 - layer * 0.28);
  function Constellations(f, seed, groups) {
    const lim = Math.fround(0.3), cand = []; for (let k = 0; k < f.count; k++) if (f.y[k] > lim) cand.push(k);
    const out = [], used = new Set(); let g = 0;
    for (let tries = 0; g < groups && tries < groups * 8 && cand.length; tries++) {
      const a = cand[Math.trunc(fxU(seed, tries, 0) * cand.length)]; if (used.has(a)) continue;
      const len = 4 + Math.trunc(fxU(seed, tries, 1) * 3), chain = [], mine = new Set([a]); let cur = a;
      for (let s = 1; s < len; s++) {
        let best = -1, bd = 0.045;
        for (const c of cand) { if (mine.has(c) || used.has(c)) continue; const dx = f.x[c] - f.x[cur], dy = f.y[c] - f.y[cur], dz = f.z[c] - f.z[cur], d = dx * dx + dy * dy + dz * dz; if (d < bd && d > 0.002) { bd = d; best = c; } }
        if (best < 0) break; chain.push([cur, best, g]); mine.add(best); cur = best;
      }
      if (chain.length >= 3) { out.push(...chain); for (const m of mine) used.add(m); g++; }
    }
    return { groups: g, pairs: out.flatMap((p) => [p[0], p[1]]), groupOf: out.map((p) => p[2]) };
  }
  Constellations.alpha = (group, t, night) => 0.45 * night * (0.6 + 0.4 * Math.sin(t * 0.5 + group * 1.9));
  const themeFor = (dim, ow, ne, en) => (dim === "minecraft:the_nether" ? (ne === "off" ? null : ne) : dim === "minecraft:the_end" ? (en === "off" ? null : en) : ow);

  // Emotes: twin of client-mod/core Emotes.java (format, sampling, controller, wheel). Angles in degrees, Minecraft model convention.
  const EMOTE_PARTS = ["head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg", "root"], EN = 7, EROOT = 6, EF = 4;
  const EASINGS = ["linear", "easeIn", "easeOut", "easeInOut", "sine", "step", "back"], EMOTE_CATEGORIES = ["Greetings", "Celebrate", "Dance", "Reactions", "Custom"], EMOTE_ID = /^[a-z0-9_]{1,32}$/, SLOTS = 8;
  function ease(e, x) {
    x = clamp(x, 0, 1);
    switch (e) { case 1: return x * x * x; case 2: return 1 - Math.pow(1 - x, 3); case 3: return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; case 4: return -(Math.cos(Math.PI * x) - 1) / 2; case 5: return x < 1 ? 0 : 1;
      case 6: { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); } default: return x; }
  }
  const ebad = (where, why) => new Error(where + ": " + why), efmt = (d) => String(d);
  function enum_(o, k, def, lo, hi, where) { const v = o[k]; if (v === undefined) return def; if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) throw ebad(where, k + " must be a number from " + efmt(lo) + " to " + efmt(hi)); return v; }
  const isObj = (o) => o != null && typeof o === "object" && !Array.isArray(o);
  function parseEmote(o) {
    if (!isObj(o)) throw ebad("emote", "must be an object");
    for (const k of Object.keys(o)) if (!["id", "name", "category", "duration", "loop", "keys"].includes(k)) throw ebad("emote", 'unknown field "' + k + '"');
    if (typeof o.id !== "string" || !EMOTE_ID.test(o.id)) throw ebad("emote", "id must be 1-32 lowercase letters, digits or _");
    const w = "emote " + o.id;
    if (typeof o.name !== "string" || !o.name.trim() || o.name.length > 32 || /[\x00-\x1f]/.test(o.name)) throw ebad(w, "name must be 1-32 characters");
    if (!EMOTE_CATEGORIES.includes(o.category)) throw ebad(w, "category must be one of [" + EMOTE_CATEGORIES.join(", ") + "]");
    const dur = enum_(o, "duration", NaN, 0.1, 30, w); if (Number.isNaN(dur)) throw ebad(w, "duration is required");
    if (typeof o.loop !== "boolean") throw ebad(w, "loop must be true or false");
    if (!isObj(o.keys)) throw ebad(w, "keys must be an object of body parts");
    for (const pk of Object.keys(o.keys)) if (!EMOTE_PARTS.includes(pk)) throw ebad(w, 'unknown body part "' + pk + '"');
    const keys = []; let total = 0;
    for (let p = 0; p < EN; p++) {
      const arr = o.keys[EMOTE_PARTS[p]]; if (arr === undefined || arr === null) { keys.push([]); continue; }
      if (!Array.isArray(arr)) throw ebad(w, EMOTE_PARTS[p] + " must be a list of keyframes");
      if (arr.length > 64) throw ebad(w, EMOTE_PARTS[p] + " has more than 64 keyframes");
      const out = []; let prev = -1;
      arr.forEach((k, i) => {
        const kw = w + " " + EMOTE_PARTS[p] + " keyframe " + (i + 1);
        if (!isObj(k)) throw ebad(kw, "must be an object");
        for (const f of Object.keys(k)) if (!["t", "p", "y", "r", "oy", "e"].includes(f)) throw ebad(kw, 'unknown field "' + f + '"');
        const t = enum_(k, "t", NaN, 0, dur, kw); if (Number.isNaN(t)) throw ebad(kw, "t (time) is required");
        if (t <= prev) throw ebad(kw, "times must increase"); prev = t;
        const e = k.e === undefined ? "linear" : k.e; if (typeof e !== "string" || !EASINGS.includes(e)) throw ebad(kw, "e (easing) must be one of [" + EASINGS.join(", ") + "]");
        const pp = enum_(k, "p", 0, -180, 180, kw), yy = enum_(k, "y", 0, -180, 180, kw), rr = enum_(k, "r", 0, -180, 180, kw), oy = enum_(k, "oy", 0, -16, 16, kw);
        if (p === EROOT && (pp !== 0 || yy !== 0 || rr !== 0)) throw ebad(kw, "the root part only moves up and down (oy)");
        if (p !== EROOT && oy !== 0) throw ebad(kw, "only the root part has oy");
        out.push({ t, p: pp, y: yy, r: rr, oy, ease: EASINGS.indexOf(e) });
      });
      keys.push(out); total += arr.length;
    }
    if (total === 0) throw ebad(w, "needs at least one keyframe");
    if (total > 256) throw ebad(w, "has more than 256 keyframes");
    return { id: o.id, name: o.name, category: o.category, duration: dur, loop: o.loop, keys };
  }
  function parseEmoteLibrary(data) {
    if (!data || data.schema !== 1) throw new Error("Unsupported emote library schema");
    const ids = new Set(); return data.emotes.map((e) => { const em = parseEmote(e); if (ids.has(em.id)) throw ebad("emote " + em.id, "duplicate id"); ids.add(em.id); return em; });
  }
  function parseEmoteFile(text) {
    if (text.length > 65536) throw new Error("That file is too large to be an emote.");
    let root; try { root = JSON.parse(text); } catch { throw new Error("That file isn’t valid JSON."); }
    if (!isObj(root) || root.schema !== 1) throw new Error("Not an Auroras emote file (schema 1).");
    return parseEmote(root.emote);
  }
  /** The file format the creator saves and exports. Zero values and linear easing are left out. */
  function emoteToJson(em) {
    const keys = {}; em.keys.forEach((ks, p) => { if (!ks.length) return; keys[EMOTE_PARTS[p]] = ks.map((k) => { const o = { t: k.t }; if (k.p) o.p = k.p; if (k.y) o.y = k.y; if (k.r) o.r = k.r; if (k.oy) o.oy = k.oy; if (k.ease) o.e = EASINGS[k.ease]; return o; }); });
    return { id: em.id, name: em.name, category: em.category, duration: em.duration, loop: em.loop, keys };
  }
  const emoteFileText = (em) => JSON.stringify({ schema: 1, emote: emoteToJson(em) }, null, 1) + "\n";
  function emotePose(em, t, out) {
    for (let p = 0; p < EN; p++) {
      const ks = em.keys[p], o = p * EF;
      if (!ks.length) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; continue; }
      let k = null; if (t <= ks[0].t) k = ks[0]; else if (t >= ks[ks.length - 1].t) k = ks[ks.length - 1];
      if (k) { out[o] = k.p; out[o + 1] = k.y; out[o + 2] = k.r; out[o + 3] = k.oy; continue; }
      let i = 1; while (ks[i].t < t) i++;
      const a = ks[i - 1], b = ks[i], x = ease(b.ease, (t - a.t) / (b.t - a.t));
      out[o] = a.p + (b.p - a.p) * x; out[o + 1] = a.y + (b.y - a.y) * x; out[o + 2] = a.r + (b.r - a.r) * x; out[o + 3] = a.oy + (b.oy - a.oy) * x;
    }
  }
  const emoteLocalTime = (em, el) => (el < 0 ? 0 : em.loop ? el % em.duration : el >= em.duration ? -1 : el);
  function EmoteController() {
    let cur = null, start = 0, speed = 1, blend = 0.2, fromAt = -1; const from = new Float64Array(EN * EF), fromW = new Float64Array(EN), tmp = new Float64Array(EN * EF);
    const C = { lastEnd: "" };
    function sampleInto(now, pose, weight) {
      const wf = fromAt < 0 || blend <= 0 ? 0 : 1 - clamp((now - fromAt) / blend, 0, 1); let wc = 0;
      if (cur) { const lt = emoteLocalTime(cur, (now - start) * speed); emotePose(cur, lt < 0 ? cur.duration : lt, tmp); wc = blend <= 0 ? 1 : clamp((now - start) / blend, 0, 1); }
      for (let p = 0; p < EN; p++) {
        const a = cur && cur.keys[p].length ? wc : 0, b = fromW[p] * wf, sum = a + b, o = p * EF;
        if (sum <= 1e-9) { pose[o] = pose[o + 1] = pose[o + 2] = pose[o + 3] = 0; weight[p] = 0; continue; }
        for (let f = 0; f < EF; f++) pose[o + f] = (tmp[o + f] * a + from[o + f] * b) / sum;
        weight[p] = clamp(sum, 0, 1);
      }
    }
    const snapshot = (now) => { sampleInto(now, from, fromW); fromAt = now; };
    C.setSpeed = (s) => { speed = clamp(s, 0.25, 3); }; C.setBlend = (b) => { blend = clamp(b, 0, 1); };
    C.current = () => cur; C.playing = () => cur != null; C.active = (now) => cur != null || (fromAt >= 0 && now - fromAt < blend);
    C.play = (em, now) => { snapshot(now); cur = em; start = now; C.lastEnd = ""; };
    C.cancel = (now, reason) => { if (!cur) return; snapshot(now); cur = null; C.lastEnd = reason; };
    C.update = (now) => { if (cur && emoteLocalTime(cur, (now - start) * speed) < 0) { snapshot(now); cur = null; C.lastEnd = "finished"; } };
    C.sample = sampleInto;
    return C;
  }
  function parseWheel(text, known) {
    const slots = new Array(SLOTS).fill(null); if (text == null) return slots;
    for (const line of String(text).split(/\r\n|\r|\n/)) {
      const eq = line.indexOf("="); if (!line.startsWith("slot") || eq < 0) continue;
      const ns = line.substring(4, eq).trim(); if (!/^[+-]?\d+$/.test(ns)) continue; const n = parseInt(ns, 10), id = line.substring(eq + 1).trim();
      if (n >= 1 && n <= SLOTS && known.has(id)) slots[n - 1] = id;
    }
    return slots;
  }
  const writeWheel = (slots) => "auroras-wheel=1\n" + slots.map((id, k) => (id ? "slot" + (k + 1) + "=" + id + "\n" : "")).join("");
  function wheelSlot(dx, dy, dead) { if (dx * dx + dy * dy < dead * dead) return -1; let a = Math.atan2(dx, -dy); if (a < 0) a += Math.PI * 2; return Math.floor((a + Math.PI / SLOTS) / ((Math.PI * 2) / SLOTS)) % SLOTS; }

  // Quality presets and particles (fixed pool, no allocation per frame)
  const QUALITY = { LOW: { particleBudget: 64, starMultiplier: 0.5, aurora: false, nebula: false, domeRings: 8 }, BALANCED: { particleBudget: 256, starMultiplier: 1, aurora: true, nebula: true, domeRings: 16 }, HIGH: { particleBudget: 1024, starMultiplier: 1.5, aurora: true, nebula: true, domeRings: 32 } };
  const STYLE_IDS = ["aurora", "cyanViolet", "sakura", "magic", "geometric", "cosmic", "activation"];
  function Particles(capacity, seed) {
    const f = () => new Float32Array(capacity), P = { capacity, x: f(), y: f(), z: f(), vx: f(), vy: f(), vz: f(), age: f(), life: f(), size: f(), color: new Int32Array(capacity), count: 0, enabled: true };
    let budget = capacity, carry = 0; const rng = new Rng(seed);
    const kill = (k) => { const l = --P.count; for (const a of ["x", "y", "z", "vx", "vy", "vz", "age", "life", "size", "color"]) P[a][k] = P[a][l]; };
    P.setBudget = (maxCount, q, gf) => { budget = Math.max(0, Math.min(capacity, Math.min(maxCount, Math.round(q.particleBudget * clamp(gf, 0, 1))))); while (P.count > budget) kill(P.count - 1); };
    P.budget = () => budget;
    P.emit = (rate, dt, ox, oy, oz, spread, speed, lifetime, sz, rgb) => {
      if (!P.enabled || rate <= 0) return 0; carry += rate * dt; let n = Math.floor(carry); carry -= n; let s = 0;
      while (n-- > 0 && P.count < budget) { const k = P.count++; P.x[k] = ox + (rng.next() * 2 - 1) * spread; P.y[k] = oy + (rng.next() * 2 - 1) * spread; P.z[k] = oz + (rng.next() * 2 - 1) * spread;
        P.vx[k] = (rng.next() * 2 - 1) * speed * 0.3; P.vy[k] = (rng.next() * 0.5 + 0.25) * speed; P.vz[k] = (rng.next() * 2 - 1) * speed * 0.3; P.age[k] = 0; P.life[k] = lifetime * (0.75 + rng.next() * 0.5); P.size[k] = sz; P.color[k] = rgb; s++; }
      return s;
    };
    P.update = (dt, gravity, camDist, maxDist) => {
      if (!P.enabled || P.count === 0) return P.count; if (camDist > maxDist) { P.count = 0; return 0; }
      for (let k = P.count - 1; k >= 0; k--) { P.age[k] += dt; if (P.age[k] >= P.life[k]) { kill(k); continue; } P.vy[k] -= gravity * dt; P.x[k] += P.vx[k] * dt; P.y[k] += P.vy[k] * dt; P.z[k] += P.vz[k] * dt; }
      return P.count;
    };
    P.fade = (k) => 1 - P.age[k] / P.life[k];
    P.clear = () => { P.count = 0; carry = 0; };
    return P;
  }
  function Governor(fps) { const target = 1000 / fps; let ema = -1, factor = 1; return { update(ms) { ema = ema < 0 ? ms : ema + (ms - ema) * 0.1; if (ema > target * 1.25) factor = Math.max(0.1, factor * 0.9); else if (ema < target * 0.8) factor = Math.min(1, factor * 1.05); return factor; }, factor: () => factor }; }

  // Cosmetics
  const CAPE_DESIGNS = ["aurora", "sakura", "cosmic", "midnight", "void", "custom"];
  const f32 = Math.fround;
  function CapeSim() {
    let cx = 0, cy = 0, cz = 0, init = false; const S = { swing: 0, sideways: 0, rise: 0 };
    S.tick = (x, y, z, yawDeg, sneaking, stride, walkPhase) => {
      if (!init || Math.abs(x - cx) > 10 || Math.abs(y - cy) > 10 || Math.abs(z - cz) > 10) { cx = x; cy = y; cz = z; init = true; }
      cx += (x - cx) * 0.25; cy += (y - cy) * 0.25; cz += (z - cz) * 0.25;
      const dx = cx - x, dy = cy - y, dz = cz - z, rad = (yawDeg * Math.PI) / 180, s = Math.sin(rad), c = -Math.cos(rad);
      let q = f32(clamp(dy * 10, -6, 32)); const r = f32(clamp((dx * s + dz * c) * 100, 0, 150)), side = f32(clamp((dx * c - dz * s) * 100, -20, 20));
      q = f32(q + f32(Math.sin(walkPhase * 6) * 32 * stride)); if (sneaking) q = f32(q + 25);
      S.rise = q; S.swing = f32(f32(6 + f32(r / 2)) + q); S.sideways = f32(side / 2);
    };
    return S;
  }
  function capeScale(w, h) { if (w === 22 && h === 17) return 0; for (let s = 1; s <= 8; s *= 2) if (w === 64 * s && h === 32 * s) return s; throw new Error(`Cape images must be 64x32 (or 128x64, 256x128, 512x256), or the old 22x17 layout. This one is ${w}x${h}.`); }
  const CAPE_FACES = [[1, 1, 10, 16], [12, 1, 10, 16], [0, 1, 1, 16], [11, 1, 1, 16], [1, 0, 10, 1], [11, 0, 10, 1]];
  function totemPose(t, rx, ry) { const f = clamp(t, 0, 1), g = f * f, h = f * g, i = 10.25 * h * g - 24.95 * g * g + 25.5 * h - 13.8 * g + 4.0 * f, j = i * Math.PI; return [rx * Math.abs(Math.sin(j * 2)), ry * Math.abs(Math.sin(j * 2)), 50 + 175 * Math.sin(j), 900 * Math.abs(Math.sin(j)), 6 * Math.cos(f * 8)]; }

  // Settings rules (same as Config.Registry.validate) and the profile file format the mod reads
  const INTEGER = /^-?\d{1,9}$/, DECIMAL = /^-?\d{1,9}(\.\d{1,12})?$/, HEXC = /^[0-9A-Fa-f]{6}$/;
  function makeRules(registry) {
    const mods = new Map(registry.modules.map((m) => [m.id, m]));
    const validate = (key, v) => {
      if (typeof v !== "string" || v.length > 64 || /[\r\n]/.test(v)) return "bad value";
      if (key === "settings.quality") return ["LOW", "BALANCED", "HIGH"].includes(v) ? null : "quality must be LOW, BALANCED or HIGH";
      if (key === "settings.guiKey") return /^-?\d{1,3}$/.test(v) && +v >= 0 && +v <= 348 ? null : "bad key code";
      const dot = key.indexOf("."); if (dot < 1) return "unknown key " + key;
      const m = mods.get(key.slice(0, dot)); if (!m) return "unknown module in " + key;
      const d = m.settings.find((s) => s.key === key.slice(dot + 1)); if (!d) return "unknown setting " + key;
      switch (d.type) {
        case "BOOL": return v === "true" || v === "false" ? null : key + " must be true or false";
        case "INT": case "KEY": if (!INTEGER.test(v)) return key + " is not a number"; return +v >= d.min && +v <= d.max ? null : key + " out of range";
        case "DOUBLE": if (!DECIMAL.test(v)) return key + " is not a number"; return +v >= d.min && +v <= d.max ? null : key + " out of range";
        case "COLOR": return HEXC.test(v) ? null : key + " must be a 6-digit hex colour";
        default: return (d.options || []).includes(v) ? null : key + " has an unknown option";
      }
    };
    const defaults = () => { const o = { "settings.guiKey": "344", "settings.quality": "BALANCED" }; for (const m of registry.modules) for (const s of m.settings) o[m.id + "." + s.key] = s.def; return o; };
    return { validate, defaults, modules: registry.modules, module: (id) => mods.get(id) };
  }
  const NAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,31}$/;
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  // Profile file format (same as Config.ProfileManager): version 2, with format-1 files migrated on read.
  const FORMAT = 2, MIGRATIONS = [{}, { "branding.enabled": "brandinghud.enabled" }];
  const migrateKey = (k, from) => { for (let v = from; v < FORMAT && k != null; v++) if (k in MIGRATIONS[v]) k = MIGRATIONS[v][k]; return k; };
  function exportProfile(name, values) { if (!NAME.test(name)) throw new Error("Bad profile name"); return "auroras-profile=" + FORMAT + "\nname=" + name + "\n" + Object.keys(values).sort(cmp).map((k) => k + "=" + values[k] + "\n").join(""); }
  /** strict (default) rejects the whole file on any bad line; lenient skips bad lines and reports how many in skipped. */
  function importProfile(text, rules, { strict = true } = {}) {
    if (typeof text !== "string" || text.length > 65536) throw new Error("File is too large or empty");
    const lines = text.split(/\r?\n/), fmt = lines.length < 2 ? -1 : lines[0] === "auroras-profile=1" ? 1 : lines[0] === "auroras-profile=2" ? 2 : -1;
    if (fmt < 0) throw new Error("Not an Auroras profile (or an unsupported version)");
    if (!lines[1].startsWith("name=")) throw new Error("Missing profile name"); const name = lines[1].slice(5); if (!NAME.test(name)) throw new Error("Bad profile name");
    const values = {}; let skipped = 0;
    for (let i = 2; i < lines.length; i++) {
      if (!lines[i].trim()) continue; const eq = lines[i].indexOf("=");
      if (eq < 1) { if (strict) throw new Error(`Line ${i + 1} is malformed`); skipped++; continue; }
      const k = migrateKey(lines[i].slice(0, eq), fmt), v = lines[i].slice(eq + 1); if (k == null) continue;
      const e = rules.validate(k, v); if (e) { if (strict) throw new Error(`Line ${i + 1}: ${e}`); skipped++; continue; } values[k] = v;
    }
    return { name, values, skipped, format: fmt };
  }
  function placeKey(server, world) {
    if (server && server.trim()) { let a = server.trim().toLowerCase(); if (a.endsWith(":25565")) a = a.slice(0, -6); while (a.endsWith(".")) a = a.slice(0, -1); return "server:" + a; }
    if (world && world.trim()) return "world:" + world.trim(); return null;
  }
  const PLACE = /^(server|world):[A-Za-z0-9._ -]{1,64}$/;

  // ----- HUD: placement maths (Hud.java) and HudKit formatters, animation and layouts -----
  const ANCHORS = ["TL", "TC", "TR", "CL", "C", "CR", "BL", "BC", "BR"];
  const idiv = (a, b) => Math.trunc(a / b);
  const hclamp = (x, y, w, h, sw, sh) => [Math.max(0, Math.min(x, Math.max(0, sw - w))), Math.max(0, Math.min(y, Math.max(0, sh - h)))];
  function resolve(anchor, offX, offY, w, h, sw, sh) { const i = ANCHORS.indexOf(anchor), ax = i % 3, ay = idiv(i, 3), x = ax === 0 ? 0 : ax === 1 ? idiv(sw - w, 2) : sw - w, y = ay === 0 ? 0 : ay === 1 ? idiv(sh - h, 2) : sh - h; return hclamp(x + offX, y + offY, w, h, sw, sh); }
  function fromPosition(x, y, w, h, sw, sh) {
    const cx = x + idiv(w, 2), cy = y + idiv(h, 2), ax = cx < idiv(sw, 3) ? 0 : cx < idiv(2 * sw, 3) ? 1 : 2, ay = cy < idiv(sh, 3) ? 0 : cy < idiv(2 * sh, 3) ? 1 : 2, a = ANCHORS[ay * 3 + ax], b = resolve(a, 0, 0, w, h, sw, sh);
    return { anchor: a, offX: x - b[0], offY: y - b[1] };
  }
  const scaledPx = (base, scale) => Math.max(1, Math.round(Math.fround(base * scale)));
  const scaleFromDrag = (scale, d, base) => Math.max(0.5, Math.min(3, Math.fround(scale + Math.fround(d / Math.max(1, base)))));
  function snap1(pos, len, th, targets) { let best = 0, bestAbs = th + 1; for (const e of [pos, pos + idiv(len, 2), pos + len]) for (const t of targets) { const d = t - e; if (Math.abs(d) < bestAbs) { bestAbs = Math.abs(d); best = d; } } return bestAbs <= th ? pos + best : pos; }
  /** Returns [x, y, guideX|null, guideY|null]; the guides are the lines the element now sits on, for drawing alignment guides. */
  function snap(x, y, w, h, sw, sh, th, others) {
    const xs = [0, idiv(sw, 2), sw], ys = [0, idiv(sh, 2), sh];
    for (const o of others) { xs.push(o[0], o[0] + idiv(o[2], 2), o[0] + o[2]); ys.push(o[1], o[1] + idiv(o[3], 2), o[1] + o[3]); }
    const nx = snap1(x, w, th, xs), ny = snap1(y, h, th, ys), c = hclamp(nx, ny, w, h, sw, sh);
    const guide = (p, len, vals) => { for (const e of [p, p + idiv(len, 2), p + len]) if (vals.includes(e)) return e; return null; };
    return [c[0], c[1], guide(c[0], w, xs), guide(c[1], h, ys)]; // a guide shows whenever the element sits on a line, snapped or already aligned
  }
  const STYLES = { minimal: { padX: 3, padY: 2, label: false, accent: 0 }, compact: { padX: 2, padY: 1, label: false, accent: 0 }, expanded: { padX: 5, padY: 3, label: true, accent: 2 } };
  const styleOf = (s) => STYLES[s] || STYLES.minimal;
  const box = (st, tw, th) => { const s = styleOf(st); return [tw + s.padX * 2 + s.accent, th + s.padY * 2]; };
  const argb = (rgb, pct, fade) => ((Math.round(255 * clamp(pct / 100, 0, 1) * clamp(fade, 0, 1)) << 24) | (rgb & 0xffffff)) >>> 0;
  /**
   * Java's String.format("%.Nf"): rounds the shortest decimal form of the double half-up (so -5.55 -> -5.6, where JS
   * toFixed gives -5.5). Like Calc.num, "-0.0" becomes "0.0".
   */
  function fmtFixed(v, dec) {
    if (!isFinite(v)) return String(v);
    let t = Math.abs(v).toString(), e = 0; const m = /^(\d+)(?:\.(\d+))?e([+-]\d+)$/.exec(t);
    if (m) { const digits = m[1] + (m[2] || ""); e = +m[3] - (m[2] || "").length; t = e >= 0 ? digits + "0".repeat(e) : (digits.length > -e ? digits.slice(0, digits.length + e) + "." + digits.slice(digits.length + e) : "0." + "0".repeat(-e - digits.length) + digits); }
    let [ip, fp = ""] = t.split(".");
    if (fp.length > dec) { const up = fp[dec] >= "5"; fp = fp.slice(0, dec); if (up) { const all = (ip + fp).split("").map(Number); let i = all.length - 1; while (i >= 0) { if (all[i] < 9) { all[i]++; break; } all[i] = 0; i--; } if (i < 0) all.unshift(1); const str = all.join(""); ip = str.slice(0, str.length - dec) || "0"; fp = str.slice(str.length - dec); } }
    else fp = fp.padEnd(dec, "0");
    const out = dec > 0 ? ip + "." + fp : ip;
    return v < 0 && /[1-9]/.test(out) ? "-" + out : out;
  }
  const jnum = fmtFixed;
  const H = {
    fps(fps, avg, ms, showAvg, showMs, st) { let b = (st === "compact" ? "" : "FPS ") + fps; if (showAvg) b += (st === "compact" ? " / " : " · avg ") + Math.round(avg); if (showMs) b += " · " + fmtFixed(ms, 1) + " ms"; return st === "compact" ? b + " fps" : b; },
    coords(x, y, z, dec, sx, sy, sz, dir) { let b = ""; if (sx) b += "X " + fmtFixed(x, dec); if (sy) b += (b ? "  " : "") + "Y " + fmtFixed(y, dec); if (sz) b += (b ? "  " : "") + "Z " + fmtFixed(z, dec); if (dir != null) b += (b ? "  " : "") + dir; return b || "—"; },
    cps(l, r, showRight, st) { if (st === "compact") return showRight ? l + " | " + r : String(l); return showRight ? "CPS " + l + " | " + r : "CPS " + l; },
    ping: (ms) => (ms < 0 ? "Ping n/a" : "Ping " + ms + " ms"),
    pingLevel: (ms, good, ok) => (ms < 0 ? -1 : ms <= good ? 0 : ms <= ok ? 1 : 2),
    PING_COLORS: [0x6fcf97, 0xe0b45a, 0xe57373, 0x9aa3b2],
    potionTime(t) { if (t < 0) return "∞"; const s = idiv(t, 20), h = idiv(s, 3600), m = idiv(s % 3600, 60), sec = s % 60, p = (n) => String(n).padStart(2, "0"); return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`; },
    potionName(name, a) { const r = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"]; return name + (a >= 0 && a < r.length ? r[a] : " " + (a + 1)); },
    potionOrder(names, ticks, mode) { const t = (i) => (ticks[i] < 0 ? Infinity : ticks[i]), byName = (a, b) => cmp(names[a], names[b]), byTime = (a, b) => t(a) - t(b) || 0; return names.map((_, i) => i).sort(mode === "name" ? (a, b) => byName(a, b) || byTime(a, b) : (a, b) => byTime(a, b) || byName(a, b)); },
    durability(max, dmg, fmt) { if (max <= 0) return ""; const left = Math.max(0, Math.min(max, max - dmg)), pct = Math.round((left * 100) / max); if (fmt === "bar") return "█".repeat(Math.max(1, Math.round((left * 6) / max))); return fmt === "numeric" ? Math.max(0, max - dmg) + "/" + max : pct + "%"; },
    session(ms) { const s = Math.max(0, Math.trunc(ms / 1000)), p = (n) => String(n).padStart(2, "0"); return `${Math.trunc(s / 3600)}:${p(Math.trunc((s % 3600) / 60))}:${p(s % 60)}`; },
    sessionInfo(ver, ld, inst, srv, ms, v, l, i, sv, d) { const p = []; if (v && ver != null) p.push(ver); if (l && ld != null) p.push(ld); if (i && inst && inst.trim()) p.push(inst); if (sv && srv && srv.trim()) p.push(srv); if (d) p.push(H.session(ms)); return p.length ? p.join(" · ") : "—"; },
    target(name, hp, max, dist, sh, sd) { let b = name == null ? "" : name; if (sh && hp >= 0 && max > 0) b += "  " + jnum(Math.round(hp * 2) / 2, hp % 1 === 0 ? 0 : 1) + " / " + jnum(max, max % 1 === 0 ? 0 : 1) + " ♥"; if (sd && dist >= 0) b += "  " + fmtFixed(dist, 1) + " m"; return b; },
    spotify(title, artist, playing, prog, dur, showProg, status) {
      if (status && status.trim()) return "Spotify: " + status; if (!title || !title.trim()) return "Spotify: nothing playing";
      const mmss = (ms) => { const s = Math.max(0, Math.trunc(ms / 1000)); return Math.trunc(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
      let b = (playing ? "▶ " : "❚❚ ") + title; if (artist && artist.trim()) b += " — " + artist; if (showProg && dur > 0) b += "  " + mmss(prog) + " / " + mmss(dur); return b;
    },
    spotifyCard(layout, showArt, showProgress) {
      const ex = layout === "expanded", pad = ex ? 6 : 4, art = ex ? 32 : 16, w = ex ? 176 : 148, textX = pad + (showArt ? art + (ex ? 7 : 5) : 0), textW = w - textX - pad;
      if (ex) return { w, h: pad * 2 + art, art: showArt ? art : 0, pad, textX, textW, titleY: pad + 2, artistY: pad + 13, barY: pad + art - 6, barH: 2, expanded: true };
      const h = pad * 2 + art + (showProgress ? 3 : 0); return { w, h, art: showArt ? art : 0, pad, textX, textW, titleY: pad + Math.trunc((art - 8) / 2), artistY: -1, barY: h - 2, barH: 1, expanded: false };
    },
    marquee(textW, boxW, sec, pxPerS, pauseS, rm) {
      if (textW <= boxW || rm || pxPerS <= 0) return 0; const travel = textW - boxW + 12, scrollS = travel / pxPerS, cycle = pauseS * 2 + scrollS, t = ((sec % cycle) + cycle) % cycle;
      if (t < pauseS) return 0; if (t < pauseS + scrollS) return Math.round((t - pauseS) * pxPerS * 2) / 2; return travel;
    },
    progressFrac: (p, d) => (d <= 0 ? 0 : clamp(p / d, 0, 1)),
    Smooth() { let init = false; const S = { value: 0, update(t, dt, tau, rm) { if (!init || rm || tau <= 0) { S.value = t; init = true; return t; } S.value += (t - S.value) * (1 - Math.exp(-Math.max(0, dt) / tau)); if (Math.abs(t - S.value) < 1e-3) S.value = t; return S.value; } }; return S; },
    Fade() { const F = { alpha: 0, update(vis, dt, dur, rm) { if (rm || dur <= 0) return (F.alpha = vis ? 1 : 0); const st = Math.max(0, dt) / dur; F.alpha = vis ? Math.min(1, F.alpha + st) : Math.max(0, F.alpha - st); return F.alpha; } }; return F; },
    keyGlow: (cur, pressed, dt, anim) => H.keyGlowFade(cur, pressed, dt, anim ? 0.12 : 0),
    keyGlowFade: (cur, pressed, dt, fadeS) => (pressed ? 1 : fadeS > 0 ? Math.max(0, cur - Math.max(0, dt) / fadeS) : 0),
    hsv(hue, sat, val) {
      const h = (((hue % 1) + 1) % 1) * 6, c = val * sat, x = c * (1 - Math.abs((h % 2) - 1)), m = val - c, i = Math.trunc(h);
      const [r, g, b] = i === 0 ? [c, x, 0] : i === 1 ? [x, c, 0] : i === 2 ? [0, c, x] : i === 3 ? [0, x, c] : i === 4 ? [x, 0, c] : [c, 0, x];
      return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
    },
    /** HudKit.textColor: solid, chroma (flowing rainbow) or gradient (colour and accent in a sliding wave). */
    textColor(mode, color, accent, px, sec, speed) {
      if (mode === "chroma") return H.hsv(px / 160 - (sec * speed) / 4, 0.62, 1);
      if (mode === "gradient") return mix(color, accent, 0.5 + 0.5 * Math.sin(px / 24 - sec * speed * 2));
      return color;
    },
    perChar: (mode) => mode === "chroma" || mode === "gradient",
    MAX_RADIUS: 6,
    cornerInset: (r, i) => (i >= r ? 0 : r - Math.floor(Math.sqrt(r * r - (r - i) * (r - i)))),
    fitRadius: (r, w, h) => Math.max(0, Math.min(r, idiv(Math.min(w, h), 3))),
    /** HudKit.roundRect: a rounded box as non-overlapping rectangles [x0, y0, x1, y1, ...]. */
    roundRect(w, h, r) {
      r = H.fitRadius(r, w, h); const o = [], put = (a, b, c, d) => { if (c > a && d > b) o.push(a, b, c, d); };
      if (r === 0) { put(0, 0, w, h); return o; }
      for (let i = 0; i < r; i++) { const n = H.cornerInset(r, i); put(n, i, w - n, i + 1); put(n, h - 1 - i, w - n, h - i); }
      put(0, r, w, h - r); return o;
    },
    /** HudKit.roundOutline: the 1 px edge of the same box. */
    roundOutline(w, h, r) {
      r = H.fitRadius(r, w, h); const o = [], put = (a, b, c, d) => { if (c > a && d > b) o.push(a, b, c, d); };
      if (w <= 2 || h <= 2) { put(0, 0, w, h); return o; }
      if (r === 0) { put(0, 0, w, 1); put(0, h - 1, w, h); put(0, 1, 1, h - 1); put(w - 1, 1, w, h - 1); return o; }
      const top = H.cornerInset(r, 0); put(top, 0, w - top, 1); put(top, h - 1, w - top, h);
      for (let i = 1; i < r; i++) { const n = H.cornerInset(r, i), x1 = Math.max(n + 1, H.cornerInset(r, i - 1)); put(n, i, x1, i + 1); put(w - x1, i, w - n, i + 1); put(n, h - 1 - i, x1, h - i); put(w - x1, h - 1 - i, w - n, h - i); }
      const last = H.cornerInset(r, r - 1); if (last > 1) { put(0, r, last, r + 1); put(w - last, r, w, r + 1); put(0, h - 1 - r, last, h - r); put(w - last, h - 1 - r, w, h - r); }
      const y0 = last > 1 ? r + 1 : r, y1 = last > 1 ? h - r - 1 : h - r; put(0, y0, 1, y1); put(w - 1, y0, w, y1); return o;
    },
    moduleList(list, sort) { const byName = (a, b) => cmp(a.name.toLowerCase(), b.name.toLowerCase()); return [...list].sort(sort === "name" ? byName : sort === "category" ? (a, b) => cmp(a.category, b.category) || byName(a, b) : (a, b) => b.width - a.width || byName(a, b)); },
    lineX: (colX, colW, lineW, right) => (right ? colX + colW - lineW : colX),
  };
  const LAYOUT_KEYS = ["enabled", "anchor", "offX", "offY", "scale", "style", "color", "accent", "background", "bgOpacity", "border", "shadow", "opacity", "bgColor", "radius", "textMode", "chromaSpeed"];
  // ----- Keystrokes widget (Keystrokes.java) -----
  const KS = {
    FORWARD: 0, LEFT: 1, BACK: 2, RIGHT: 3, ATTACK: 4, USE: 5, JUMP: 6, SNEAK: 7, SPRINT: 8, INPUTS: 9,
    spaceHeight: (size, ss) => (ss === "text" ? size : Math.max(6, Math.round(size * 0.5))),
    layout(size, gap, mouse, modifiers, space, ss) {
      size = Math.max(8, size); gap = Math.max(0, gap); const w = size * 3 + gap * 2, half = idiv(w - gap, 2), k = [], key = (input, x, y, kw, kh) => k.push({ input, x, y, w: kw, h: kh }); let y = 0;
      key(0, size + gap, y, size, size); y += size + gap;
      key(1, 0, y, size, size); key(2, size + gap, y, size, size); key(3, (size + gap) * 2, y, size, size); y += size + gap;
      if (mouse) { key(4, 0, y, half, size); key(5, half + gap, y, w - half - gap, size); y += size + gap; }
      if (modifiers) { const mh = Math.max(8, Math.round(size * 0.75)); key(7, 0, y, half, mh); key(8, half + gap, y, w - half - gap, mh); y += mh + gap; }
      if (space) { const sh = KS.spaceHeight(size, ss); key(6, 0, y, w, sh); y += sh + gap; }
      return { keys: k, w, h: y - gap };
    },
    WASD: ["W", "A", "S", "D", "LMB", "RMB", "Space", "Sneak", "Sprint"], ARROWS: ["▲", "◀", "▼", "▶", "LMB", "RMB", "Space", "Sneak", "Sprint"],
    SHORT: { "left button": "LMB", "right button": "RMB", "middle button": "MMB", "left shift": "LShift", "right shift": "RShift", "left control": "LCtrl", "right control": "RCtrl", "left ctrl": "LCtrl", "right ctrl": "RCtrl",
      "left alt": "LAlt", "right alt": "RAlt", "caps lock": "Caps", space: "Space", "not bound": "—", "up arrow": "▲", "down arrow": "▼", "left arrow": "◀", "right arrow": "▶", up: "▲", down: "▼", left: "◀", right: "▶", enter: "Enter", tab: "Tab", backspace: "Bksp" },
    shortName(name) {
      const n = name.trim(), low = n.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(KS.SHORT, low)) return KS.SHORT[low];
      if (low.startsWith("button ")) return "M" + n.slice(7).trim(); if (low.startsWith("mouse button ")) return "M" + n.slice(13).trim(); if (low.startsWith("keypad ")) return "Num" + n.slice(7).trim();
      if ([...n].length === 1) return n.toUpperCase(); return n.length <= 6 ? n : n.slice(0, 5) + "…";
    },
    label(mode, input, bound, ss) {
      if (input === 6 && ss !== "text") return "";
      if (mode === "bound" && bound != null && bound.trim()) { const s = KS.shortName(bound); return s; }
      return (mode === "arrows" ? KS.ARROWS : KS.WASD)[input];
    },
    fitScale: (tw, kw) => (tw <= 0 ? 1 : Math.min(1, Math.max(Math.fround(0.4), Math.fround((kw - 4) / tw)))),
    cpsLine: (h) => h >= 16,
  };
  function captureLayout(registry, values) { const out = {}; for (const m of registry.modules) if (m.settings.some((s) => s.key === "anchor")) for (const k of LAYOUT_KEYS) if (m.settings.some((s) => s.key === k)) out[m.id + "." + k] = values[m.id + "." + k]; return out; }
  function exportLayout(name, layout) { return "auroras-hudlayout=1\nname=" + name + "\n" + Object.keys(layout).sort(cmp).map((k) => k + "=" + layout[k] + "\n").join(""); }
  function importLayout(registry, rules, text) {
    if (typeof text !== "string" || text.length > 65536) throw new Error("File is too large or empty");
    const lines = text.split(/\r?\n/); if (lines.length < 2 || lines[0] !== "auroras-hudlayout=1" || !lines[1].startsWith("name=")) throw new Error("Not an Auroras HUD layout");
    const out = {}, hud = new Set(registry.modules.filter((m) => m.settings.some((s) => s.key === "anchor")).map((m) => m.id));
    for (let i = 2; i < lines.length; i++) {
      if (!lines[i].trim()) continue; const eq = lines[i].indexOf("="); if (eq < 1) throw new Error(`Line ${i + 1} is malformed`);
      const k = lines[i].slice(0, eq), v = lines[i].slice(eq + 1), dot = k.indexOf(".");
      if (dot < 1 || !hud.has(k.slice(0, dot)) || !LAYOUT_KEYS.includes(k.slice(dot + 1))) throw new Error(`Line ${i + 1}: not a HUD layout setting`);
      const e = rules.validate(k, v); if (e) throw new Error(`Line ${i + 1}: ${e}`); out[k] = v;
    }
    return out;
  }
  const V = { EMOTE_PARTS, EASINGS, EMOTE_CATEGORIES, EMOTE_ID, ease, parseEmote, parseEmoteLibrary, parseEmoteFile, emoteToJson, emoteFileText, emotePose, emoteLocalTime, EmoteController, parseWheel, writeWheel, wheelSlot,
    FX_NONE, parseFx, FX_BUDGET, skyQuality, fxClock, fxU, SLOT, METEOR_FIELDS, meteors, petal, cloud, cloudColor, nebula, auroraWave, auroraShimmer, Constellations,
    clamp, THEME_IDS, hex, loadThemes, NONE, skyAngle, daylight, sunsetAmount, nightAmount, mix, adjust, skyColor, Rng, StarField, auroraElevation, themeFor,
    QUALITY, STYLE_IDS, Particles, Governor, CAPE_DESIGNS, CapeSim, capeScale, CAPE_FACES, totemPose, makeRules, exportProfile, importProfile, placeKey, PLACE, NAME,
    FORMAT, ANCHORS, resolve, fromPosition, snap, scaledPx, scaleFromDrag, box, argb, styleOf, H, KS, LAYOUT_KEYS, captureLayout, exportLayout, importLayout };
  if (typeof module !== "undefined" && module.exports) module.exports = V; else root.AurorasVisuals = V;
})(typeof window !== "undefined" ? window : globalThis);
