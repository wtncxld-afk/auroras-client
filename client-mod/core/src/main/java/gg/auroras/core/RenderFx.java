package gg.auroras.core;

/**
 * Game-independent rules for the rendering modules added in October 2026: Block Overlay, Color Grading, Motion Blur,
 * Custom FOV, Custom Enchant Glint, Low Health Warning, Time Changer and No Render. The adapter feeds in what the game
 * reports and draws or applies what these return; everything here is unit-tested in ModuleTests. All of it is local:
 * nothing changes what the server sees, and nothing shows information the player couldn't see anyway.
 */
public final class RenderFx {
    private RenderFx() {}

    static double clamp(double v, double lo, double hi) { return v < lo ? lo : v > hi ? hi : v; }
    static double smoothstep(double e0, double e1, double x) { double t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

    // ---------- Block Overlay ----------
    /**
     * The outline and fill on the block you look at. The box glides from one block to the next (and to a block's real
     * shape, such as a slab), fades in when you start looking at a block and out when you look away, keeping its last place
     * while it fades. Times are real seconds, so it looks the same at any frame rate.
     */
    public static final class BlockOverlay {
        public final double[] box = new double[6]; // minX minY minZ maxX maxY maxZ (world coordinates) as drawn this frame
        private final double[] target = new double[6]; public double alpha; private boolean has;
        /** Advances by dt. hit: whether a block is targeted; b: its outline bounds (6 values) when it is. glide/fade in seconds (0 = instant). */
        public void update(boolean hit, double[] b, double dt, double glide, double fade) {
            if (hit) {
                boolean jump = !has || alpha <= 0.001 || far(b);
                System.arraycopy(b, 0, target, 0, 6); if (jump) System.arraycopy(b, 0, box, 0, 6); has = true;
            }
            double k = glide <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / glide);
            for (int i = 0; i < 6; i++) { box[i] += (target[i] - box[i]) * k; if (Math.abs(target[i] - box[i]) < 1e-4) box[i] = target[i]; }
            double step = fade <= 0 ? 1 : Math.max(0, dt) / fade;
            alpha = hit ? Math.min(1, alpha + step) : Math.max(0, alpha - step);
            if (alpha <= 0) has = false;
        }
        /** More than 4 blocks away: snap instead of sweeping across the screen. */
        private boolean far(double[] b) { double dx = b[0] - target[0], dy = b[1] - target[1], dz = b[2] - target[2]; return dx * dx + dy * dy + dz * dz > 16; }
        public boolean visible() { return alpha > 0.001 && has; }
    }
    /** Outline colour: the chosen one, or a slow rainbow (chroma) that cycles every 6 s / speed. */
    public static int overlayColor(int rgb, boolean chroma, double speed, double seconds) { return chroma ? HudKit.hsv(seconds * speed / 6.0, 0.65, 1.0) : rgb & 0xFFFFFF; }
    /** ARGB with opacity (0..100) times the fade. */
    public static int withAlpha(int rgb, int opacityPct, double fade) { return HudKit.argb(rgb, opacityPct, fade); }

