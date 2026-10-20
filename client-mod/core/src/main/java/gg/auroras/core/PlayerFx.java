package gg.auroras.core;

import java.util.*;

/**
 * Rules behind the first-person and streaming modules: Swing Animation, Weapon Inspect (and its blade skins), Hand Aura,
 * Totem Spirit, Name Protect, Stream Hide Inventory and Skin Changer. Pure functions of their settings and the time, so
 * they are unit-tested here (ModuleTests) and the adapter only applies the numbers. Everything is local drawing: none of
 * it changes what the server sees, how fast you attack, or what you can see through walls.
 */
public final class PlayerFx {
    private PlayerFx() {}

    static double clamp(double v, double lo, double hi) { return v < lo ? lo : v > hi ? hi : v; }
    /** Smooth 0..1 ease with zero slope at both ends (smootherstep). */
    public static double smooth(double t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }

    // ---------------------------------------------------------------- Swing Animation
    public static final List<String> SWING_STYLES = List.of("vanilla", "legacy", "smooth", "slow");
    /**
     * The swing progress the hand is drawn at for a vanilla progress p (0 = rest, 1 = done). vanilla and legacy keep the
     * game's curve; smooth eases in and out so the arc has no sudden start; slow keeps the curve (it is stretched in time by
     * swingTicks instead).
     */
    public static double swing(String style, double p) {
        p = clamp(p, 0, 1);
        return "smooth".equals(style) ? smooth(p) : p;
    }
    /**
     * How many ticks one swing animation lasts on your screen: the game's own length divided by the speed (slow halves
     * it again). Drawing only: attack timing and cooldown are untouched. Always at least 1 tick, at most 40.
     */
    public static int swingTicks(String style, int vanillaTicks, double speed) {
        double s = clamp(speed, 0.25, 2.0) * ("slow".equals(style) ? 0.5 : 1);
        return (int) clamp(Math.round(Math.max(1, vanillaTicks) / s), 1, 40);
    }
    /** The 1.7 look: the held item doesn't dip after each hit (the attack cooldown dip is hidden; switching items still animates). */
    public static boolean hideCooldownDip(String style, boolean setting) { return setting || "legacy".equals(style); }
    /**
     * The extra transform for the held item: {x, y, z, scale, rotX, rotY, rotZ} (blocks and degrees). The off hand mirrors
     * x and the y/z rotations so both hands move outward alike.
     */
    public static void itemOffset(double x, double y, double z, double scale, double rx, double ry, double rz, boolean offHand, double[] out) {
        double m = offHand ? -1 : 1;
        out[0] = clamp(x, -1, 1) * m; out[1] = clamp(y, -1, 1); out[2] = clamp(z, -1, 1); out[3] = clamp(scale, 0.3, 2);
        out[4] = clamp(rx, -180, 180); out[5] = clamp(ry, -180, 180) * m; out[6] = clamp(rz, -180, 180) * m;
    }
    public static boolean identity(double[] o) { return o[0] == 0 && o[1] == 0 && o[2] == 0 && o[3] == 1 && o[4] == 0 && o[5] == 0 && o[6] == 0; }

