package gg.auroras.core;

/**
 * The player's head as a real 3D cube for the radial menu's hub: the skin's head (8x8x8) with the hat layer (one
 * pixel larger all round, see-through where the skin is) ray-traced at the screen's real pixel size, so it stays crisp
 * at any GUI scale. Texels stay hard-edged like Minecraft; the cube's outline is anti-aliased with 4x4 samples per
 * pixel. Lit from the top left, with darker sides and bottom, like the game's own GUI lighting.
 *
 * The skin comes in as the top 64x16 of the skin file (head at u 0..31, hat at u 32..63), straight ARGB.
 * Follow (below) turns the head toward the mouse with a smooth, frame-rate independent spring.
 */
public final class Head3D {
    public static final int SKIN_W = 64, SKIN_H = 16;
    /** Furthest the head turns: left/right and up/down, in degrees. */
    public static final double MAX_YAW = 42, MAX_PITCH = 28;
    private static final int SS = 4; // samples per pixel side
    private static final double HEAD = 4, HAT = 4.5, CAM = 48, VIEW = 7.2; // half sizes in skin pixels, camera distance, half view
    private static final double[] LIGHT = norm(-0.45, 0.75, 0.62);
    private final int[] skin;

    public Head3D(int[] skin) {
        if (skin == null || skin.length != SKIN_W * SKIN_H) throw new IllegalArgumentException("The head skin must be 64x16");
        this.skin = skin.clone();
    }

    /**
     * Renders the head into a size x size straight-ARGB image. yaw > 0 turns the face to the viewer's right, pitch > 0
     * tilts it down; both in degrees.
     */
    public int[] render(int size, double yaw, double pitch) {
        int[] out = new int[size * size];
        double cy = Math.cos(Math.toRadians(yaw)), sy = Math.sin(Math.toRadians(yaw)), cp = Math.cos(Math.toRadians(pitch)), sp = Math.sin(Math.toRadians(pitch));
        double k = 2 * VIEW / size, step = 1.0 / SS;
        double[] o = toHead(0, 0, CAM, cy, sy, cp, sp), d = new double[3], hit = new double[4];
        // the ray direction is linear in the view-plane point, so step it instead of rotating every sample
        double[] ex = toHead(1, 0, 0, cy, sy, cp, sp), ey = toHead(0, 1, 0, cy, sy, cp, sp), ez = toHead(0, 0, -CAM, cy, sy, cp, sp);
        // only pixels the cube can cover: the hat's bounding sphere seen from the camera, plus a pixel
        double rad = HAT * Math.sqrt(3) * CAM / (CAM - HAT * Math.sqrt(3)) / k + 1;
        int lo = Math.max(0, (int) Math.floor(size / 2.0 - rad)), hi = Math.min(size, (int) Math.ceil(size / 2.0 + rad));
        // one ray per pixel corner first; a pixel whose four corners agree is flat colour, the rest get 4x4 samples
        int gw = hi - lo + 1; int[] corner = new int[gw * gw];
        for (int j = 0; j < gw; j++) for (int i = 0; i < gw; i++) {
            double X = (lo + i - size / 2.0) * k, Y = -(lo + j - size / 2.0) * k;
            d[0] = ex[0] * X + ey[0] * Y + ez[0]; d[1] = ex[1] * X + ey[1] * Y + ez[1]; d[2] = ex[2] * X + ey[2] * Y + ez[2];
            corner[j * gw + i] = trace(o, d, hit, cy, sy, cp, sp);
        }
        for (int py = lo; py < hi; py++) for (int px = lo; px < hi; px++) {
            int q = (py - lo) * gw + (px - lo), c0 = corner[q];
            if (c0 == corner[q + 1] && c0 == corner[q + gw] && c0 == corner[q + gw + 1]) { out[py * size + px] = c0; continue; }
            float a = 0, r = 0, g = 0, b = 0;
            for (int j = 0; j < SS; j++) for (int i = 0; i < SS; i++) {
                double X = ((px + (i + 0.5) * step) - size / 2.0) * k, Y = -((py + (j + 0.5) * step) - size / 2.0) * k;
                d[0] = ex[0] * X + ey[0] * Y + ez[0]; d[1] = ex[1] * X + ey[1] * Y + ez[1]; d[2] = ex[2] * X + ey[2] * Y + ez[2];
                int c = trace(o, d, hit, cy, sy, cp, sp);
                if (c == 0) continue;
                float ca = (c >>> 24) / 255f; a += ca; r += ca * ((c >> 16) & 255); g += ca * ((c >> 8) & 255); b += ca * (c & 255);
            }
            if (a <= 0) continue;
            float n = SS * SS; int al = Math.round(a / n * 255);
            out[py * size + px] = al << 24 | Math.round(r / a) << 16 | Math.round(g / a) << 8 | Math.round(b / a);
        }
        return out;
    }

