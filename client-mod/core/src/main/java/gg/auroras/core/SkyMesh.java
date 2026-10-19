package gg.auroras.core;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * One frame of Custom Skies as position-color quads, built from the same Sky and SkyFx maths the launcher preview uses.
 * The 1.21.11+ adapter only has to hand these quads to Minecraft (4 vertices each, camera at the origin, y up), so all
 * of the geometry is here and tested instead of in version-specific code.
 *
 * Rules the adapter relies on:
 *  - every quad is wound counter-clockwise as seen from the origin, so it is drawn whether or not back faces are culled;
 *  - layers sit at fixed distances, nearer layers later (dome, nebula, constellations, stars, meteors, aurora, clouds,
 *    petals), so the result is the same with or without distance sorting and with or without depth testing;
 *  - nothing is allocated per frame: the arrays only grow when settings ask for more than before.
 */
public final class SkyMesh {
    public static final float DOME = 100f, NEBULA = 99.5f, CONSTELLATIONS = 99.3f, STARS = 99f, METEORS = 98f, AURORA = 95f, CLOUDS = 90f, PETALS = 60f;
    static final int BLOB_SIDES = 12;

    final Map<String, Sky.Theme> themes;
    final Map<String, Sky.StarField> starFields = new HashMap<>();
    final Map<String, SkyFx.Constellations> constellationSets = new HashMap<>();
    /** Vertex positions (x, y, z per vertex) and packed ARGB colors (one per vertex) for the last build. */
    public float[] pos = new float[0];
    public int[] col = new int[0];
    /** Quads written by the last build (4 vertices each). */
    public int quads;

    String overworld = "aurora", nether = "off", end = "off";
    Sky.Adjust adjust = Sky.Adjust.NONE;
    Quality quality = Quality.BALANCED;
    SkyFx.Budget budget = SkyFx.budget(Quality.BALANCED);
    Sky.Dome dome = new Sky.Dome(Quality.BALANCED.domeRings, 32);
    int[] ringColor = new int[Quality.BALANCED.domeRings + 1];
    double starDensity = 1, starSize = 1, starBrightness = 1, twinkle = 1, animSpeed = 1, opacity = 1, meteorMul = 1, nebulaSpeed = 1, waves = 1;
    boolean aurora = true, nebula = true, animate = true, clouds = true, petals = true, constellations = true;
    final float[] met = new float[SkyFx.METEOR_FIELDS * 4], o4 = new float[4];
    final float[][] p = new float[4][3];
    int v; // vertices written so far

    public SkyMesh(Map<String, Sky.Theme> themes) { this.themes = themes; }

    /** Reads the sky.* settings (and the client-wide quality) through get. Call when the settings revision changes, not per frame. */
    public void configure(Function<String, String> get) {
        overworld = get.apply("sky.theme"); nether = get.apply("sky.netherTheme"); end = get.apply("sky.endTheme");
        adjust = new Sky.Adjust(d(get, "sky.brightness"), d(get, "sky.saturation"), d(get, "sky.contrast"), Integer.parseInt(get.apply("sky.tint"), 16), d(get, "sky.tintStrength"));
        quality = SkyFx.skyQuality(get.apply("sky.skyQuality"), Quality.parse(get.apply(Config.Registry.QUALITY))); budget = SkyFx.budget(quality);
        dome = new Sky.Dome(quality.domeRings, 32); ringColor = new int[dome.rings + 1];
        starDensity = d(get, "sky.starDensity"); starSize = d(get, "sky.starSize"); starBrightness = d(get, "sky.starBrightness"); twinkle = d(get, "sky.twinkleSpeed");
        aurora = b(get, "sky.aurora") && quality.aurora; nebula = b(get, "sky.nebula") && quality.nebula; animate = b(get, "sky.animate");
        animSpeed = d(get, "sky.animSpeed"); opacity = d(get, "sky.effectsOpacity"); meteorMul = d(get, "sky.shootingStars"); nebulaSpeed = d(get, "sky.nebulaSpeed"); waves = d(get, "sky.auroraWaves");
        clouds = b(get, "sky.clouds"); petals = b(get, "sky.petals"); constellations = b(get, "sky.constellations");
        starFields.clear(); constellationSets.clear(); // rebuilt on first use with the new density and size
    }
    static double d(Function<String, String> get, String k) { return Double.parseDouble(get.apply(k)); }
    static boolean b(Function<String, String> get, String k) { return "true".equals(get.apply(k)); }

    /** The theme a dimension ("minecraft:overworld", "minecraft:the_nether", "minecraft:the_end", ...) uses, or null for the vanilla sky. */
    public Sky.Theme themeFor(String dimension) { String id = Sky.themeFor(dimension, overworld, nether, end); return id == null ? null : themes.get(id); }