    // ---------------------------------------------------------------- Weapon Inspect
    public static final List<String> INSPECT_STYLES = List.of("showcase", "twirl", "flip");
    /**
     * One inspect animation: press the key, the held item lifts toward the middle of the view, turns to show its faces and
     * settles back. Time-based, so it is equally smooth at any frame rate; swinging, switching items or using an item ends
     * it early (with a quick blend back, never a jump).
     */
    public static final class Inspect {
        double t = -1, dur = 2, fade = 0; boolean fading; String style = "showcase";
        public boolean active() { return t >= 0; }
        public void start(String style, double seconds) { this.style = INSPECT_STYLES.contains(style) ? style : "showcase"; dur = clamp(seconds, 0.5, 6); t = 0; fading = false; fade = 1; }
        /** Ends early: the pose blends back to rest over 0.15 s. */
        public void cancel() { if (t >= 0 && !fading) { fading = true; } }
        public void stop() { t = -1; fading = false; fade = 0; }
        /** Advances by dt seconds of real time. */
        public void frame(double dt) {
            if (t < 0) return; dt = clamp(dt, 0, 0.25);
            if (fading) { fade -= dt / 0.15; if (fade <= 0) stop(); return; }
            t += dt; if (t >= dur) stop();
        }
        public double progress() { return t < 0 ? 0 : clamp(t / dur, 0, 1); }
        /** The pose now: {x, y, z, rotX, rotY, rotZ} (blocks, degrees) added to the held item. All zero when idle. */
        public void pose(double[] out) {
            if (t < 0) { Arrays.fill(out, 0, 6, 0); return; }
            PlayerFx.inspectPose(style, progress(), out); double k = fading ? smooth(fade) : 1;
            for (int i = 0; i < 6; i++) out[i] *= k;
        }
    }
    /**
     * Pose at progress p (0..1) for an inspect style. Each has a lift-in (first 20%), a showing part and a settle (last 20%),
     * so it always starts and ends at rest with zero speed. Original keyframes:
     *  showcase: lift toward the centre, tilt the blade up, turn it slowly to show the flat and the edge, then settle;
     *  twirl: a full spin around the handle with a small bob;
     *  flip: tip the item over toward you and back, like checking the far side.
     */
    public static void inspectPose(String style, double p, double[] out) {
        p = clamp(p, 0, 1);
        double in = smooth(p / 0.2), outE = smooth((1 - p) / 0.2), env = Math.min(in, outE), mid = clamp((p - 0.2) / 0.6, 0, 1), ms = smooth(mid);
        switch (style) {
            case "twirl" -> {
                out[0] = -0.18 * env; out[1] = 0.10 * env + 0.03 * Math.sin(mid * Math.PI * 2) * env; out[2] = 0.05 * env;
                out[3] = -20 * env; out[4] = 360 * ms; out[5] = 10 * env;
                if (p >= 0.8) out[4] = 360; // the spin completes (360 is the rest pose), so the settle never turns back
                if (p >= 1) out[4] = 0;
            }
            case "flip" -> {
                out[0] = -0.12 * env; out[1] = 0.08 * env; out[2] = 0.08 * env;
                out[3] = -150 * Math.sin(ms * Math.PI) * env - 15 * env; out[4] = 20 * env; out[5] = 0;
            }
            default -> {
                out[0] = -0.26 * env; out[1] = 0.14 * env; out[2] = 0.10 * env;
                out[3] = -35 * env; out[4] = (55 * Math.sin(ms * Math.PI * 2) + 25) * env; out[5] = (25 - 50 * ms) * env;
            }
        }
    }

