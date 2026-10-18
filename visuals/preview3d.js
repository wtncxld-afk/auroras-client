// Small canvas renderer for the launcher's preview studios: textured Minecraft-style boxes (players, capes) and extruded
// item sprites (the totem, built the way Minecraft builds a flat item model). Painter's algorithm with back-face culling
// and simple directional light. Works without WebGL, so it runs everywhere the launcher does and can be tested headless.
(function (root) {
  "use strict";
  // A quad: corners p (12 floats), normal n (3), color c (0xRRGGBB), alpha a.
  const quad = (p, n, c, a) => ({ p, n, c, a: a == null ? 1 : a });
  const px = (tex, x, y) => { const i = (y * tex.w + x) * 4, d = tex.data; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };

  /** Item model: every opaque pixel is a 1x1 block of the given thickness; sides only where the neighbour is transparent. */
  function extrudeSprite(tex, thickness = 1) {
    const out = [], w = tex.w, h = tex.h, t = thickness / 2, X = (i) => i - w / 2, Y = (j) => h / 2 - j;
    const op = (i, j) => i >= 0 && j >= 0 && i < w && j < h && px(tex, i, j)[3] > 127;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!op(i, j)) continue; const [r, g, b] = px(tex, i, j), c = (r << 16) | (g << 8) | b, x0 = X(i), x1 = X(i + 1), y0 = Y(j + 1), y1 = Y(j);
      out.push(quad([x0, y0, t, x1, y0, t, x1, y1, t, x0, y1, t], [0, 0, 1], c), quad([x1, y0, -t, x0, y0, -t, x0, y1, -t, x1, y1, -t], [0, 0, -1], c));
      if (!op(i - 1, j)) out.push(quad([x0, y0, -t, x0, y0, t, x0, y1, t, x0, y1, -t], [-1, 0, 0], c));
      if (!op(i + 1, j)) out.push(quad([x1, y0, t, x1, y0, -t, x1, y1, -t, x1, y1, t], [1, 0, 0], c));
      if (!op(i, j - 1)) out.push(quad([x0, y1, t, x1, y1, t, x1, y1, -t, x0, y1, -t], [0, 1, 0], c));
      if (!op(i, j + 1)) out.push(quad([x0, y0, -t, x1, y0, -t, x1, y0, t, x0, y0, t], [0, -1, 0], c));
    }
    return out;
  }

  /**
   * Minecraft box with the standard texture layout at (u, v): top, bottom, right(-x), front(+z), left(+x), back(-z).
   * Origin (x0, y0, z0) is the box's minimum corner; size w, h, d in pixels; inflate grows it (outer skin layers).
   * scale maps texture pixels for HD textures. Transparent texels are skipped.
   */
  function texturedBox(tex, x0, y0, z0, w, h, d, u, v, inflate = 0, scale = 1) {
    const out = [], X0 = x0 - inflate, Y0 = y0 - inflate, Z0 = z0 - inflate, X1 = x0 + w + inflate, Y1 = y0 + h + inflate, Z1 = z0 + d + inflate;
    const sx = (X1 - X0) / w, sy = (Y1 - Y0) / h, sz = (Z1 - Z0) / d;
    const face = (tu, tv, tw, th, corner) => {
      for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
        const tx = Math.floor((tu + i) * scale), ty = Math.floor((tv + j) * scale); if (tx < 0 || ty < 0 || tx >= tex.w || ty >= tex.h) continue;
        const [r, g, b, a] = px(tex, tx, ty); if (a < 16) continue; out.push(corner(i, j, (r << 16) | (g << 8) | b, a / 255));
      }
    };
    // front (+z): texel i -> x left to right, j -> y top to bottom
    face(u + d, v + d, w, h, (i, j, c, a) => quad([X0 + i * sx, Y1 - (j + 1) * sy, Z1, X0 + (i + 1) * sx, Y1 - (j + 1) * sy, Z1, X0 + (i + 1) * sx, Y1 - j * sy, Z1, X0 + i * sx, Y1 - j * sy, Z1], [0, 0, 1], c, a));
    // back (-z): seen from behind, texel i runs +x -> -x
    face(u + 2 * d + w, v + d, w, h, (i, j, c, a) => quad([X1 - i * sx, Y1 - (j + 1) * sy, Z0, X1 - (i + 1) * sx, Y1 - (j + 1) * sy, Z0, X1 - (i + 1) * sx, Y1 - j * sy, Z0, X1 - i * sx, Y1 - j * sy, Z0], [0, 0, -1], c, a));
    // right side (-x): texel i runs back -> front
    face(u, v + d, d, h, (i, j, c, a) => quad([X0, Y1 - (j + 1) * sy, Z0 + i * sz, X0, Y1 - (j + 1) * sy, Z0 + (i + 1) * sz, X0, Y1 - j * sy, Z0 + (i + 1) * sz, X0, Y1 - j * sy, Z0 + i * sz], [-1, 0, 0], c, a));
    // left side (+x): texel i runs front -> back
    face(u + d + w, v + d, d, h, (i, j, c, a) => quad([X1, Y1 - (j + 1) * sy, Z1 - i * sz, X1, Y1 - (j + 1) * sy, Z1 - (i + 1) * sz, X1, Y1 - j * sy, Z1 - (i + 1) * sz, X1, Y1 - j * sy, Z1 - i * sz], [1, 0, 0], c, a));
    // top (+y): texel j runs back -> front
    face(u + d, v, w, d, (i, j, c, a) => quad([X0 + i * sx, Y1, Z0 + (j + 1) * sz, X0 + (i + 1) * sx, Y1, Z0 + (j + 1) * sz, X0 + (i + 1) * sx, Y1, Z0 + j * sz, X0 + i * sx, Y1, Z0 + j * sz], [0, 1, 0], c, a));
    // bottom (-y): texel j runs front -> back
    face(u + d + w, v, w, d, (i, j, c, a) => quad([X0 + i * sx, Y0, Z1 - (j + 1) * sz, X0 + (i + 1) * sx, Y0, Z1 - (j + 1) * sz, X0 + (i + 1) * sx, Y0, Z1 - j * sz, X0 + i * sx, Y0, Z1 - j * sz], [0, -1, 0], c, a));
    return out;
  }

  /** Rotates quads about a pivot: angles in radians, applied X then Y then Z. Returns new quads. */
  function rotate(quads, pivot, ax, ay, az) {
    const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
    const R = (x, y, z) => { let y1 = y * cx - z * sx, z1 = y * sx + z * cx; let x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy; return [x2 * cz - y1 * sz, x2 * sz + y1 * cz, z2]; };
    return quads.map((q) => { const p = new Array(12); for (let k = 0; k < 4; k++) { const r = R(q.p[k * 3] - pivot[0], q.p[k * 3 + 1] - pivot[1], q.p[k * 3 + 2] - pivot[2]); p[k * 3] = r[0] + pivot[0]; p[k * 3 + 1] = r[1] + pivot[1]; p[k * 3 + 2] = r[2] + pivot[2]; } return quad(p, R(q.n[0], q.n[1], q.n[2]), q.c, q.a); });
  }
  const translate = (quads, dx, dy, dz) => quads.map((q) => quad(q.p.map((v, i) => v + (i % 3 === 0 ? dx : i % 3 === 1 ? dy : dz)), q.n, q.c, q.a));
  const scaleQ = (quads, s) => quads.map((q) => quad(q.p.map((v) => v * s), q.n, q.c, q.a));

  const LIGHTS = { studio: { dir: [0.4, 0.75, 0.55], ambient: 0.55, bg: ["#1a2030", "#07090f"] }, warm: { dir: [0.6, 0.6, 0.5], ambient: 0.5, bg: ["#2b1d1a", "#0d0807"], tint: [1, 0.92, 0.82] },
    cool: { dir: [-0.5, 0.7, 0.5], ambient: 0.55, bg: ["#142433", "#05090f"], tint: [0.85, 0.95, 1.05] }, dramatic: { dir: [0.9, 0.35, 0.2], ambient: 0.25, bg: ["#0b0b10", "#000000"] } };
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  /**
   * Draws quads to a 2D canvas. camera = { yaw, pitch, dist, target:[x,y,z], fov }. Returns { drawn, culled }.
   * opts: { light: name or object, background: true, shadow: { y, r }, clear: true }
   */
  function render(ctx, W, H, quads, cam, opts = {}) {
    const L = typeof opts.light === "object" ? opts.light : LIGHTS[opts.light || "studio"], ld = norm(L.dir), tint = L.tint || [1, 1, 1];
    if (opts.clear !== false) { if (opts.background !== false) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, L.bg[0]); g.addColorStop(1, L.bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); } else ctx.clearRect(0, 0, W, H); }
    const t = cam.target || [0, 0, 0], cp = Math.cos(cam.pitch), eye = [t[0] + cam.dist * cp * Math.sin(cam.yaw), t[1] + cam.dist * Math.sin(cam.pitch), t[2] + cam.dist * cp * Math.cos(cam.yaw)];
    const f = norm([t[0] - eye[0], t[1] - eye[1], t[2] - eye[2]]), r = norm([f[1] * 0 - f[2] * 1, f[2] * 0 - f[0] * 0, f[0] * 1 - f[1] * 0]), u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const foc = H / 2 / Math.tan(((cam.fov || 30) * Math.PI) / 360);
    const proj = (x, y, z) => { const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2], zz = dx * f[0] + dy * f[1] + dz * f[2]; return [W / 2 + ((dx * r[0] + dy * r[1] + dz * r[2]) / zz) * foc, H / 2 - ((dx * u[0] + dy * u[1] + dz * u[2]) / zz) * foc, zz]; };
    if (opts.shadow) { const s = proj(t[0], opts.shadow.y, t[2]), e = proj(t[0] + opts.shadow.r, opts.shadow.y, t[2]), rad = Math.max(4, Math.abs(e[0] - s[0])), gr = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], rad);
      gr.addColorStop(0, "rgba(0,0,0,.45)"); gr.addColorStop(1, "rgba(0,0,0,0)"); ctx.save(); ctx.translate(s[0], s[1]); ctx.scale(1, 0.32); ctx.translate(-s[0], -s[1]); ctx.fillStyle = gr; ctx.fillRect(s[0] - rad, s[1] - rad, rad * 2, rad * 2); ctx.restore(); }
    const vis = []; let culled = 0;
    for (const q of quads) {
      const cx = (q.p[0] + q.p[3] + q.p[6] + q.p[9]) / 4, cy = (q.p[1] + q.p[4] + q.p[7] + q.p[10]) / 4, cz = (q.p[2] + q.p[5] + q.p[8] + q.p[11]) / 4;
      if (q.n[0] * (eye[0] - cx) + q.n[1] * (eye[1] - cy) + q.n[2] * (eye[2] - cz) <= 0) { culled++; continue; }
      vis.push([(cx - eye[0]) * f[0] + (cy - eye[1]) * f[1] + (cz - eye[2]) * f[2], q]);
    }
    vis.sort((a, b) => b[0] - a[0]);
    for (const [, q] of vis) {
      const k = L.ambient + (1 - L.ambient) * Math.max(0, q.n[0] * ld[0] + q.n[1] * ld[1] + q.n[2] * ld[2]);
      const col = `rgba(${Math.min(255, Math.round(((q.c >> 16) & 255) * k * tint[0]))},${Math.min(255, Math.round(((q.c >> 8) & 255) * k * tint[1]))},${Math.min(255, Math.round((q.c & 255) * k * tint[2]))},${q.a})`;
      ctx.beginPath(); for (let i = 0; i < 4; i++) { const s = proj(q.p[i * 3], q.p[i * 3 + 1], q.p[i * 3 + 2]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); } ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); if (q.a >= 1) { ctx.strokeStyle = col; ctx.lineWidth = 0.7; ctx.stroke(); }
    }
    return { drawn: vis.length, culled };
  }

  /** Player model in pixel units (feet at y = 0, facing +z), classic or slim arms, outer layer optional. Limb angles in radians. */
  function player(tex, { slim = false, layer = true, armSwing = 0, legSwing = 0, headYaw = 0, crouch = 0 } = {}) {
    // crouch 0..1 blends in Minecraft's sneaking pose (BipedEntityModel): body pitched 0.5 rad around the neck, head, body
    // and arms 3.2 px lower (head 4.2), arms pitched back 0.4 rad, legs moved 3.9 px back, and the whole model 2 px down.
    const aw = slim ? 3 : 4, parts = [], k = Math.max(0, Math.min(1, crouch)), down = (q, dy, dz = 0) => (k ? translate(q, 0, -dy * k, -dz * k) : q);
    const limb = (x0, y0, w, h, d, u, v, ou, ov, pivot, angle) => { let q = texturedBox(tex, x0, y0, -d / 2, w, h, d, u, v); if (layer) q = q.concat(texturedBox(tex, x0, y0, -d / 2, w, h, d, ou, ov, 0.25)); return angle ? rotate(q, pivot, angle, 0, 0) : q; };
    const head = limb(-4, 24, 8, 8, 8, 0, 0, 32, 0, null, 0); parts.push(...down(headYaw ? rotate(head, [0, 24, 0], 0, headYaw, 0) : head, 4.2));
    parts.push(...down(limb(-4, 12, 8, 12, 4, 16, 16, 16, 32, [0, 24, 0], 0.5 * k), 3.2));
    parts.push(...down(limb(-4 - aw, 12, aw, 12, 4, 40, 16, 40, 32, [-4 - aw / 2, 22, 0], armSwing + 0.4 * k), 3.2), ...down(limb(4, 12, aw, 12, 4, 32, 48, 48, 48, [4 + aw / 2, 22, 0], -armSwing + 0.4 * k), 3.2));
    parts.push(...down(limb(-4, 0, 4, 12, 4, 0, 16, 0, 32, [-2, 12, 0], -legSwing), 0.2, 3.9), ...down(limb(0, 0, 4, 12, 4, 16, 48, 0, 48, [2, 12, 0], legSwing), 0.2, 3.9));
    return k ? translate(parts, 0, -2 * k, 0) : parts;
  }
  /**
   * Player posed by an emote: pose holds pitch, yaw, roll (degrees, Minecraft model convention) and a height offset for
   * head, body, right arm, left arm, right leg, left leg and root (Emotes.PARTS). Minecraft models have y down and face -z;
   * this space has y up and faces +z, so pitch keeps its sign and yaw and roll flip. Pivots match the game's player model.
   */
  const D2R = Math.PI / 180;
  function solidBox(x0, y0, z0, w, h, d, c) {
    const x1 = x0 + w, y1 = y0 + h, z1 = z0 + d;
    return [quad([x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1], [0, 0, 1], c), quad([x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0], [0, 0, -1], c),
      quad([x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0], [-1, 0, 0], c), quad([x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1], [1, 0, 0], c),
      quad([x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0], [0, 1, 0], c), quad([x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1], [0, -1, 0], c)];
  }
  function posedPlayer(tex, pose, { slim = false, layer = true, colors = null } = {}) {
    const aw = slim ? 3 : 4, out = [], P = (i) => [pose[i * 4] * D2R, -pose[i * 4 + 1] * D2R, -pose[i * 4 + 2] * D2R];
    // tex null: flat-colored boxes (6 quads each) for cheap animated thumbnails; colors = [head, body, arms, legs]
    const cols = colors || [0xd9a066, 0x6fe3ff, 0xd9a066, 0x3b4a7a], ci = [0, 1, 2, 2, 3, 3];
    let part = 0; const box = (x0, y0, w, h, d, u, v, ou, ov) => { if (!tex) return solidBox(x0, y0, -d / 2, w, h, d, cols[ci[part++]]); let q = texturedBox(tex, x0, y0, -d / 2, w, h, d, u, v); if (layer) q = q.concat(texturedBox(tex, x0, y0, -d / 2, w, h, d, ou, ov, 0.25)); return q; };
    const put = (q, i, pivot) => { const [a, b, c] = P(i); out.push(...(a || b || c ? rotate(q, pivot, a, b, c) : q)); };
    put(box(-4, 24, 8, 8, 8, 0, 0, 32, 0), 0, [0, 24, 0]);
    put(box(-4, 12, 8, 12, 4, 16, 16, 16, 32), 1, [0, 24, 0]);
    put(box(-4 - aw, 12, aw, 12, 4, 40, 16, 40, 32), 2, [-5, 22, 0]);
    put(box(4, 12, aw, 12, 4, 32, 48, 48, 48), 3, [5, 22, 0]);
    put(box(-4, 0, 4, 12, 4, 0, 16, 0, 32), 4, [-1.9, 12, 0]);
    put(box(0, 0, 4, 12, 4, 16, 48, 0, 48), 5, [1.9, 12, 0]);
    const oy = pose[6 * 4 + 3]; return oy ? translate(out, 0, -oy, 0) : out;
  }
  /** Cape box (10x16x1) hanging from the shoulders, swung back by swingDeg like Minecraft's cape. */
  function cape(tex, scale, swingDeg, sidewaysDeg, crouch = 0) {
    // Like Minecraft, the box is turned around so its "front" texture is the outside, seen from behind the player.
    const q = rotate(texturedBox(tex, -5, 8, -3, 10, 16, 1, 0, 0, 0, scale), [0, 16, -2.5], 0, Math.PI, 0);
    const c = rotate(q, [0, 24, -2], (swingDeg * Math.PI) / 180, 0, (sidewaysDeg * Math.PI) / 180), k = Math.max(0, Math.min(1, crouch));
    // The cape hangs from the body, so while sneaking it follows the body's tilt and drop (player(), crouch).
    return k ? translate(rotate(c, [0, 24, 0], 0.5 * k, 0, 0), 0, -5.2 * k, 0) : c;
  }
  const V = { quad, extrudeSprite, texturedBox, rotate, translate, scale: scaleQ, render, player, posedPlayer, cape, LIGHTS };
  if (typeof module !== "undefined" && module.exports) module.exports = V; else root.AurorasPreview = V;
})(typeof window !== "undefined" ? window : globalThis);