    Sky.StarField stars(Sky.Theme t) {
        Sky.StarField f = starFields.get(t.id());
        if (f == null) {
            f = new Sky.StarField(1337, starDensity * t.starDensity() * quality.starMultiplier, starSize * t.starSize());
            starFields.put(t.id(), f); constellationSets.put(t.id(), new SkyFx.Constellations(f, 4242, 8));
        }
        return f;
    }

    /** Upper bound on the quads one frame of this theme can need with the current settings. */
    public int capacity(Sky.Theme t) {
        Sky.StarField f = stars(t); int layers = Math.min(t.fx().auroraLayers(), budget.auroraLayers());
        return dome.rings * dome.segments + dome.segments + budget.nebulaBlobs() * BLOB_SIDES + constellationSets.get(t.id()).groupOf.length + f.count + budget.meteors()
            + layers * t.auroraColors().length * budget.ribbonSteps() + budget.cloudPuffs() * BLOB_SIDES + (int) Math.ceil(budget.petals() * Math.max(0, t.fx().petals()));
    }

    /**
     * Builds the sky for a dimension at a time of day (ticks) and an animation time (seconds since the game started).
     * Returns false, writing nothing, when that dimension keeps the vanilla sky.
     */
    public boolean build(String dimension, long ticks, double seconds) {
        quads = 0; v = 0;
        Sky.Theme t = themeFor(dimension); if (t == null) return false;
        int cap = capacity(t); if (col.length < cap * 4) { pos = new float[cap * 12]; col = new int[cap * 4]; }
        SkyFx.Fx fx = t.fx(); Sky.StarField stars = stars(t); SkyFx.Constellations cons = constellationSets.get(t.id());
        double night = Sky.nightAmount(ticks), day = Sky.daylight(ticks), clk = SkyFx.clock(seconds, animSpeed, animate), starBase = starBrightness * t.starBrightness();

        // dome: one quad per ring and segment, colored by elevation
        for (int r = 0; r <= dome.rings; r++) ringColor[r] = Sky.skyColor(t, r / (double) dome.rings, ticks, adjust);
        int segs = dome.segments + 1;
        for (int r = 0; r < dome.rings; r++) for (int s = 0; s < dome.segments; s++) {
            int a = r * segs + s, bb = a + 1, c = a + segs, dd = c + 1, lo = 0xFF000000 | ringColor[r], hi = 0xFF000000 | ringColor[r + 1];
            quad(dx(a), dy(a), dz(a), lo, dx(bb), dy(bb), dz(bb), lo, dx(dd), dy(dd), dz(dd), hi, dx(c), dy(c), dz(c), hi);
        }
        // ground below the horizon so the dome never shows the void
        int g = 0xFF000000 | Sky.adjust(t.ground(), adjust);
        for (int s = 0; s < dome.segments; s++) quad(dx(s), 0, dz(s), g, dx(s + 1), 0, dz(s + 1), g, 0, -DOME, 0, g, 0, -DOME, 0, g);

        if (nebula && t.nebula() && t.nebulaColors().length > 0 && night > 0.01) {
            double drift = fx.nebulaDrift() * nebulaSpeed;
            for (int k = 0; k < budget.nebulaBlobs(); k++) { SkyFx.nebula(77, k, clk, drift, o4); blob(o4[0], o4[1], o4[2], 1, 1, Sky.adjust(t.nebulaColors()[k % t.nebulaColors().length], adjust), o4[3] * night * opacity, NEBULA); }
        }
        int tint = Sky.adjust(t.starTint(), adjust);
        if (night > 0.01) {
            if (constellations && fx.constellations()) for (int q = 0; q < cons.groupOf.length; q++) {
                if (cons.groupOf[q] >= budget.constellationGroups()) continue; int a = cons.pairs[q * 2], c = cons.pairs[q * 2 + 1], ca = alpha(SkyFx.Constellations.alpha(cons.groupOf[q], clk, night) * opacity) | tint;
                line(stars.x[a] * CONSTELLATIONS, stars.y[a] * CONSTELLATIONS, stars.z[a] * CONSTELLATIONS, stars.x[c] * CONSTELLATIONS, stars.y[c] * CONSTELLATIONS, stars.z[c] * CONSTELLATIONS, 0.12f, ca, ca);
            }
            for (int k = 0; k < stars.count; k++) {
                if (stars.y[k] < 0.02f) continue; double br = stars.brightness(k, clk, twinkle, starBase, night); if (br < 0.02) continue;
                star(stars.x[k], stars.y[k], stars.z[k], stars.size[k], ((int) (br * 255) << 24) | tint);
            }
            int n = night > 0.15 && animate ? SkyFx.meteors(99, fx.meteorsPerMinute() * meteorMul, clk, budget.meteors(), met) : 0;
            for (int k = 0; k < n; k++) {
                int o = k * SkyFx.METEOR_FIELDS; double el = met[o + 1] * Math.PI / 2, tel = (met[o + 1] - met[o + 3] * 0.45) * Math.PI / 2;
                float[] h = dir(met[o], el, p[0], METEORS), tl = dir(met[o] - met[o + 2] * 0.45, tel, p[1], METEORS);
                line(h[0], h[1], h[2], tl[0], tl[1], tl[2], 0.22f, alpha(met[o + 5] * night * opacity) | 0xFFFFFF, tint);
            }
        }
        int layers = Math.min(fx.auroraLayers(), budget.auroraLayers());
        if (aurora && t.aurora() && night > 0.01) for (int l = layers - 1; l >= 0; l--) for (int ri = 0; ri < t.auroraColors().length; ri++) ribbon(t, ri, l, clk, night);
        if (clouds && fx.clouds() > 0) for (int k = 0; k < budget.cloudPuffs(); k++) {
            SkyFx.cloud(17, k, clk, o4); int c = SkyFx.cloudColor(Sky.adjust(fx.cloudColor(), adjust), Sky.skyColor(t, o4[1], ticks, adjust), day);
            blob(o4[0], o4[1], o4[2], 1.8, 0.55, c, o4[3] * fx.clouds() * opacity, CLOUDS);
        }
        if (petals && fx.petals() > 0) {
            int c = Sky.adjust(fx.petalColor(), adjust), cnt = (int) Math.round(budget.petals() * fx.petals());
            for (int k = 0; k < cnt; k++) { SkyFx.petal(31, k, clk, o4); petal(o4[0], o4[1], o4[2], alpha(o4[3] * opacity) | c); }
        }
        return true;
    }