    // ---------- Color Grading ----------
    /** Colour grading settings, applied to the world before the HUD is drawn. Neutral values change nothing. */
    public record Grade(double saturation, double contrast, double brightness, double warmth, double tint, double vignette, double vignetteSize) {
        public static final Grade NEUTRAL = new Grade(1, 1, 1, 0, 0, 0, 0.5);
        public boolean neutral() { return Math.abs(saturation - 1) < 1e-3 && Math.abs(contrast - 1) < 1e-3 && Math.abs(brightness - 1) < 1e-3 && Math.abs(warmth) < 1e-3 && Math.abs(tint) < 1e-3 && vignette < 1e-3; }
    }
    /** Encoding ranges of the parameter texture the grading shader reads (byte 0..255 maps to lo..hi). */
    static final double[][] GRADE_RANGE = {{0, 2}, {0.5, 1.5}, {0.5, 1.5}, {-1, 1}, {-1, 1}, {0, 1}, {0, 1}, {0, 1}};
    /**
     * The 2 x 1 RGBA parameter texture the post shader samples (texel 0: saturation, contrast, brightness, warmth;
     * texel 1: tint, vignette, vignette size, motion blur weight), packed as ARGB ints for the adapter's texture upload.
     * blur is the Motion Blur mix for this frame (0 = none). The shader decodes with the same ranges (GRADE_RANGE).
     */
    public static int[] gradeTexture(Grade g, double blur, int[] out) {
        // ARGB: R, G, B, A carry the four values of each texel (no arrays: this runs every frame while Motion Blur is on)
        out[0] = e(g.warmth(), 3) << 24 | e(g.saturation(), 0) << 16 | e(g.contrast(), 1) << 8 | e(g.brightness(), 2);
        out[1] = e(blur, 7) << 24 | e(g.tint(), 4) << 16 | e(g.vignette(), 5) << 8 | e(g.vignetteSize(), 6); return out;
    }
    private static int e(double v, int i) { return encode(v, GRADE_RANGE[i][0], GRADE_RANGE[i][1]);
    }
    static int encode(double v, double lo, double hi) { return (int) Math.round(clamp((v - lo) / (hi - lo), 0, 1) * 255); }
    static double decode(int b, double lo, double hi) { return lo + (hi - lo) * (b & 255) / 255.0; }
    /** Decodes a parameter texture back into values (what the shader sees, including the 8-bit rounding). */
    public static double[] decodeTexture(int[] px) {
        int[] b = {px[0] >> 16 & 255, px[0] >> 8 & 255, px[0] & 255, px[0] >>> 24, px[1] >> 16 & 255, px[1] >> 8 & 255, px[1] & 255, px[1] >>> 24};
        double[] v = new double[8]; for (int i = 0; i < 8; i++) v[i] = decode(b[i], GRADE_RANGE[i][0], GRADE_RANGE[i][1]); return v;
    }
    /**
     * Reference grading of one pixel, the same maths as the post shader (assets/auroras_client/shaders/post/auroras_grade.fsh):
     * brightness, warmth (orange/blue) and tint (magenta/green), saturation around Rec. 709 luma, contrast around mid grey,
     * then the vignette. u, v are screen coordinates 0..1. Used by the tests and the preview.
     */
    public static int grade(int rgb, double u, double v, Grade g) {
        double r = (rgb >> 16 & 255) / 255.0, gr = (rgb >> 8 & 255) / 255.0, b = (rgb & 255) / 255.0;
        r *= g.brightness(); gr *= g.brightness(); b *= g.brightness();
        r += g.warmth() * 0.08; b -= g.warmth() * 0.08; r += g.tint() * 0.04; b += g.tint() * 0.04; gr -= g.tint() * 0.06;
        double l = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
        r = l + (r - l) * g.saturation(); gr = l + (gr - l) * g.saturation(); b = l + (b - l) * g.saturation();
        r = (r - 0.5) * g.contrast() + 0.5; gr = (gr - 0.5) * g.contrast() + 0.5; b = (b - 0.5) * g.contrast() + 0.5;
        double vig = 1 - g.vignette() * vignetteMask(u, v, g.vignetteSize());
        r *= vig; gr *= vig; b *= vig;
        return (int) Math.round(clamp(r, 0, 1) * 255) << 16 | (int) Math.round(clamp(gr, 0, 1) * 255) << 8 | (int) Math.round(clamp(b, 0, 1) * 255);
    }
    /** 0 in the middle of the screen, rising to 1 in the corners. size 0..1: how far in the darkening reaches. */
    public static double vignetteMask(double u, double v, double size) {
        double dx = (u - 0.5) * 2, dy = (v - 0.5) * 2, d = Math.sqrt(dx * dx + dy * dy) / Math.sqrt(2);
        double inner = 1 - clamp(size, 0, 1) * 0.9; return smoothstep(inner - 0.1, 1.05, d);
    }

