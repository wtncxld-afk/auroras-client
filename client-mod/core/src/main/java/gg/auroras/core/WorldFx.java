package gg.auroras.core;

import java.util.List;

/**
 * The rules behind the in-world cosmetic modules (Damage Indicator, Cosmetic Aura, Nameplate Styling, Model Emblem,
 * Cosmetic Trails, Particle System): projecting world points to the screen, colour palettes, aura shapes, distance-based
 * emitters, the damage-number pool, nameplate layout and the emblem's placement and art. No Minecraft classes; the
 * adapter reads the game's state, calls these and draws the result. Everything here is cheap and allocation-free per
 * frame (fixed arrays, reused outputs). Unit-tested in ModuleTests.
 */
public final class WorldFx {
    private WorldFx() {}

    public static final List<String> COLOR_MODES = List.of("style", "custom", "rainbow");
    public static final List<String> AURA_SHAPES = List.of("ring", "helix", "halo", "orbit", "sparkle", "pillars");
    public static final List<String> EMBLEMS = List.of("aurora", "star", "heart", "crescent", "diamond", "sakura", "hexagon");

    // ------------------------------------------------------------------ projection
    /**
     * A pinhole camera matching Minecraft's: position, the camera's forward / up / left unit vectors (Camera#forwardVector,
     * upVector, leftVector), the world's vertical field of view in degrees, and the GUI size. project() gives GUI
     * coordinates, so world overlays line up with what the game drew.
     */
    public static final class View {
        double cx, cy, cz, fx, fy, fz, ux, uy, uz, rx, ry, rz, tanY = 1, aspect = 1; public double w = 1, h = 1;
        public void set(double camX, double camY, double camZ, double fX, double fY, double fZ, double uX, double uY, double uZ, double lX, double lY, double lZ, double fovDeg, double guiW, double guiH) {
            cx = camX; cy = camY; cz = camZ; fx = fX; fy = fY; fz = fZ; ux = uX; uy = uY; uz = uZ; rx = -lX; ry = -lY; rz = -lZ;
            tanY = Math.tan(Math.toRadians(Sky.clamp(fovDeg, 1, 179)) / 2); w = Math.max(1, guiW); h = Math.max(1, guiH); aspect = w / h;
        }
        /** The same camera from Minecraft yaw and pitch in degrees (yaw 0 looks south, +Z; pitch 90 looks down). */
        public void setAngles(double camX, double camY, double camZ, double yawDeg, double pitchDeg, double fovDeg, double guiW, double guiH) {
            double y = Math.toRadians(yawDeg), p = Math.toRadians(pitchDeg);
            double fX = -Math.sin(y) * Math.cos(p), fY = -Math.sin(p), fZ = Math.cos(y) * Math.cos(p), lX = Math.cos(y), lY = 0, lZ = Math.sin(y);
            // up = forward x left
            set(camX, camY, camZ, fX, fY, fZ, fY * lZ - fZ * lY, fZ * lX - fX * lZ, fX * lY - fY * lX, lX, lY, lZ, fovDeg, guiW, guiH);
        }
        /** Writes {guiX, guiY, depth} and returns true when the point is in front of the camera (it may still be off screen). */
        public boolean project(double x, double y, double z, double[] out) {
            double dx = x - cx, dy = y - cy, dz = z - cz, d = dx * fx + dy * fy + dz * fz;
            if (d < 0.05) return false;
            double sx = (dx * rx + dy * ry + dz * rz) / (d * tanY * aspect), sy = (dx * ux + dy * uy + dz * uz) / (d * tanY);
            out[0] = (1 + sx) * w / 2; out[1] = (1 - sy) * h / 2; out[2] = d; return true;
        }
        /** GUI units one block covers at a depth (for sizing world-anchored art). */
        public double perBlock(double depth) { return h / 2 / (Math.max(0.05, depth) * tanY); }
        public boolean onScreen(double[] p, double margin) { return p[0] >= -margin && p[0] <= w + margin && p[1] >= -margin && p[1] <= h + margin; }
        public double distance(double x, double y, double z) { double dx = x - cx, dy = y - cy, dz = z - cz; return Math.sqrt(dx * dx + dy * dy + dz * dz); }
        /** Whether a surface at (x, y, z) with horizontal normal (nx, nz) faces the camera. */
        public boolean faces(double x, double y, double z, double nx, double nz) { return (cx - x) * nx + (cz - z) * nz > 0; }
    }