    // ---------------------------------------------------------------- Blade skins (Weapon Inspect)
    /** Our own blade looks: colour washes over the held sword, drawn on your screen only. */
    public static final List<String> BLADE_SKINS = List.of("none", "frost", "ember", "verdant", "amethyst", "sakura", "aurora", "eclipse", "custom");
    /**
     * The tint (opaque ARGB, multiplied with the item's own colours) of a blade skin at time t seconds. strength 0 = the
     * item's normal colours, 1 = the full wash. aurora drifts cyan, teal and violet; eclipse pulses between deep violet and
     * a warm rim. Returns -1 (white = unchanged) for none.
     */
    public static int bladeTint(String skin, int customRgb, double strength, double t) {
        int rgb;
        switch (skin) {
            case "frost" -> rgb = 0x9FE8FF;
            case "ember" -> rgb = 0xFF9A55;
            case "verdant" -> rgb = 0x8DF0A8;
            case "amethyst" -> rgb = 0xC39BFF;
            case "sakura" -> rgb = 0xFFB7D5;
            case "aurora" -> { double u = (Math.sin(t * 0.9) + 1) / 2, v = (Math.sin(t * 0.55 + 1.7) + 1) / 2; rgb = mixRgb(mixRgb(0x6FE3FF, 0x5FD6B4, u), 0xB58CFF, v * 0.7); }
            case "eclipse" -> rgb = mixRgb(0x7A5CFF, 0xFFB46B, (Math.sin(t * 1.6) + 1) / 2 * 0.45);
            case "custom" -> rgb = customRgb & 0xFFFFFF;
            default -> { return -1; }
        }
        return 0xFF000000 | mixRgb(0xFFFFFF, rgb, clamp(strength, 0, 1));
    }
    public static int mixRgb(int a, int b, double k) {
        k = clamp(k, 0, 1);
        int r = (int) Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * k), g = (int) Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k), bl = (int) Math.round((a & 255) + ((b & 255) - (a & 255)) * k);
        return r << 16 | g << 8 | bl;
    }
    /** HSV hue (0..1) to RGB at full saturation and value, for chroma colours. */
    public static int hue(double h) {
        h = h - Math.floor(h); double x = h * 6; int i = (int) x; double f = x - i; int q = (int) Math.round(255 * (1 - f)), u = (int) Math.round(255 * f);
        return switch (i % 6) { case 0 -> 0xFF0000 | u << 8; case 1 -> q << 16 | 0xFF00; case 2 -> 0xFF00 | u; case 3 -> q << 8 | 0xFF; case 4 -> u << 16 | 0xFF; default -> 0xFF0000 | q; };
    }

    // ---------------------------------------------------------------- Hand Aura
    /**
     * Hand Aura's glow: translucent, full-bright shells drawn just outside the first-person hand and held item, each a
     * little larger and fainter than the last, so the edge fades out softly. Returns the ARGB colour of shell i (0 = the
     * innermost) of n at time t; alpha 0 means don't draw it.
     */
    public static int auraColor(int rgb, boolean chroma, double chromaSpeed, double intensity, boolean pulse, int i, int n, double t) {
        int c = chroma ? hue(t * 0.15 * clamp(chromaSpeed, 0.1, 5) + i * 0.04) : rgb & 0xFFFFFF;
        double a = clamp(intensity, 0, 1) * 0.55 * (1 - i / (double) Math.max(1, n) * 0.6);
        if (pulse) a *= 0.8 + 0.2 * Math.sin(t * 2.4);
        int al = (int) Math.round(clamp(a, 0, 1) * 255);
        return al <= 0 ? 0 : al << 24 | c;
    }
    /** Scale of shell i of n for a glow size (fraction of the item's size): evenly spread out to 1 + size. */
    public static double auraScale(double size, int i, int n) { return 1 + clamp(size, 0.01, 0.4) * (i + 1) / Math.max(1, n); }

    // ---------------------------------------------------------------- Totem Spirit
    public static final List<String> SPIRIT_SHAPES = List.of("spiral", "pillar", "rings", "wisps");
    /**
     * A rising spirit after a totem pops: per tick, how many glowing motes to spawn (density, fading out over the duration)
     * and where. Positions are relative to the player's feet; the column rises to height blocks. The motes are ordinary
     * world particles, so walls and blocks hide them like anything else.
     */
    public static final class Spirit {
        public final int entityId; public double age; public final double duration;
        public Spirit(int entityId, double duration) { this.entityId = entityId; this.duration = clamp(duration, 0.3, 6); }
        public boolean done() { return age >= duration; }
        /** Motes to spawn this tick (dt seconds) at a density; strongest at the start, easing to none. */
        public int count(double density, double dt) { double life = 1 - age / duration; return life <= 0 ? 0 : (int) Math.round(clamp(density, 0.1, 4) * 6 * life * (dt / 0.05)); }
    }
    /** Where mote k of n spawned this tick goes, at spirit age (seconds): {dx, dy, dz, rise speed (blocks per tick)}. */
    public static void spiritMote(String shape, double age, double duration, int k, int n, double height, double speed, long seed, double[] out) {
        double f = clamp(age / Math.max(0.1, duration), 0, 1), r01 = rnd(seed, k), r2 = rnd(seed ^ 0x9E3779B97F4A7C15L, k), h = clamp(height, 0.5, 8), sp = clamp(speed, 0.1, 4);
        switch (shape) {
            case "pillar" -> { double a = r01 * Math.PI * 2, rad = 0.35 * Math.sqrt(r2); out[0] = Math.cos(a) * rad; out[2] = Math.sin(a) * rad; out[1] = r2 * h * 0.3; out[3] = 0.06 * sp; }
            case "rings" -> { double a = (k / (double) Math.max(1, n)) * Math.PI * 2, rad = 0.55 + 0.15 * Math.sin(f * 6); out[0] = Math.cos(a) * rad; out[2] = Math.sin(a) * rad; out[1] = (f * 3 % 1) * h; out[3] = 0.02 * sp; }
            case "wisps" -> { double a = r01 * Math.PI * 2 + age * 2, rad = 0.6 + 0.3 * r2; out[0] = Math.cos(a) * rad; out[2] = Math.sin(a) * rad; out[1] = 0.2 + r2 * 1.4; out[3] = 0.09 * sp * (0.6 + r2); }
            default -> { // spiral: two arms winding upward
                double arm = (k & 1) == 0 ? 0 : Math.PI, y = (f * h * 1.4 + r2 * 0.4) % h, a = y * 2.2 + arm + age * 3, rad = 0.65 * (1 - y / h * 0.55);
                out[0] = Math.cos(a) * rad; out[2] = Math.sin(a) * rad; out[1] = y; out[3] = 0.04 * sp; }
        }
    }
    /** Colour of a mote: the two colours blended by its height, or a chroma hue; slight per-mote variation. */
    public static int spiritColor(int a, int b, boolean chroma, double y, double height, double t, int k) {
        double f = clamp(y / Math.max(0.5, height), 0, 1);
        return chroma ? hue(t * 0.3 + f * 0.5 + k * 0.01) : mixRgb(a, b, f);
    }
    static double rnd(long seed, int k) { long x = seed + k * 0x9E3779B97F4A7C15L; x = (x ^ (x >>> 30)) * 0xBF58476D1CE4E5B9L; x = (x ^ (x >>> 27)) * 0x94D049BB133111EBL; x ^= x >>> 31; return (x >>> 11) * 0x1.0p-53; }

    // ---------------------------------------------------------------- Name Protect
    /** Aliases: letters, numbers, spaces and . _ - only, up to 16 characters (what fits where a Minecraft name goes). */
    public static String cleanAlias(String s, String fallback) {
        if (s == null) return fallback; String t = s.trim(); return t.isEmpty() || t.length() > 16 || !t.matches("[A-Za-z0-9 ._-]+") ? fallback : t;
    }
    /**
     * Replaces whole-name matches of each name with its alias (case-insensitive, like Minecraft names). A match must not be
     * part of a longer name (letters, digits or _ on either side don't match). Returns the same String when nothing
     * matched, so the common case allocates nothing.
     */
    public static String protect(String s, String[] names, String[] aliases, int count) {
        if (s == null || count == 0 || s.isEmpty()) return s;
        StringBuilder sb = null; int i = 0, n = s.length(), copied = 0;
        while (i < n) {
            int hit = matchAt(s, i, names, count);
            if (hit >= 0) { if (sb == null) sb = new StringBuilder(n + 16); sb.append(s, copied, i).append(aliases[hit]); i += names[hit].length(); copied = i; }
            else i++;
        }
        if (sb == null) return s; sb.append(s, copied, n); return sb.toString();
    }
    static boolean nameChar(char c) { return c == '_' || Character.isLetterOrDigit(c); }
    static int matchAt(CharSequence s, int i, String[] names, int count) {
        if (i > 0 && nameChar(s.charAt(i - 1))) return -1;
        for (int k = 0; k < count; k++) { String nm = names[k]; int L = nm.length(); if (L == 0 || i + L > s.length()) continue;
            boolean ok = true; for (int j = 0; j < L && ok; j++) ok = Character.toLowerCase(s.charAt(i + j)) == Character.toLowerCase(nm.charAt(j));
            if (ok && (i + L == s.length() || !nameChar(s.charAt(i + L)))) return k; }
        return -1;
    }
    /**
     * The same replacement over a styled character stream (Minecraft's FormattedCharSequence): cps/styles hold n code points
     * with their style objects; the result is written to outCps/outStyles (the alias takes the style of the name's first
     * letter) and its length returned, or -1 when nothing matched (draw the original).
     */
    public static int protect(int[] cps, Object[] styles, int n, String[] names, String[] aliases, int count, int[] outCps, Object[] outStyles) {
        if (count == 0 || n == 0) return -1; CpSeq seq = new CpSeq(cps, n); int o = 0, i = 0; boolean any = false;
        while (i < n) {
            int hit = matchAt(seq, i, names, count);
            if (hit >= 0) { any = true; String al = aliases[hit]; Object st = styles[i];
                for (int j = 0; j < al.length() && o < outCps.length; j++) { outCps[o] = al.charAt(j); outStyles[o++] = st; } i += names[hit].length(); }
            else { if (o < outCps.length) { outCps[o] = cps[i]; outStyles[o++] = styles[i]; } i++; }
        }
        return any ? o : -1;
    }
    /** Code points viewed as chars (names are plain ASCII, so a code point above 0xFFFF simply never matches). */
    record CpSeq(int[] cps, int n) implements CharSequence {
        public int length() { return n; }
        public char charAt(int i) { int c = cps[i]; return c > 0xFFFF ? '￿' : (char) c; }
        public CharSequence subSequence(int a, int b) { throw new UnsupportedOperationException(); }
        public String toString() { StringBuilder sb = new StringBuilder(); for (int i = 0; i < n; i++) sb.appendCodePoint(cps[i]); return sb.toString(); }
    }
    /**
     * The name table for Name Protect: your own name first, then (if hiding others) everyone else's, longest first so a
     * name that contains another is replaced whole. Others become "Player 1", "Player 2"... in a stable order (sorted by
     * name) so the same person keeps the same number while they stay online.
     */
    public static int nameTable(String self, String alias, Collection<String> others, boolean hideOthers, String othersAlias, String[] names, String[] aliases) {
        List<String[]> rows = new ArrayList<>(); if (self != null && !self.isEmpty()) rows.add(new String[]{self, alias});
        if (hideOthers && others != null) { List<String> o = new ArrayList<>(new TreeSet<>(others)); int k = 1;
            for (String nm : o) if (nm != null && !nm.isEmpty() && !nm.equalsIgnoreCase(self)) rows.add(new String[]{nm, othersAlias + " " + k++}); }
        rows.sort((a, b) -> b[0].length() - a[0].length()); int n = Math.min(rows.size(), names.length);
        for (int i = 0; i < n; i++) { names[i] = rows.get(i)[0]; aliases[i] = rows.get(i)[1]; }
        return n;
    }

    // ---------------------------------------------------------------- Stream Hide Inventory
    /** What Stream Hide hides right now: bit 1 hotbar, 2 inventory screens, 4 the held item in first person, 8 item tooltips. */
    public static int hideMask(boolean on, boolean active, boolean hotbar, boolean inventory, boolean held, boolean tooltips) {
        if (!on || !active) return 0; return (hotbar ? 1 : 0) | (inventory ? 2 : 0) | (held ? 4 : 0) | (tooltips ? 8 : 0);
    }

    // ---------------------------------------------------------------- Skin Changer
    public static final List<String> SKIN_MODELS = List.of("auto", "wide", "slim");
    /** Accepted local skin images: 64x64, or the old 64x32 layout (converted to 64x64 by legacySkin). */
    public static boolean skinSize(int w, int h) { return w == 64 && (h == 64 || h == 32); }
    /** Whether to draw slim (3-pixel) arms: the setting, or for auto the account's own model. */
    public static boolean slim(String model, boolean accountSlim) { return "slim".equals(model) || (!"wide".equals(model) && accountSlim); }
    /**
     * Converts an old 64x32 skin (ARGB, row-major) to 64x64 the way Minecraft does: the top half is copied and the right
     * leg and arm are mirrored into the left leg and arm slots.
     */
    public static int[] legacySkin(int[] px) {
        int[] o = new int[64 * 64]; System.arraycopy(px, 0, o, 0, 64 * 32);
        // (srcX, srcY, w, h, dstX, dstY): each face of leg (0,16) -> (16,48) and arm (40,16) -> (32,48), mirrored left-right
        int[][] faces = {{4, 16, 4, 4, 20, 48}, {8, 16, 4, 4, 24, 48}, {0, 20, 4, 12, 24, 52}, {4, 20, 4, 12, 20, 52}, {8, 20, 4, 12, 16, 52}, {12, 20, 4, 12, 28, 52},
            {44, 16, 4, 4, 36, 48}, {48, 16, 4, 4, 40, 48}, {40, 20, 4, 12, 40, 52}, {44, 20, 4, 12, 36, 52}, {48, 20, 4, 12, 32, 52}, {52, 20, 4, 12, 44, 52}};
        for (int[] f : faces) for (int y = 0; y < f[3]; y++) for (int x = 0; x < f[2]; x++) o[(f[5] + y) * 64 + f[4] + (f[2] - 1 - x)] = px[(f[1] + y) * 64 + f[0] + x];
        return o;
    }
}