    // ---------- Motion Blur ----------
    /**
     * How much of the previous frame is mixed into this one. Blur follows how fast the camera turns, so standing still
     * or walking straight stays sharp. degPerSec: camera turn speed. strength 0..1. Returns 0..0.9 (never a frozen image).
     * The turn speed is smoothed (tau 50 ms) by the caller passing the previous result as `prev`.
     */
    public static double blurWeight(double degPerSec, double strength, boolean onlyTurning, double prev, double dt) {
        double want = clamp(strength, 0, 1) * (onlyTurning ? smoothstep(20, 360, degPerSec) : 1) * 0.9;
        double k = 1 - Math.exp(-Math.max(0, dt) / 0.05); double w = prev + (want - prev) * k; return w < 0.002 ? 0 : clamp(w, 0, 0.9);
    }
    /** Turn angle between two camera directions in degrees, yaw wrapped (359 to 1 is 2 degrees). */
    public static double turnDegrees(float yaw0, float pitch0, float yaw1, float pitch1) {
        double dy = ((yaw1 - yaw0) % 360 + 540) % 360 - 180, dp = pitch1 - pitch0; return Math.sqrt(dy * dy + dp * dp);
    }

    // ---------- Custom FOV ----------
    /** The field of view Minecraft should use as its base: the custom value (10..170, vanilla stops at 110). */
    public static int customFov(int fov) { return (int) clamp(fov, 10, 170); }
    /** The FOV Effects scale (sprinting, speed, bows): vanilla's own setting, or dynamicScale while the module is on; 0 when dynamic FOV is off. */
    public static double fovEffects(boolean dynamic, double dynamicScale) { return dynamic ? clamp(dynamicScale, 0, 1) : 0; }