    // ------------------------------------------------------------------ colours
    /** Each particle style's colours (the same names as the launcher's Visual Studio). */
    public static int[] palette(String style) {
        switch (style == null ? "" : style) {
            case "cyanViolet": return new int[]{0x4FE3FF, 0x9D7CFF};
            case "sakura": return new int[]{0xFFB7CF, 0xFFD9E6, 0xFF8FB8};
            case "magic": return new int[]{0xC77DFF, 0x7B5CFF, 0xF0B3FF};
            case "geometric": return new int[]{0x6FE3FF, 0xFFFFFF};
            case "cosmic": return new int[]{0x5B6CFF, 0xB78CFF, 0xFFFFFF};
            case "activation": return new int[]{0xFFD166, 0xFF8A5B, 0x7CFFB2};
            default: return new int[]{0x6FE3FF, 0x7CFFB2, 0xB78CFF}; // aurora
        }
    }
    /**
     * The colour of particle i at time t (seconds): "style" walks the style's palette, "custom" is the chosen colour with
     * a little light variation, "rainbow" cycles the hue.
     */
    public static int color(String mode, int[] palette, int custom, double t, int i) {
        if ("rainbow".equals(mode)) return hsv(frac(t * 0.12 + i * 0.061), 0.6, 1);
        if ("custom".equals(mode)) { double v = 0.85 + 0.15 * frac(i * 0.618034); return scale(custom, v); }
        int n = palette.length; double p = frac(t * 0.15 + i * 0.37) * n; int a = (int) p % n;
        return Sky.mix(palette[a], palette[(a + 1) % n], p - Math.floor(p));
    }
    public static int hsv(double h, double s, double v) {
        double r = Math.abs(frac(h) * 6 - 3) - 1, g = 2 - Math.abs(frac(h) * 6 - 2), b = 2 - Math.abs(frac(h) * 6 - 4);
        r = Sky.clamp(r, 0, 1); g = Sky.clamp(g, 0, 1); b = Sky.clamp(b, 0, 1);
        return ch(v * (1 - s + s * r)) << 16 | ch(v * (1 - s + s * g)) << 8 | ch(v * (1 - s + s * b));
    }
    static int scale(int rgb, double v) { return ch(((rgb >> 16) & 255) / 255.0 * v) << 16 | ch(((rgb >> 8) & 255) / 255.0 * v) << 8 | ch((rgb & 255) / 255.0 * v); }
    static int ch(double v) { return (int) Math.round(Sky.clamp(v, 0, 1) * 255); }
    static double frac(double v) { return v - Math.floor(v); }

    /**
     * Which of Minecraft's particles carries particle i of a style: "glow" (end rod sparkle, tinted), "soft" (potion
     * swirl, tinted with alpha), "dust", "transition" (dust that shifts between two colours), "petal" (cherry leaf),
     * "enchant" (tinted glyph), "spark" (electric spark, tinted). The adapter maps these names to particle types.
     */
    public static String kind(String style, int i) {
        switch (style == null ? "" : style) {
            case "cyanViolet": return i % 3 == 0 ? "glow" : "transition";
            case "sakura": return i % 3 == 0 ? "petal" : i % 3 == 1 ? "dust" : "soft";
            case "magic": return i % 3 == 0 ? "enchant" : i % 3 == 1 ? "glow" : "soft";
            case "geometric": return i % 2 == 0 ? "spark" : "dust";
            case "cosmic": return i % 4 == 0 ? "glow" : i % 4 == 1 ? "soft" : "dust";
            case "activation": return i % 2 == 0 ? "spark" : "glow";
            default: return i % 2 == 0 ? "glow" : "soft"; // aurora
        }
    }

