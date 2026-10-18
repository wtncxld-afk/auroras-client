package gg.auroras.core;

import java.util.*;

/**
 * Animated sky effects: shooting stars, drifting nebula clouds, moving clouds, falling petals, constellation lines and
 * layered aurora waves. Every effect is a pure function of (seed, index, time), so the game and the launcher preview
 * (visuals/visuals.js mirrors this file and is checked against visuals/sky-golden.json) draw the same thing at the same
 * moment, nothing has to be simulated frame by frame, and the per-frame functions write into caller-owned arrays
 * instead of allocating. Positions are sky coordinates: azimuth in radians and elevation 0 (horizon) .. 1 (zenith).
 */
public final class SkyFx {
    private SkyFx() {}

    /** Per-theme effect mix from themes.json "fx". Rates and densities are 0 when a theme doesn't use an effect. */
    public record Fx(double meteorsPerMinute, double clouds, int cloudColor, double petals, int petalColor, boolean constellations, double nebulaDrift, int auroraLayers) {
        public static final Fx NONE = new Fx(0, 0, 0xFFFFFF, 0, 0xFFFFFF, false, 0, 1);
    }
    public static Fx parse(Map<String, Object> fx) {
        if (fx == null) return Fx.NONE;
        return new Fx(range(Json.num(fx, "meteorsPerMinute"), 0, 30, "meteorsPerMinute"), range(Json.num(fx, "clouds"), 0, 1, "clouds"), Sky.hex(Json.str(fx, "cloudColor")),
            range(Json.num(fx, "petals"), 0, 1, "petals"), Sky.hex(Json.str(fx, "petalColor")), Json.bool(fx, "constellations"), range(Json.num(fx, "nebulaDrift"), 0, 3, "nebulaDrift"),
            (int) range(Json.num(fx, "auroraLayers"), 1, 3, "auroraLayers"));
    }
    static double range(double v, double lo, double hi, String what) { if (!(v >= lo && v <= hi)) throw new IllegalArgumentException("fx." + what + " must be " + lo + ".." + hi); return v; }

    /** How much of each effect a quality level may draw. Low keeps the sky animated but cheap. */
    public record Budget(int meteors, int petals, int cloudPuffs, int nebulaBlobs, int auroraLayers, int ribbonSteps, int constellationGroups) {}
    public static Budget budget(Quality q) {
        return switch (q) {
            case LOW -> new Budget(1, 32, 10, 0, 0, 32, 4);
            case BALANCED -> new Budget(2, 96, 20, 10, 2, 64, 6);
            case HIGH -> new Budget(4, 220, 36, 16, 3, 96, 8);
        };
    }
    /** Sky quality setting: "auto" follows the client-wide visual quality, otherwise LOW / BALANCED / HIGH. */
    public static Quality skyQuality(String setting, Quality global) { Quality q = Quality.parse(setting); return q != null ? q : global == null ? Quality.BALANCED : global; }

    /** Animation clock: real seconds times the speed setting; 0 when animation is off, so everything holds still. */
    public static double clock(double seconds, double speed, boolean animate) { return animate ? seconds * Sky.clamp(speed, 0, 3) : 0; }

    /** Integer hash (murmur3 finaliser) -> [0, 1). Same bits in JS via Math.imul. */
    public static double u(int seed, int index, int salt) {
        int h = seed ^ (index * 0x9E3779B1) ^ (salt * 0x85EBCA77);
        h ^= h >>> 16; h *= 0x85EBCA6B; h ^= h >>> 13; h *= 0xC2B2AE35; h ^= h >>> 16;
        return (h & 0xFFFFFFFFL) / 4294967296.0;
    }

    // ---- Shooting stars ----
    public static final double SLOT = 1.5, METEOR_MAX_LIFE = 1.2;
    public static final int METEOR_FIELDS = 6;
    /**
     * Shooting stars visible at time t. Time is cut into 1.5 s slots; each slot holds at most one meteor, present with
     * probability rate/60*SLOT, so the long-run rate matches the setting. Writes up to max meteors as
     * [azimuth, elevation, dirAz, dirElev, progress 0..1, alpha] into out and returns how many it wrote.
     */
    public static int meteors(int seed, double perMinute, double t, int max, float[] out) {
        if (perMinute <= 0 || max <= 0) return 0;
        double p = Math.min(1, perMinute / 60.0 * SLOT); int n = 0;
        long first = (long) Math.floor((t - METEOR_MAX_LIFE) / SLOT), last = (long) Math.floor(t / SLOT);
        for (long s = first; s <= last && n < max; s++) {
            int i = (int) s; if (u(seed, i, 0) >= p) continue;
            double start = s * SLOT + u(seed, i, 1) * SLOT, life = 0.6 + u(seed, i, 2) * 0.6, age = t - start;
            if (age < 0 || age >= life) continue;
            double prog = age / life, az = u(seed, i, 3) * Math.PI * 2, el = 0.35 + u(seed, i, 4) * 0.45, ang = -0.35 - u(seed, i, 5) * 0.8, len = 0.18 + u(seed, i, 6) * 0.14;
            double dAz = Math.cos(ang) * len * (u(seed, i, 7) < 0.5 ? -1 : 1), dEl = Math.sin(ang) * len;
            int o = n * METEOR_FIELDS;
            out[o] = (float) (az + dAz * prog); out[o + 1] = (float) (el + dEl * prog); out[o + 2] = (float) dAz; out[o + 3] = (float) dEl; out[o + 4] = (float) prog;
            out[o + 5] = (float) (Math.sin(prog * Math.PI) * (0.75 + u(seed, i, 8) * 0.25)); n++;
        }
        return n;
    }

