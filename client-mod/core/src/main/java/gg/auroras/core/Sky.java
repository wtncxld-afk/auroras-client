package gg.auroras.core;

import java.util.*;

/**
 * Sky themes and the color math shared by the in-game renderer and the launcher preview (visuals/visuals.js mirrors this
 * file line for line; both are checked against visuals/sky-golden.json). Colors are packed 0xRRGGBB ints. No allocation
 * in the per-frame functions.
 */
public final class Sky {
    private Sky() {}
    public static final List<String> THEME_IDS = List.of("aurora", "sakura", "cosmic", "midnight", "void", "sunset", "celestial", "vanillaPlus");

    public record Palette(int zenith, int horizon, int sunset) {}
    public record Theme(String id, String name, Palette day, Palette night, int ground, double starDensity, double starSize, double starBrightness, int starTint,
                        boolean aurora, int[] auroraColors, double auroraHeight, double auroraSpeed, double auroraStrength, boolean nebula, int[] nebulaColors,
                        int moonColor, double moonSize, double moonGlow, int sunColor, double sunSize, double sunGlow, boolean mountains, SkyFx.Fx fx) {}
    public record Adjust(double brightness, double saturation, double contrast, int tint, double tintStrength) {
        public static final Adjust NONE = new Adjust(1, 1, 1, 0xFFFFFF, 0);
    }