    // ------------------------------------------------------------------ aura
    /**
     * Point k of n for an aura shape at time t, as an offset from the player's feet in blocks, plus a small velocity:
     * out = {dx, dy, dz, vx, vy, vz}. radius and height scale the shape (height 1 = a normal player); r01 is a random
     * number in [0, 1) for shapes that scatter.
     */
    public static void auraPoint(String shape, int k, int n, double t, double speed, double radius, double height, double r01, double[] out) {
        n = Math.max(1, n); double a, y, rr = radius, vy = 0;
        switch (shape == null ? "" : shape) {
            case "helix": { int strand = k & 1; double u = frac(t * speed * 0.35 + (double) k / n); y = u * 2.0 * height; a = t * speed * 1.6 + strand * Math.PI + u * Math.PI * 4; rr = radius * (0.9 - 0.25 * u); vy = 0.01; break; }
            case "halo": a = Math.PI * 2 * k / n + t * speed * 1.2; y = 2.12 * height + 0.03 * Math.sin(t * 2 + k); rr = radius * 0.42; break;
            case "orbit": { int orb = k % 3; a = t * speed * 2.4 + orb * Math.PI * 2 / 3; y = (1.0 + 0.35 * Math.sin(t * speed * 1.7 + orb * 2.1)) * height; rr = radius * 0.95; break; }
            case "sparkle": a = r01 * Math.PI * 2; y = frac(r01 * 7.31 + k * 0.137) * 2.0 * height; rr = radius * (0.55 + 0.45 * frac(r01 * 13.7)); vy = 0.025 * speed; break;
            case "pillars": { int c = k & 3; a = Math.PI / 4 + c * Math.PI / 2 + t * speed * 0.25; y = frac(t * speed * 0.5 + (double) k / n) * 2.0 * height; rr = radius; vy = 0.02 * speed; break; }
            default: a = Math.PI * 2 * k / n + t * speed * 1.5; y = 0.06 + 0.04 * Math.sin(t * 3 + k * 0.7); break; // ring
        }
        out[0] = Math.cos(a) * rr; out[1] = y; out[2] = Math.sin(a) * rr; out[3] = 0; out[4] = vy; out[5] = 0;
    }