    float dx(int vi) { return dome.pos[vi * 3] * DOME; }
    float dy(int vi) { return dome.pos[vi * 3 + 1] * DOME; }
    float dz(int vi) { return dome.pos[vi * 3 + 2] * DOME; }
    static int alpha(double a) { return (int) Math.round(Sky.clamp(a, 0, 1) * 255) << 24; }

    /** Writes one quad, swapping its winding if needed so it is counter-clockwise seen from the origin. */
    void quad(float x0, float y0, float z0, int c0, float x1, float y1, float z1, int c1, float x2, float y2, float z2, int c2, float x3, float y3, float z3, int c3) {
        // normal of the first triangle, or of the second when the first is degenerate (fans repeat a corner)
        float ax = x1 - x0, ay = y1 - y0, az = z1 - z0, bx = x2 - x0, by = y2 - y0, bz = z2 - z0;
        float nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        if (nx * nx + ny * ny + nz * nz < 1e-12f) { float cx = x3 - x0, cy = y3 - y0, cz = z3 - z0; nx = by * cz - bz * cy; ny = bz * cx - bx * cz; nz = bx * cy - by * cx; }
        if (nx * x0 + ny * y0 + nz * z0 > 0) { put(x0, y0, z0, c0); put(x3, y3, z3, c3); put(x2, y2, z2, c2); put(x1, y1, z1, c1); }
        else { put(x0, y0, z0, c0); put(x1, y1, z1, c1); put(x2, y2, z2, c2); put(x3, y3, z3, c3); }
        quads++;
    }
    void put(float x, float y, float z, int c) { pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; col[v] = c; v++; }