    // ---------- Custom Enchant Glint ----------
    /**
     * A size x size, seamlessly tiling glint texture: soft diagonal light streaks with a little shimmer, white light in
     * the chosen colour. Original pattern (not Minecraft's). Minecraft scrolls it across enchanted items itself.
     * intensity 0..2 scales the light. Returns ARGB pixels (alpha 255; the glint is added onto the item).
     */
    public static int[] glintTexture(int size, int rgb, double intensity, int[] out) {
        double cr = (rgb >> 16 & 255) / 255.0, cg = (rgb >> 8 & 255) / 255.0, cb = (rgb & 255) / 255.0, k = clamp(intensity, 0, 2);
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
            double u = x / (double) size, v = y / (double) size, t = 2 * Math.PI;
            double s = 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * (u + v)), 3) + 0.30 * Math.pow(0.5 + 0.5 * Math.sin(t * (2 * u + 2 * v) + 1.7), 6)
                + 0.15 * (0.5 + 0.5 * Math.sin(t * (3 * u - v) + 0.4)) * (0.5 + 0.5 * Math.sin(t * (u + 3 * v) + 2.1));
            double l = clamp(s * 1.35 * k, 0, 1);
            out[y * size + x] = 0xFF000000 | (int) Math.round(l * cr * 255) << 16 | (int) Math.round(l * cg * 255) << 8 | (int) Math.round(l * cb * 255);
        }
        return out;
    }
    /** Glint colour this moment: the chosen one, or a rainbow cycling every 8 s / speed. */
    public static int glintColor(int rgb, boolean chroma, double speed, double seconds) { return chroma ? HudKit.hsv(seconds * speed / 8.0, 0.7, 1.0) : rgb & 0xFFFFFF; }
    /** Chroma glints are re-uploaded at most this often (seconds); fixed colours only when settings change. */
    public static final double GLINT_REFRESH = 0.1;

    // ---------- Low Health Warning ----------
    /**
     * The screen-edge warning's strength (0..1) this moment. It starts at the threshold and grows as health falls;
     * absorption hearts count as health when countAbsorption is on. It pulses like a heartbeat, faster when lower.
     * The adapter eases the result (HudKit.Smooth) so it fades in and out.
     */
    public static double lowHealth(double health, double absorption, double threshold, boolean countAbsorption, boolean pulse, double pulseSpeed, double seconds) {
        double hp = health + (countAbsorption ? Math.max(0, absorption) : 0);
        if (health <= 0 || threshold <= 0 || hp >= threshold) return 0;
        double sev = clamp((threshold - hp) / threshold, 0, 1), base = 0.45 + 0.55 * sev;
        if (!pulse) return base;
        double rate = clamp(pulseSpeed, 0.1, 4) * (1 + sev), ph = (seconds * rate) % 1.0;
        double beat = Math.exp(-ph * 9) + 0.6 * Math.exp(-Math.abs(ph - 0.22) * 14); // a "lub-dub" double beat
        return clamp(base * (0.6 + 0.4 * clamp(beat, 0, 1)), 0, 1);
    }
    /**
     * A size x size white vignette mask (alpha only): transparent in the middle, opaque at the edges. depth 0.05..0.6 is how
     * far in from the edges the glow reaches; softness shapes the falloff. Tinted and stretched over the screen when drawn.
     */
    public static int[] edgeMask(int size, double depth, int[] out) {
        double d = clamp(depth, 0.05, 0.6);
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
            double u = (x + 0.5) / size, v = (y + 0.5) / size, e = Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v));
            double dx = (u - 0.5) * 2, dy = (v - 0.5) * 2, round = clamp(Math.sqrt(dx * dx + dy * dy) - 0.7, 0, 1) * 0.6; // corners a little stronger
            double a = Math.pow(1 - smoothstep(0, d, e), 1.6) + round * (1 - smoothstep(0, d * 2, e));
            out[y * size + x] = (int) Math.round(clamp(a, 0, 1) * 255) << 24 | 0xFFFFFF;
        }
        return out;
    }

    // ---------- Time Changer ----------
    /**
     * Local time of day in ticks (0 = sunrise, 6000 noon, 18000 midnight) for the sky, sun and lighting you see. The server
     * keeps its own time; this only changes your view. mode: "fixed" holds fixedTicks; "speed" runs a local clock from the
     * time it started at speed x the normal day (0 freezes); "real" follows the computer's clock (12:00 noon).
     */
    public static long localTime(String mode, long serverTime, int fixedTicks, double speed, long startTime, double secondsSinceStart, int hour, int minute) {
        switch (mode) {
            case "fixed": return Math.floorMod(fixedTicks, 24000);
            case "real": return realTicks(hour, minute);
            case "speed": return Math.floorMod(startTime + (long) Math.floor(secondsSinceStart * 20 * clamp(speed, 0, 100)), 24000L);
            default: return serverTime;
        }
    }
    /** Wall-clock time as Minecraft day time: 06:00 is sunrise (0), 12:00 noon (6000), 00:00 midnight (18000). */
    public static long realTicks(int hour, int minute) { return Math.floorMod((hour - 6) * 1000 + Math.round(minute * 1000 / 60f), 24000); }
    /** A day time keeping the day count of the server's time, so moon phases stay the server's. */
    public static long withDay(long serverDayTime, long ticksOfDay) { return Math.floorDiv(serverDayTime, 24000L) * 24000L + Math.floorMod(ticksOfDay, 24000L); }
    /** "06:00"-style label for a day time in ticks, for the settings page. */
    public static String clockLabel(long ticks) { long t = Math.floorMod(ticks + 6000, 24000L); return String.format(java.util.Locale.ROOT, "%02d:%02d", t / 1000, t % 1000 * 60 / 1000); }

    // ---------- No Render ----------
    /** Which of the things No Render can hide are hidden. Parsed once per settings change. Every one is purely visual. */
    public static final class NoRender {
        public boolean on, fire, pumpkin, freeze, vignette, totem, hurtShake, weather, explosions, water, portal;
        public boolean fire() { return on && fire; }
        public boolean pumpkin() { return on && pumpkin; }
        public boolean freeze() { return on && freeze; }
        public boolean vignette() { return on && vignette; }
        public boolean totem() { return on && totem; }
        public boolean hurtShake() { return on && hurtShake; }
        public boolean weather() { return on && weather; }
        public boolean explosions() { return on && explosions; }
        public boolean water() { return on && water; }
        public boolean portal() { return on && portal; }
        /** Particle types No Render drops (explosions), shared with Particle Settings' filter. */
        public boolean hidesParticle(String typeId) { return explosions() && ("minecraft:explosion".equals(typeId) || "minecraft:explosion_emitter".equals(typeId) || "minecraft:gust".equals(typeId) || "minecraft:gust_emitter_large".equals(typeId) || "minecraft:gust_emitter_small".equals(typeId)); }
    }
}