    // ------------------------------------------------------------------ emitters
    /**
     * Spawns by distance travelled instead of by time, so trails and footsteps are even at any speed and stop when you
     * stand still. step() returns how many points fall on the segment since the last position; point i of them is at
     * at(i, count, ...). A jump of more than 8 blocks (teleport, respawn) restarts without filling the gap.
     */
    public static final class Stride {
        public double ax, ay, az, bx, by, bz; double carry; boolean has; public int steps;
        public int step(double x, double y, double z, double spacing) {
            if (!has) { bx = x; by = y; bz = z; has = true; return 0; }
            ax = bx; ay = by; az = bz; bx = x; by = y; bz = z;
            double dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d > 8) { carry = 0; return 0; }
            carry += d / Math.max(0.01, spacing); int n = (int) Math.min(64, carry); carry -= n; steps += n; return n;
        }
        /** Point i of n spawned in the last step, spread evenly along the segment (axis 0 = x, 1 = y, 2 = z). */
        public double at(int i, int n, int axis) { double f = (i + 1.0) / Math.max(1, n); return axis == 0 ? ax + (bx - ax) * f : axis == 1 ? ay + (by - ay) * f : az + (bz - az) * f; }
        public void reset() { has = false; carry = 0; }
    }
    /** Small int-keyed table of Strides (one per player or projectile), reused; stale ones are dropped by sweep(). */
    public static final class Strides {
        final int[] ids; final long[] seen; final Stride[] s; int n;
        public Strides(int cap) { ids = new int[cap]; seen = new long[cap]; s = new Stride[cap]; for (int i = 0; i < cap; i++) s[i] = new Stride(); }
        public Stride get(int id, long tick) {
            for (int i = 0; i < n; i++) if (ids[i] == id) { seen[i] = tick; return s[i]; }
            if (n == ids.length) { int old = 0; for (int i = 1; i < n; i++) if (seen[i] < seen[old]) old = i; ids[old] = id; seen[old] = tick; s[old].reset(); return s[old]; }
            ids[n] = id; seen[n] = tick; s[n].reset(); return s[n++];
        }
        public void sweep(long tick, int maxAge) { for (int i = n - 1; i >= 0; i--) if (tick - seen[i] > maxAge) { n--; ids[i] = ids[n]; seen[i] = seen[n]; Stride t = s[i]; s[i] = s[n]; s[n] = t; } }
        public int size() { return n; }
    }

    // ------------------------------------------------------------------ line of sight cache
    /** Remembers line-of-sight results for a few ticks, so overlays raycast at most once per entity every few ticks. */
    public static final class Sight {
        final int[] ids; final long[] at; final boolean[] ok; int n;
        public Sight(int cap) { ids = new int[cap]; at = new long[cap]; ok = new boolean[cap]; }
        /** The cached answer for id if it is at most maxAge ticks old, else -1 (unknown). */
        public int get(int id, long tick, int maxAge) { for (int i = 0; i < n; i++) if (ids[i] == id) return tick - at[i] <= maxAge ? (ok[i] ? 1 : 0) : -1; return -1; }
        public void put(int id, long tick, boolean visible) {
            int slot = -1; for (int i = 0; i < n; i++) if (ids[i] == id) { slot = i; break; }
            if (slot < 0) { if (n < ids.length) slot = n++; else { slot = 0; for (int i = 1; i < n; i++) if (at[i] < at[slot]) slot = i; } }
            ids[slot] = id; at[slot] = tick; ok[slot] = visible;
        }
        public void clear() { n = 0; }
    }

    // ------------------------------------------------------------------ damage indicator
    /**
     * Health tracking and the floating numbers. track() keeps an entity under watch (you hit it, or "any entity" is on);
     * observe() returns how much its health changed since the last look; spawn() adds a number that rises and fades.
     * Fixed capacity, no allocation after construction.
     */
    public static final class Damage {
        final int cap; final int[] ids; final float[] hp; final double[] until, hitAt; int n;
        public final int numCap; public final int[] numId; public final double[] numX, numY, numZ, numBorn, numAmount, numJitter; public int nums;
        public Damage(int cap, int numCap) {
            this.cap = cap; ids = new int[cap]; hp = new float[cap]; until = new double[cap]; hitAt = new double[cap];
            this.numCap = numCap; numId = new int[numCap]; numX = new double[numCap]; numY = new double[numCap]; numZ = new double[numCap]; numBorn = new double[numCap]; numAmount = new double[numCap]; numJitter = new double[numCap];
        }
        int find(int id) { for (int i = 0; i < n; i++) if (ids[i] == id) return i; return -1; }
        /** Watches an entity until now + keep seconds. A new entry starts from its current health (no number for the first look). */
        public void track(int id, float health, double now, double keep) {
            int i = find(id);
            if (i < 0) { if (n < cap) i = n++; else { i = 0; for (int k = 1; k < n; k++) if (until[k] < until[i]) i = k; } ids[i] = id; hp[i] = health; hitAt[i] = -1e9; until[i] = 0; }
            until[i] = Math.max(until[i], now + keep);
        }
        public boolean tracked(int id) { return find(id) >= 0; }
        /** Health change since the last call for a watched entity (negative = damage), 0 when unchanged or not watched. */
        public float observe(int id, float health, double now) {
            int i = find(id); if (i < 0) return 0; float d = health - hp[i]; hp[i] = health;
            if (d < -0.001f) hitAt[i] = now; return Math.abs(d) < 0.001f ? 0 : d;
        }
        /** When the entity last lost health (seconds), or a very old time. */
        public double lastHit(int id) { int i = find(id); return i < 0 ? -1e9 : hitAt[i]; }
        public int watched() { return n; }
        public int watchedId(int k) { return ids[k]; }
        /** Drops entries that are past their watch time and haven't been hurt for barSeconds. */
        public void expire(double now, double barSeconds) { for (int i = n - 1; i >= 0; i--) if (now > until[i] && now - hitAt[i] > barSeconds) { n--; ids[i] = ids[n]; hp[i] = hp[n]; until[i] = until[n]; hitAt[i] = hitAt[n]; } }
        public void forget(int id) { int i = find(id); if (i >= 0) { n--; ids[i] = ids[n]; hp[i] = hp[n]; until[i] = until[n]; hitAt[i] = hitAt[n]; } }
        /** A floating number at a world point. When full, the oldest is replaced. */
        public void spawn(int id, double amount, double x, double y, double z, double now, double jitter) {
            int k; if (nums < numCap) k = nums++; else { k = 0; for (int i = 1; i < nums; i++) if (numBorn[i] < numBorn[k]) k = i; }
            numId[k] = id; numAmount[k] = amount; numX[k] = x; numY[k] = y; numZ[k] = z; numBorn[k] = now; numJitter[k] = jitter;
        }
        /** Removes numbers older than duration seconds. */
        public void age(double now, double duration) { for (int k = nums - 1; k >= 0; k--) if (now - numBorn[k] > duration) { int l = --nums; numId[k] = numId[l]; numAmount[k] = numAmount[l]; numX[k] = numX[l]; numY[k] = numY[l]; numZ[k] = numZ[l]; numBorn[k] = numBorn[l]; numJitter[k] = numJitter[l]; } }
        public void clear() { n = 0; nums = 0; }
    }
    /** How a number moves: {rise in blocks, opacity 0..1, pop scale} at age seconds of a duration-second life. */
    public static void numberMotion(double age, double duration, double rise, double[] out) {
        double u = Sky.clamp(age / Math.max(0.05, duration), 0, 1), ease = 1 - (1 - u) * (1 - u) * (1 - u);
        out[0] = ease * 0.9 * rise; out[1] = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
        out[2] = u < 0.12 ? 0.7 + 0.5 * Math.sin(u / 0.12 * Math.PI / 2) * 1.1 : 1.0 + 0.2 * Math.max(0, 1 - (u - 0.12) / 0.15);
        if (out[2] > 1.25) out[2] = 1.25;
    }
    /** "4", "3.5" or (hearts) "1.8"; heals get a plus sign, damage none. */
    public static String formatAmount(double amount, String units, int decimals) {
        double v = Math.abs(amount) / ("hearts".equals(units) ? 2 : 1); int d = Math.max(0, Math.min(2, decimals));
        double p = Math.pow(10, d), r = Math.round(v * p) / p; String s = d == 0 || r == Math.rint(r) ? String.valueOf((long) Math.rint(r)) : String.format(java.util.Locale.ROOT, "%." + d + "f", r);
        if (s.contains(".")) { while (s.endsWith("0")) s = s.substring(0, s.length() - 1); if (s.endsWith(".")) s = s.substring(0, s.length() - 1); }
        return (amount > 0 ? "+" : "") + s;
    }
    /** Health bar colour: red when low, amber around half, green when full. */
    public static int healthColor(double frac) {
        double f = Sky.clamp(frac, 0, 1); return f < 0.5 ? Sky.mix(0xFF5A6E, 0xFFC857, f / 0.5) : Sky.mix(0xFFC857, 0x6FE38A, (f - 0.5) / 0.5);
    }
    /** Ping colour with the Ping Display's thresholds; grey when unknown (0 or less). */
    public static int pingColor(int ms) { return ms <= 0 ? 0x9AA3B5 : ms < 80 ? 0x6FE38A : ms < 160 ? 0xFFC857 : 0xFF5A6E; }

    // ------------------------------------------------------------------ nameplate
    /**
     * Size of world-anchored art: GUI units per plate unit, shrinking with distance like Minecraft's own nametags but
     * kept readable (min) and never huge up close (max), times the user's scale.
     */
    public static double plateScale(double perBlock, double userScale) { return Sky.clamp(perBlock * 0.025, 0.6, 1.15) * Sky.clamp(userScale, 0.25, 4); }
    /** Opacity by distance: full until 80% of the maximum, then fading out; 0 beyond it. */
    public static double distanceFade(double dist, double max) { if (dist >= max) return 0; double s = max * 0.8; return dist <= s ? 1 : 1 - (dist - s) / (max - s); }
    /**
     * Nameplate layout in plate units (scale 1): {w, h, nameX, pingX, itemX, barY, barW, rowH}. Row 1 is [item] name
     * [ping]; the optional health bar sits under it. Widths are measured by the caller in the plate's font.
     */
    public static double[] plateLayout(double nameW, double pingW, boolean item, boolean bar, double rowH, double[] out) {
        double pad = 4.5, gap = 3.5, icon = item ? rowH + 1 : 0, w = pad + (item ? icon + gap : 0) + nameW + (pingW > 0 ? gap + pingW : 0) + pad;
        double barH = bar ? 2.5 : 0, h = rowH + 4 + (bar ? barH + 2.5 : 0);
        out[0] = Math.max(w, 24); double x0 = (out[0] - (w - 2 * pad)) / 2;
        out[1] = h; out[4] = x0; out[2] = x0 + (item ? icon + gap : 0); out[3] = out[2] + nameW + gap; out[5] = rowH + 4; out[6] = out[0] - 2 * pad; out[7] = rowH;
        return out;
    }

    // ------------------------------------------------------------------ emblem
    /**
     * Where the emblem sits on the player model for a body yaw (degrees, Minecraft's), as an offset from the feet in
     * blocks and the surface's outward normal and "right" axis as the viewer sees it: out = {dx, dy, dz, nx, nz, rx, rz}.
     * scale is the player's model scale (1 normally). Crouching lowers and tilts the torso forward.
     */
    public static void emblemAnchor(String position, double bodyYawDeg, boolean crouching, double scale, double[] out) {
        double y = Math.toRadians(bodyYawDeg), fx = -Math.sin(y), fz = Math.cos(y), lx = Math.cos(y), lz = Math.sin(y);
        double nx, nz, ox, oz, oy;
        switch (position == null ? "" : position) {
            case "chest": nx = fx; nz = fz; ox = fx * 0.145; oz = fz * 0.145; oy = crouching ? 0.98 : 1.18; if (crouching) { ox += fx * 0.12; oz += fz * 0.12; } break;
            case "shoulder": nx = lx; nz = lz; ox = lx * 0.385; oz = lz * 0.385; oy = crouching ? 1.08 : 1.3; if (crouching) { ox += fx * 0.08; oz += fz * 0.08; } break;
            default: nx = -fx; nz = -fz; ox = -fx * 0.16; oz = -fz * 0.16; oy = crouching ? 1.0 : 1.12; if (crouching) { ox += fx * 0.16; oz += fz * 0.16; } break; // back
        }
        double s = scale <= 0 ? 1 : scale;
        out[0] = ox * s; out[1] = oy * s; out[2] = oz * s; out[3] = nx; out[4] = nz; out[5] = nz; out[6] = -nx;
    }
    /** Body yaw between the previous and current tick, the short way round (Minecraft's Mth.rotLerp). */
    public static double rotLerp(double partial, double from, double to) { double d = ((to - from) % 360 + 540) % 360 - 180; return from + d * partial; }

    /**
     * An emblem's art in a size x size square, straight ARGB: the design filled with a vertical gradient from top to
     * bottom colour, with a thin light rim. Anti-aliased by 3x3 supersampling. Baked once per design, size and colours.
     */
    public static int[] emblemArt(String design, int size, int top, int bottom, boolean rim) {
        int[] o = new int[size * size];
        for (int py = 0; py < size; py++) for (int px = 0; px < size; px++) {
            int in = 0, edge = 0;
            for (int sy = 0; sy < 3; sy++) for (int sx = 0; sx < 3; sx++) {
                double u = ((px + (sx + 0.5) / 3) / size) * 2 - 1, v = ((py + (sy + 0.5) / 3) / size) * 2 - 1;
                if (inside(design, u, v)) { in++; if (rim && !inside(design, u * 1.12, v * 1.12)) edge++; }
            }
            if (in == 0) continue;
            double a = in / 9.0, t = (double) py / Math.max(1, size - 1); int c = Sky.mix(top, bottom, t);
            if (edge > 0) c = Sky.mix(c, 0xFFFFFF, 0.55 * edge / (double) in);
            o[py * size + px] = (int) Math.round(a * 255) << 24 | c;
        }
        return o;
    }
    static final double[] STAR_X = new double[10], STAR_Y = new double[10];
    static { for (int i = 0; i < 10; i++) { double a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 == 0 ? 0.96 : 0.42; STAR_X[i] = Math.cos(a) * r; STAR_Y[i] = Math.sin(a) * r + 0.06; } }
    /** Shape tests in [-1, 1]^2, y down. */
    static boolean inside(String d, double u, double v) {
        double r = Math.sqrt(u * u + v * v), th = Math.atan2(v, u);
        switch (d == null ? "" : d) {
            case "star": { // ten-vertex star, point up
                boolean in = false; double[] px = STAR_X, py = STAR_Y;
                for (int i = 0, j = 9; i < 10; j = i++) if ((py[i] > v) != (py[j] > v) && u < (px[j] - px[i]) * (v - py[i]) / (py[j] - py[i]) + px[i]) in = !in;
                return in;
            }
            case "heart": { double x = u * 1.15, y = -v * 1.15 + 0.25; double q = x * x + y * y - 1; return q * q * q - x * x * y * y * y <= 0; }
            case "crescent": return r <= 0.92 && Math.hypot(u - 0.36, v + 0.18) > 0.72;
            case "diamond": return Math.abs(u) / 0.68 + Math.abs(v) / 0.95 <= 1;
            case "hexagon": { double au = Math.abs(u), av = Math.abs(v); return av <= 0.82 && au * 0.866 + av * 0.5 <= 0.82; }
            case "sakura": { double petal = 0.5 + 0.44 * Math.pow(Math.abs(Math.cos(2.5 * (th + Math.PI / 2))), 0.7); double notch = Math.abs(Math.sin(2.5 * (th + Math.PI / 2) + Math.PI / 2)); return r <= petal * (1 - 0.12 * Math.pow(1 - notch, 8)); }
            default: { // aurora: a ring with a four-point sparkle inside
                if (r <= 0.95 && r >= 0.8) return true;
                double au = Math.abs(u), av = Math.abs(v); return Math.sqrt(au) + Math.sqrt(av) <= Math.sqrt(0.62);
            }
        }
    }
}