    public static int hex(String h) {
        if (h == null || !h.matches("#[0-9a-fA-F]{6}")) throw new IllegalArgumentException("Bad color " + h);
        return Integer.parseInt(h.substring(1), 16);
    }
    static int[] colors(List<Object> l) { int[] o = new int[l.size()]; for (int k = 0; k < o.length; k++) o[k] = hex((String) l.get(k)); return o; }
    public static Map<String, Theme> load(String json) {
        Map<String, Object> root = Json.obj(Json.parse(json), "themes file");
        if (Json.num(root, "schema") != 1) throw new IllegalArgumentException("Unsupported themes schema");
        Map<String, Theme> out = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : Json.obj(root.get("themes"), "themes").entrySet()) {
            Map<String, Object> t = Json.obj(e.getValue(), e.getKey()), d = Json.obj(t.get("day"), "day"), n = Json.obj(t.get("night"), "night"), st = Json.obj(t.get("stars"), "stars"),
                au = Json.obj(t.get("aurora"), "aurora"), ne = Json.obj(t.get("nebula"), "nebula"), mo = Json.obj(t.get("moon"), "moon"), su = Json.obj(t.get("sun"), "sun");
            out.put(e.getKey(), new Theme(e.getKey(), Json.str(t, "name"), new Palette(hex(Json.str(d, "zenith")), hex(Json.str(d, "horizon")), hex(Json.str(d, "sunset"))),
                new Palette(hex(Json.str(n, "zenith")), hex(Json.str(n, "horizon")), hex(Json.str(d, "sunset"))), hex(Json.str(t, "ground")),
                Json.num(st, "density"), Json.num(st, "size"), Json.num(st, "brightness"), hex(Json.str(st, "tint")),
                Json.bool(au, "enabled"), colors(Json.arr(au.get("colors"), "aurora colors")), Json.num(au, "height"), Json.num(au, "speed"), Json.num(au, "strength"),
                Json.bool(ne, "enabled"), colors(Json.arr(ne.get("colors"), "nebula colors")),
                hex(Json.str(mo, "color")), Json.num(mo, "size"), Json.num(mo, "glow"), hex(Json.str(su, "color")), Json.num(su, "size"), Json.num(su, "glow"), Json.bool(t, "mountains"), SkyFx.parse(t.get("fx") == null ? null : Json.obj(t.get("fx"), "fx"))));
        }
        return out;
    }

    /** Minecraft's celestial angle for a time of day in ticks (0 = sunrise, 6000 = noon). Returns 0..1. */
    public static double skyAngle(long ticks) {
        double d = frac(Math.floorMod(ticks, 24000L) / 24000.0 - 0.25), e = 0.5 - Math.cos(d * Math.PI) / 2.0;
        return (d * 2.0 + e) / 3.0;
    }
    static double frac(double v) { return v - Math.floor(v); }
    /** 1 at full day, 0 at night. */
    public static double daylight(long ticks) { return clamp(Math.cos(skyAngle(ticks) * Math.PI * 2) * 2 + 0.5, 0, 1); }
    /** 0..1 strength of the sunrise/sunset glow near the horizon. */
    public static double sunsetAmount(long ticks) {
        double g = Math.cos(skyAngle(ticks) * Math.PI * 2); if (g < -0.4 || g > 0.4) return 0;
        double i = g / 0.4 * 0.5 + 0.5, j = 1 - (1 - Math.sin(i * Math.PI)) * 0.99; return j * j;
    }
    public static double clamp(double v, double lo, double hi) { return v < lo ? lo : v > hi ? hi : v; }
    public static int mix(int a, int b, double t) {
        t = clamp(t, 0, 1);
        int r = (int) Math.round(((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t)), g = (int) Math.round(((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t)),
            bl = (int) Math.round((a & 255) + (((b & 255) - (a & 255)) * t));
        return (r << 16) | (g << 8) | bl;
    }
    public static int adjust(int c, Adjust a) {
        double r = ((c >> 16) & 255) / 255.0, g = ((c >> 8) & 255) / 255.0, b = (c & 255) / 255.0, L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = L + (r - L) * a.saturation(); g = L + (g - L) * a.saturation(); b = L + (b - L) * a.saturation();
        r = (r - 0.5) * a.contrast() + 0.5; g = (g - 0.5) * a.contrast() + 0.5; b = (b - 0.5) * a.contrast() + 0.5;
        r *= a.brightness(); g *= a.brightness(); b *= a.brightness();
        double s = a.tintStrength(); r += (((a.tint() >> 16) & 255) / 255.0 - r) * s; g += (((a.tint() >> 8) & 255) / 255.0 - g) * s; b += ((a.tint() & 255) / 255.0 - b) * s;
        return ((int) Math.round(clamp(r, 0, 1) * 255) << 16) | ((int) Math.round(clamp(g, 0, 1) * 255) << 8) | (int) Math.round(clamp(b, 0, 1) * 255);
    }
    /** Sky color at an elevation (0 = horizon, 1 = straight up) for a time of day. */
    public static int skyColor(Theme t, double elev, long ticks, Adjust a) {
        double e = clamp(elev, 0, 1), k = Math.pow(e, 0.6), d = daylight(ticks), s = sunsetAmount(ticks);
        int c = mix(mix(t.night().horizon(), t.night().zenith(), k), mix(t.day().horizon(), t.day().zenith(), k), d);
        c = mix(c, t.day().sunset(), s * 0.8 * (1 - e) * (1 - e));
        return adjust(c, a);
    }
    /** Night-sky visibility for stars, aurora and nebula: 0 in daylight, 1 at night. */
    public static double nightAmount(long ticks) { return Math.pow(1 - daylight(ticks), 1.5); }

    /** Deterministic PRNG (mulberry32), identical in visuals.js, so preview and game place stars in the same spots. */
    public static final class Rng {
        private int a; public Rng(int seed) { a = seed; }
        public double next() { a += 0x6D2B79F5; int t = a; t = (t ^ (t >>> 15)) * (t | 1); t ^= t + (t ^ (t >>> 7)) * (t | 61); return ((t ^ (t >>> 14)) & 0xFFFFFFFFL) / 4294967296.0; }
    }
    /** Stars on the unit sphere (y up). Built once when settings change, never per frame. */
    public static final class StarField {
        public final int count; public final float[] x, y, z, size, phase;
        public StarField(int seed, double density, double sizeMul) {
            count = (int) Math.round(1500 * clamp(density, 0, 3)); x = new float[count]; y = new float[count]; z = new float[count]; size = new float[count]; phase = new float[count];
            Rng r = new Rng(seed);
            for (int k = 0; k < count; k++) {
                double u = r.next() * 2 - 1, phi = r.next() * Math.PI * 2, s = Math.sqrt(1 - u * u);
                x[k] = (float) (s * Math.cos(phi)); y[k] = (float) u; z[k] = (float) (s * Math.sin(phi));
                size[k] = (float) ((0.15 + r.next() * 0.1) * sizeMul); phase[k] = (float) (r.next() * Math.PI * 2);
            }
        }
        /** 0..1 brightness of one star at a time in seconds. */
        public double brightness(int k, double seconds, double twinkleSpeed, double base, double night) {
            return clamp(base * (0.7 + 0.3 * Math.sin(seconds * twinkleSpeed * 2 + phase[k])) * night, 0, 1);
        }
    }
    /** Height (elevation 0..1) of aurora ribbon r at an azimuth (radians) and time (seconds). */
    public static double auroraElevation(double azimuth, double seconds, int r, double height, double speed) {
        return height + 0.06 * Math.sin(azimuth * 3 + seconds * 0.35 * speed + r * 1.7) + 0.025 * Math.sin(azimuth * 7.0 - seconds * 0.4 * speed + r);
    }
    /** Which theme a dimension uses: the overworld theme, or the dimension's own, or none (vanilla sky). */
    public static String themeFor(String dimension, String overworld, String nether, String end) {
        return switch (dimension) { case "minecraft:the_nether" -> "off".equals(nether) ? null : nether; case "minecraft:the_end" -> "off".equals(end) ? null : end; default -> overworld; };
    }
    /** Sky dome: rings from horizon to zenith, positions precomputed once. elev[v] drives the color lookup per frame. */
    public static final class Dome {
        public final int rings, segments; public final float[] pos, elev;
        public Dome(int rings, int segments) {
            this.rings = rings; this.segments = segments; pos = new float[(rings + 1) * (segments + 1) * 3]; elev = new float[(rings + 1) * (segments + 1)];
            for (int ri = 0; ri <= rings; ri++) for (int si = 0; si <= segments; si++) {
                double e = ri / (double) rings, pitch = e * Math.PI / 2, az = si / (double) segments * Math.PI * 2; int v = ri * (segments + 1) + si;
                pos[v * 3] = (float) (Math.cos(pitch) * Math.cos(az)); pos[v * 3 + 1] = (float) Math.sin(pitch); pos[v * 3 + 2] = (float) (Math.cos(pitch) * Math.sin(az)); elev[v] = (float) e;
            }
        }
    }
}