    /** Colour seen along one ray (head space), or 0. Hat first where its texel is solid, then the head. */
    private int trace(double[] o, double[] d, double[] hit, double cy, double sy, double cp, double sp) {
        double tHat = box(o, d, HAT, hit);
        if (tHat > 0) {
            int c = texel(hit, HAT, 32);
            if ((c >>> 24) > 16) return shade(c, (int) hit[3], cy, sy, cp, sp);
        }
        double tHead = box(o, d, HEAD, hit);
        if (tHead > 0) { int c = texel(hit, HEAD, 0); return shade(c | 0xFF000000, (int) hit[3], cy, sy, cp, sp); }
        // through a hole in the hat's front: its inner back faces show, like the game's double-sided hat layer
        if (tHat > 0 && exitBox(o, d, HAT, hit) > 0) { int c = texel(hit, HAT, 32); if ((c >>> 24) > 16) return shade(c, (int) hit[3] ^ 1, cy, sy, cp, sp); }
        return 0;
    }

    /** Ray against a cube of half size h: entry distance (or -1) and, in hit, the point and which face (0..5). */
    private static double box(double[] o, double[] d, double h, double[] hit) {
        double tn = -1e9, tf = 1e9; int face = -1;
        for (int a = 0; a < 3; a++) {
            if (Math.abs(d[a]) < 1e-12) { if (o[a] < -h || o[a] > h) return -1; continue; }
            double t1 = (-h - o[a]) / d[a], t2 = (h - o[a]) / d[a];
            int f1 = a * 2, f2 = a * 2 + 1; // even = negative side, odd = positive side
            if (t1 > t2) { double t = t1; t1 = t2; t2 = t; int f = f1; f1 = f2; f2 = f; }
            if (t1 > tn) { tn = t1; face = f1; }
            if (t2 < tf) tf = t2;
            if (tn > tf) return -1;
        }
        if (tn <= 0) return -1;
        hit[0] = o[0] + d[0] * tn; hit[1] = o[1] + d[1] * tn; hit[2] = o[2] + d[2] * tn; hit[3] = face; return tn;
    }
    private static double exitBox(double[] o, double[] d, double h, double[] hit) {
        double tn = -1e9, tf = 1e9; int face = -1;
        for (int a = 0; a < 3; a++) {
            if (Math.abs(d[a]) < 1e-12) continue;
            double t1 = (-h - o[a]) / d[a], t2 = (h - o[a]) / d[a]; int f1 = a * 2, f2 = a * 2 + 1;
            if (t1 > t2) { double t = t1; t1 = t2; t2 = t; int f = f1; f1 = f2; f2 = f; }
            if (t1 > tn) tn = t1;
            if (t2 < tf) { tf = t2; face = f2; }
        }
        if (tn > tf || tf <= 0) return -1;
        hit[0] = o[0] + d[0] * tf; hit[1] = o[1] + d[1] * tf; hit[2] = o[2] + d[2] * tf; hit[3] = face; return tf;
    }