    /** A small square facing the centre, at STARS distance. */
    void star(float x, float y, float z, float size, int argb) {
        float px = x * STARS, py = y * STARS, pz = z * STARS, s = size;
        float tx = -z, tz = x, tl = (float) Math.sqrt(tx * tx + tz * tz); if (tl < 1e-4f) { tx = 1; tz = 0; tl = 1; } tx = tx / tl * s; tz = tz / tl * s;
        float ux = -y * x, uy = x * x + z * z, uz = -y * z, ul = (float) Math.sqrt(ux * ux + uy * uy + uz * uz); if (ul < 1e-6f) { ux = 0; uy = 0; uz = 1; ul = 1; } ux = ux / ul * s; uy = uy / ul * s; uz = uz / ul * s;
        quad(px - tx - ux, py - uy, pz - tz - uz, argb, px + tx - ux, py - uy, pz + tz - uz, argb, px + tx + ux, py + uy, pz + tz + uz, argb, px - tx + ux, py + uy, pz - tz + uz, argb);
    }
    /** A thin quad from a to c, widened perpendicular to the line and the view direction; color ca at a, cc at c. */
    void line(float ax, float ay, float az, float cx, float cy, float cz, float w, int ca, int cc) {
        float lx = cx - ax, ly = cy - ay, lz = cz - az, nx = ly * az - lz * ay, ny = lz * ax - lx * az, nz = lx * ay - ly * ax, nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz); if (nl < 1e-5f) return;
        nx = nx / nl * w; ny = ny / nl * w; nz = nz / nl * w;
        quad(ax - nx, ay - ny, az - nz, ca, ax + nx, ay + ny, az + nz, ca, cx + nx, cy + ny, cz + nz, cc, cx - nx, cy - ny, cz - nz, cc);
    }
    /** Soft round glow: a fan, bright in the middle and transparent at the rim. Sizes in sky units (elevation 1 = 90 degrees). */
    void blob(double az, double el, double radius, double sx, double sy, int rgb, double a, float dist) {
        int ca = alpha(a) | rgb, ce = rgb & 0xFFFFFF; double e = el * Math.PI / 2, r = radius * Math.PI / 2, ce0 = Math.max(0.2, Math.cos(e)); float[] c = dir(az, e, p[0], dist);
        float cx = c[0], cy = c[1], cz = c[2];
        for (int s = 0; s < BLOB_SIDES; s++) {
            double t0 = s * Math.PI * 2 / BLOB_SIDES, t1 = (s + 1) * Math.PI * 2 / BLOB_SIDES;
            float[] p0 = dir(az + Math.cos(t0) * r * sx / ce0, e + Math.sin(t0) * r * sy, p[1], dist), p1 = dir(az + Math.cos(t1) * r * sx / ce0, e + Math.sin(t1) * r * sy, p[2], dist);
            quad(cx, cy, cz, ca, p0[0], p0[1], p0[2], ce, p1[0], p1[1], p1[2], ce, p1[0], p1[1], p1[2], ce);
        }
    }
    /** A petal: a small spinning diamond closer than the sky, so it reads as falling in front of it. */
    void petal(double az, double el, double spin, int argb) {
        double e = el * Math.PI / 2, s = 0.5, cs = Math.cos(spin) * s, sn = Math.sin(spin) * s * (0.5 + 0.5 * Math.abs(Math.sin(spin * 0.7)));
        float[] c = dir(az, e, p[0], PETALS), a1 = dir(az + cs / 60, e + sn / 60, p[1], PETALS), a2 = dir(az - cs / 60, e - sn / 60, p[2], PETALS), b1 = dir(az - sn * 0.5 / 60, e + cs * 0.5 / 60, p[3], PETALS);
        float bx = 2 * c[0] - b1[0], by = 2 * c[1] - b1[1], bz = 2 * c[2] - b1[2];
        quad(a1[0], a1[1], a1[2], argb, b1[0], b1[1], b1[2], argb, a2[0], a2[1], a2[2], argb, bx, by, bz, argb);
    }
    /** Aurora ribbon ri on layer l: a band around the sky following SkyFx.auroraWave, bright at the bottom and fading upward. */
    void ribbon(Sky.Theme t, int ri, int layer, double sec, double night) {
        int rgb = Sky.adjust(t.auroraColors()[ri], adjust), steps = budget.ribbonSteps(); double base = t.auroraStrength() * night * 140, h = 0.18 - layer * 0.03;
        for (int s = 0; s < steps; s++) {
            double a0 = s * Math.PI * 2 / steps, a1 = (s + 1) * Math.PI * 2 / steps;
            double e0 = SkyFx.auroraWave(a0, sec, ri, layer, t.auroraHeight(), t.auroraSpeed(), waves) * Math.PI / 2, e1 = SkyFx.auroraWave(a1, sec, ri, layer, t.auroraHeight(), t.auroraSpeed(), waves) * Math.PI / 2;
            int top0 = (int) Math.min(255, base * SkyFx.auroraShimmer(a0, sec, ri, layer, t.auroraSpeed())) << 24, top1 = (int) Math.min(255, base * SkyFx.auroraShimmer(a1, sec, ri, layer, t.auroraSpeed())) << 24;
            float[] p0 = dir(a0, e0, p[0], AURORA), p1 = dir(a1, e1, p[1], AURORA), q0 = dir(a0, e0 + h, p[2], AURORA), q1 = dir(a1, e1 + h, p[3], AURORA);
            quad(p0[0], p0[1], p0[2], top0 | rgb, p1[0], p1[1], p1[2], top1 | rgb, q1[0], q1[1], q1[2], rgb, q0[0], q0[1], q0[2], rgb);
        }
    }
    static float[] dir(double az, double el, float[] out, double dist) { out[0] = (float) (Math.cos(el) * Math.cos(az) * dist); out[1] = (float) (Math.sin(el) * dist); out[2] = (float) (Math.cos(el) * Math.sin(az) * dist); return out; }
}