    // ---- Falling petals ----
    /** Petal k at time t as [azimuth, elevation, spin radians, alpha]. Petals fall from the zenith to just below the horizon and wrap. */
    public static void petal(int seed, int k, double t, float[] out) {
        double fall = 0.035 + u(seed, k, 1) * 0.035, phase = u(seed, k, 2), y = (phase + t * fall) % 1.0;
        double el = 1.0 - y * 1.1, sway = 0.09 * Math.sin(t * (0.5 + u(seed, k, 3) * 0.7) + k * 1.3);
        out[0] = (float) (u(seed, k, 0) * Math.PI * 2 + sway); out[1] = (float) el; out[2] = (float) (t * (0.8 + u(seed, k, 4) * 2.2) + k);
        out[3] = (float) (Sky.clamp((el + 0.1) / 0.15, 0, 1) * Sky.clamp((1 - el) / 0.1, 0, 1) * (0.55 + u(seed, k, 5) * 0.45));
    }

    // ---- Clouds ----
    /** Cloud puff k as [azimuth, elevation, angular size, alpha before density]. Puffs drift slowly around the horizon. */
    public static void cloud(int seed, int k, double t, float[] out) {
        out[0] = (float) (u(seed, k, 0) * Math.PI * 2 + t * 0.006 * (0.5 + u(seed, k, 1))); out[1] = (float) (0.04 + u(seed, k, 2) * 0.16);
        out[2] = (float) (0.08 + u(seed, k, 3) * 0.12); out[3] = (float) ((0.35 + u(seed, k, 4) * 0.4) * (0.85 + 0.15 * Math.sin(t * 0.2 + k)));
    }
    /** Cloud color: lit by day, dimmed toward the sky color at night. */
    public static int cloudColor(int cloud, int skyAtCloud, double daylight) { return Sky.mix(skyAtCloud, cloud, 0.25 + 0.6 * Sky.clamp(daylight, 0, 1)); }

    // ---- Nebula ----
    /** Nebula blob k as [azimuth, elevation, angular radius, alpha]. Drift and a slow breathing of brightness. */
    public static void nebula(int seed, int k, double t, double drift, float[] out) {
        out[0] = (float) (u(seed, k, 0) * Math.PI * 2 + t * 0.012 * drift * (u(seed, k, 1) < 0.5 ? -1 : 1)); out[1] = (float) (0.12 + u(seed, k, 2) * 0.45);
        out[2] = (float) (0.35 + u(seed, k, 3) * 0.4); out[3] = (float) (0.3 * (0.7 + 0.3 * Math.sin(t * 0.15 * (0.5 + drift) + k * 2.1)));
    }

    // ---- Aurora ----
    /** Layered aurora: ribbon r, layer l. waves scales the wave amplitude (1 = the classic Sky.auroraElevation curve). */
    public static double auroraWave(double az, double t, int r, int layer, double height, double speed, double waves) {
        double sp = speed * (1 + layer * 0.18);
        return height + layer * 0.04 + waves * (0.06 * Math.sin(az * 3 + t * 0.35 * sp + r * 1.7 + layer * 0.9) + 0.025 * Math.sin(az * 7.0 - t * 0.4 * sp + r + layer * 2.3));
    }
    /** 0..1 brightness ripple travelling along a ribbon; deeper layers are fainter. */
    public static double auroraShimmer(double az, double t, int r, int layer, double speed) {
        return (0.65 + 0.35 * Math.sin(az * 11 + t * 1.3 * speed + r * 2 + layer)) * (1 - layer * 0.28);
    }

    // ---- Constellations ----
    /**
     * Picks groups of nearby upper-sky stars and links each into a chain. Returns star index pairs [a0, b0, a1, b1, ...];
     * pair p belongs to group groupOf[p]. Built once per star field.
     */
    public static final class Constellations {
        public final int[] pairs, groupOf; public final int groups;
        public Constellations(Sky.StarField f, int seed, int groups) {
            List<Integer> cand = new ArrayList<>(); for (int k = 0; k < f.count; k++) if (f.y[k] > 0.3f) cand.add(k);
            List<int[]> out = new ArrayList<>(); Set<Integer> used = new HashSet<>(); int g = 0;
            for (int tries = 0; g < groups && tries < groups * 8 && !cand.isEmpty(); tries++) {
                int a = cand.get((int) (u(seed, tries, 0) * cand.size())); if (used.contains(a)) continue;
                int len = 4 + (int) (u(seed, tries, 1) * 3), cur = a; List<int[]> chain = new ArrayList<>(); Set<Integer> mine = new HashSet<>(); mine.add(a);
                for (int s = 1; s < len; s++) {
                    int best = -1; double bd = 0.045;
                    for (int c : cand) { if (mine.contains(c) || used.contains(c)) continue; double dx = f.x[c] - f.x[cur], dy = f.y[c] - f.y[cur], dz = f.z[c] - f.z[cur], d = dx * dx + dy * dy + dz * dz; if (d < bd && d > 0.002) { bd = d; best = c; } }
                    if (best < 0) break; chain.add(new int[]{cur, best, g}); mine.add(best); cur = best;
                }
                if (chain.size() >= 3) { out.addAll(chain); used.addAll(mine); g++; }
            }
            this.groups = g; pairs = new int[out.size() * 2]; groupOf = new int[out.size()];
            for (int p = 0; p < out.size(); p++) { pairs[p * 2] = out.get(p)[0]; pairs[p * 2 + 1] = out.get(p)[1]; groupOf[p] = out.get(p)[2]; }
        }
        /** Line alpha for a group: fades in at night and pulses gently, each group on its own phase. */
        public static double alpha(int group, double t, double night) { return 0.45 * night * (0.6 + 0.4 * Math.sin(t * 0.5 + group * 1.9)); }
    }
}