    /** Skin texel for a point on a cube face. Faces: 0 -x (player's right), 1 +x (left), 2 -y bottom, 3 +y top, 4 -z back, 5 +z front. */
    private int texel(double[] p, double h, int u0) {
        double s = 4 / h; // map the cube to 8 skin pixels per side
        double x = p[0] * s + 4, y = 4 - p[1] * s, z = p[2] * s + 4; // x, z: 0..8 across; y: 0 at the top
        double u, v;
        switch ((int) p[3]) {
            case 5 -> { u = 8 + x; v = 8 + y; }
            case 0 -> { u = 0 + z; v = 8 + y; }
            case 1 -> { u = 16 + (8 - z); v = 8 + y; }
            case 4 -> { u = 24 + (8 - x); v = 8 + y; }
            case 3 -> { u = 8 + x; v = z; }
            default -> { u = 16 + x; v = 8 - z; }
        }
        int iu = u0 + clamp((int) Math.floor(u), 0, 31), iv = clamp((int) Math.floor(v), 0, 15);
        return skin[iv * SKIN_W + iu];
    }

    /** Face lighting in view space, so the light stays put while the head turns. */
    private static int shade(int c, int face, double cy, double sy, double cp, double sp) {
        // the face normal in view space (see toView), dotted with the light
        double nx = 0, ny = 0, nz = 0;
        switch (face) { case 0 -> nx = -1; case 1 -> nx = 1; case 2 -> ny = -1; case 3 -> ny = 1; case 4 -> nz = -1; default -> nz = 1; }
        double y1 = ny * cp - nz * sp, z1 = ny * sp + nz * cp, vx = nx * cy + z1 * sy, vz = -nx * sy + z1 * cy;
        double l = 0.58 + 0.42 * Math.max(0, vx * LIGHT[0] + y1 * LIGHT[1] + vz * LIGHT[2]);
        int r = (int) Math.round(((c >> 16) & 255) * l), g = (int) Math.round(((c >> 8) & 255) * l), b = (int) Math.round((c & 255) * l);
        return (c & 0xFF000000) | clamp(r, 0, 255) << 16 | clamp(g, 0, 255) << 8 | clamp(b, 0, 255);
    }

    // view = Ry(yaw) * Rx(pitch) * head (pitch > 0 tips the front down); this is the inverse
    private static double[] toHead(double x, double y, double z, double cy, double sy, double cp, double sp) {
        double x1 = x * cy - z * sy, z1 = x * sy + z * cy;
        return new double[]{x1, y * cp + z1 * sp, -y * sp + z1 * cp};
    }
    private static double[] norm(double x, double y, double z) { double l = Math.sqrt(x * x + y * y + z * z); return new double[]{x / l, y / l, z / l}; }
    private static int clamp(int v, int lo, int hi) { return v < lo ? lo : v > hi ? hi : v; }

    /**
     * Where the head looks: toward the mouse, eased with a critically damped spring so it glides and settles without
     * overshoot at any frame rate. Opens turned slightly away and swings in.
     */
    public static final class Follow {
        public double yaw = -MAX_YAW * 0.8, pitch = 6, vy, vp;
        private static final double W = 14; // spring speed (1/s)
        /** Target from the mouse position relative to the head centre, in screen pixels; reach = pixels for a full turn. */
        public static double[] target(double dx, double dy, double reach) {
            return new double[]{MAX_YAW * Math.tanh(dx / reach), MAX_PITCH * Math.tanh(dy / reach)};
        }
        public void update(double dt, double tYaw, double tPitch, boolean reduced) {
            if (reduced || dt <= 0) { if (reduced) { yaw = tYaw; pitch = tPitch; vy = vp = 0; } return; }
            dt = Math.min(dt, 0.1);
            double[] a = spring(yaw, vy, tYaw, dt), b = spring(pitch, vp, tPitch, dt);
            yaw = a[0]; vy = a[1]; pitch = b[0]; vp = b[1];
        }
        /** Exact critically damped step (no overshoot, stable for any dt). */
        static double[] spring(double x, double v, double target, double dt) {
            double e = x - target, ex = Math.exp(-W * dt), c = v + W * e;
            double ne = (e + c * dt) * ex, nv = (v - W * c * dt) * ex;
            return new double[]{target + ne, nv};
        }
        public boolean moving() { return Math.abs(vy) + Math.abs(vp) > 0.05; }
    }
}
