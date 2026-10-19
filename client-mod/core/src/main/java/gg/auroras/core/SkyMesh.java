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
 *  - every quad is drawn as the triangles (0,1,2) and (0,2,3) or (0,1,2) and (2,3,0), which cover the same area, so a
 *    quad can carry a two-triangle fan around its first vertex (soft glows use that);
 *  - layers sit at fixed distances, nearer layers later (dome, nebula, constellations, stars, meteors, aurora, clouds,
 *    petals), so the result is the same with or without distance sorting and with or without depth testing;
 *  - nothing is allocated per frame: the arrays only grow when settings ask for more than before.
 *
 * Quality (all of it is mesh detail on top of the shared Sky / SkyFx maths, so the preview and the game still agree on
 * where things are and when):
 *  - the dome has more rings than Quality.domeRings, packed toward the horizon where the gradient changes fastest, a
 *    soft haze band below the horizon instead of a hard edge into the ground, and a sunrise/sunset glow that is
 *    strongest on the sun's side of the sky (vanilla's own sunrise fan is skipped while a theme is drawn);
 *  - stars have magnitudes: most are small and faint, a few are larger with a soft halo, colours vary slightly from
 *    warm to cool, twinkle has two frequencies and is stronger near the horizon, and stars fade out toward the horizon;
 *    a second layer of tiny dim stars gathers along a milky-way band;
 *  - aurora curtains have a soft fade under the lower edge, a bright edge, and a long fade upward that shifts toward the
 *    next aurora colour, with slowly drifting vertical rays, on 1.5x the ribbon steps of the effect budget;
 *  - nebula and cloud puffs have a rounded (two-ring) falloff and irregular, slowly turning outlines instead of a
 *    12-sided cone; clouds are lit from above;
 *  - shooting stars taper from a glowing head into the tail, constellation lines have soft edges.
 * Everything that moves is a pure function of the continuous animation clock, so motion is smooth at any frame rate.
 */
public final class SkyMesh {
    public static final float DOME = 100f, NEBULA = 99.5f, CONSTELLATIONS = 99.3f, STARS = 99f, METEORS = 98f, AURORA = 95f, CLOUDS = 90f, PETALS = 60f;
    /** Outline points of a nebula or cloud puff, and the quads one puff needs (inner fan + outer ring). */
    static final int BLOB_SIDES = 16, BLOB_QUADS = BLOB_SIDES / 2 + BLOB_SIDES;
    /** Haze rings below the horizon (elevation 0 down to -HAZE) between the sky and the ground colour. */
    static final int HAZE_RINGS = 2; static final double HAZE = 0.07;
    /** Quads per bright star's halo (an octagon fan), per shooting star, per constellation line, per aurora column. */
    static final int HALO_QUADS = 4, METEOR_QUADS = 6, LINE_QUADS = 2, AURORA_ROWS = 3;
    /** Stars brighter than this magnitude (0..1, most stars are far below it) get a halo. */
    static final double HALO_MAG = 0.62;

    final Map<String, Sky.Theme> themes;
    final Map<String, Stars> starSets = new HashMap<>();
    /** Vertex positions (x, y, z per vertex) and packed ARGB colors (one per vertex) for the last build. */
    public float[] pos = new float[0];
    public int[] col = new int[0];
    /** Quads written by the last build (4 vertices each). */
    public int quads;

    String overworld = "aurora", nether = "off", end = "off";
    Sky.Adjust adjust = Sky.Adjust.NONE;
    Quality quality = Quality.BALANCED;
    SkyFx.Budget budget = SkyFx.budget(Quality.BALANCED);
    int rings, segs, auroraSteps;
    float[] domeDir = new float[0], ringElev = new float[0];
    int[] ringBase = new int[0], vcol = new int[0];
    double starDensity = 1, starSize = 1, starBrightness = 1, twinkle = 1, animSpeed = 1, opacity = 1, meteorMul = 1, nebulaSpeed = 1, waves = 1;
    boolean aurora = true, nebula = true, animate = true, clouds = true, petals = true, constellations = true;
    final float[] met = new float[SkyFx.METEOR_FIELDS * 4], o4 = new float[4];
    final float[][] p = new float[4][3], pc = new float[8][3];
    final float[] inner = new float[(BLOB_SIDES + 1) * 3], outer = new float[(BLOB_SIDES + 1) * 3];
    final int[] innerCol = new int[BLOB_SIDES + 1];
    final double[] colPrev = new double[3], colCur = new double[3];
    int v; // vertices written so far

    /** A theme's star field plus the per-star look derived from it once (magnitude, size, colour) and the dim layer. */
    static final class Stars {
        final Sky.StarField f; final SkyFx.Constellations cons; final float[] size, lum, tw; final int[] rgb; final boolean[] halo; final int halos;
        final int dim; final float[] dx, dy, dz, dsize, dlum; final int dimRgb;
        Stars(Sky.StarField f, SkyFx.Constellations cons, Sky.Theme t, Sky.Adjust adj, double sizeMul, double dimShare) {
            this.f = f; this.cons = cons; int n = f.count; size = new float[n]; lum = new float[n]; tw = new float[n]; rgb = new int[n]; halo = new boolean[n]; int h = 0;
            int warm = Sky.mix(t.starTint(), 0xFFD7A8, 0.5), cool = Sky.mix(t.starTint(), 0xB4C8FF, 0.5);
            for (int k = 0; k < n; k++) {
                double mag = Math.pow(SkyFx.u(2024, k, 0), 2.6), c = SkyFx.u(2024, k, 1); // most stars faint, a few bright
                size[k] = (float) (f.size[k] * (0.5 + 0.75 * mag)); lum[k] = (float) (0.38 + 0.62 * Math.sqrt(mag)); tw[k] = (float) (0.6 + 0.9 * SkyFx.u(2024, k, 2));
                rgb[k] = Sky.adjust(c < 0.16 ? warm : c > 0.84 ? cool : t.starTint(), adj); halo[k] = mag > HALO_MAG; if (halo[k]) h++;
            }
            halos = h;
            // dim layer: tiny faint stars, a little over half of them pulled toward a tilted great circle (a milky-way band)
            int want = (int) Math.round(n * dimShare); dx = new float[want]; dy = new float[want]; dz = new float[want]; dsize = new float[want]; dlum = new float[want];
            double nx = 0.28, ny = 0.34, nz = 0.9, nl = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= nl; ny /= nl; nz /= nl;
            int d = 0;
            for (int k = 0; d < want && k < want * 4; k++) {
                double uu = SkyFx.u(911, k, 0) * 2 - 1, phi = SkyFx.u(911, k, 1) * Math.PI * 2, s = Math.sqrt(1 - uu * uu), x = s * Math.cos(phi), y = uu, z = s * Math.sin(phi);
                boolean band = SkyFx.u(911, k, 2) < 0.55;
                if (band) { double dd = x * nx + y * ny + z * nz, keep = 0.12 + 0.1 * SkyFx.u(911, k, 3); x -= nx * dd * (1 - keep); y -= ny * dd * (1 - keep); z -= nz * dd * (1 - keep); double l = Math.sqrt(x * x + y * y + z * z); x /= l; y /= l; z /= l; }
                if (y < 0.03) continue;
                dx[d] = (float) x; dy[d] = (float) y; dz[d] = (float) z; dsize[d] = (float) ((0.075 + 0.04 * SkyFx.u(911, k, 4)) * sizeMul);
                dlum[d] = (float) ((band ? 0.3 : 0.22) + 0.18 * SkyFx.u(911, k, 5)); d++;
            }
            dim = d; dimRgb = Sky.adjust(Sky.mix(t.starTint(), 0xC8D6FF, 0.3), adj);
        }
    }

    public SkyMesh(Map<String, Sky.Theme> themes) { this.themes = themes; geometry(); }

    /** Reads the sky.* settings (and the client-wide quality) through get. Call when the settings revision changes, not per frame. */
    public void configure(Function<String, String> get) {
        overworld = get.apply("sky.theme"); nether = get.apply("sky.netherTheme"); end = get.apply("sky.endTheme");
        adjust = new Sky.Adjust(d(get, "sky.brightness"), d(get, "sky.saturation"), d(get, "sky.contrast"), Integer.parseInt(get.apply("sky.tint"), 16), d(get, "sky.tintStrength"));
        quality = SkyFx.skyQuality(get.apply("sky.skyQuality"), Quality.parse(get.apply(Config.Registry.QUALITY))); budget = SkyFx.budget(quality);
        geometry();
        starDensity = d(get, "sky.starDensity"); starSize = d(get, "sky.starSize"); starBrightness = d(get, "sky.starBrightness"); twinkle = d(get, "sky.twinkleSpeed");
        aurora = b(get, "sky.aurora") && quality.aurora; nebula = b(get, "sky.nebula") && quality.nebula; animate = b(get, "sky.animate");
        animSpeed = d(get, "sky.animSpeed"); opacity = d(get, "sky.effectsOpacity"); meteorMul = d(get, "sky.shootingStars"); nebulaSpeed = d(get, "sky.nebulaSpeed"); waves = d(get, "sky.auroraWaves");
        clouds = b(get, "sky.clouds"); petals = b(get, "sky.petals"); constellations = b(get, "sky.constellations");
        starSets.clear(); // rebuilt on first use with the new density, size and colour settings
    }
    static double d(Function<String, String> get, String k) { return Double.parseDouble(get.apply(k)); }
    static boolean b(Function<String, String> get, String k) { return "true".equals(get.apply(k)); }

    /** Dome rings and segments for the quality: rings packed toward the horizon, haze rings below it. Built once per configure. */
    void geometry() {
        rings = switch (quality) { case LOW -> 12; case BALANCED -> 20; case HIGH -> 32; };
        segs = switch (quality) { case LOW -> 32; case BALANCED -> 40; case HIGH -> 48; };
        auroraSteps = budget.ribbonSteps() * 3 / 2;
        int total = HAZE_RINGS + rings + 1; ringElev = new float[total]; domeDir = new float[total * (segs + 1) * 3]; ringBase = new int[rings + 1]; vcol = new int[total * (segs + 1)];
        for (int r = 0; r < total; r++) {
            int sr = r - HAZE_RINGS; double e = sr < 0 ? sr * HAZE / HAZE_RINGS : Math.pow(sr / (double) rings, 1.5); ringElev[r] = (float) e;
            double pitch = e * Math.PI / 2;
            for (int s = 0; s <= segs; s++) { double az = s / (double) segs * Math.PI * 2; int vi = (r * (segs + 1) + s) * 3;
                domeDir[vi] = (float) (Math.cos(pitch) * Math.cos(az)); domeDir[vi + 1] = (float) Math.sin(pitch); domeDir[vi + 2] = (float) (Math.cos(pitch) * Math.sin(az)); }
        }
    }
    /** Quads of the dome, the haze band and the ground for the current quality. */
    public int domeQuads() { return rings * segs + HAZE_RINGS * segs + segs; }

    /** The theme a dimension ("minecraft:overworld", "minecraft:the_nether", "minecraft:the_end", ...) uses, or null for the vanilla sky. */
    public Sky.Theme themeFor(String dimension) { String id = Sky.themeFor(dimension, overworld, nether, end); return id == null ? null : themes.get(id); }

    Stars stars(Sky.Theme t) {
        Stars s = starSets.get(t.id());
        if (s == null) {
            Sky.StarField f = new Sky.StarField(1337, starDensity * t.starDensity() * quality.starMultiplier, starSize * t.starSize());
            double dimShare = switch (quality) { case LOW -> 0.3; case BALANCED -> 0.5; case HIGH -> 0.6; };
            s = new Stars(f, new SkyFx.Constellations(f, 4242, 8), t, adjust, starSize * t.starSize(), dimShare); starSets.put(t.id(), s);
        }
        return s;
    }

    /** Upper bound on the quads one frame of this theme can need with the current settings. */
    public int capacity(Sky.Theme t) {
        Stars s = stars(t); int layers = Math.min(t.fx().auroraLayers(), budget.auroraLayers());
        return domeQuads() + budget.nebulaBlobs() * BLOB_QUADS + s.cons.groupOf.length * LINE_QUADS + s.f.count + s.halos * HALO_QUADS + s.dim + budget.meteors() * METEOR_QUADS
            + layers * t.auroraColors().length * auroraSteps * AURORA_ROWS + budget.cloudPuffs() * BLOB_QUADS + (int) Math.ceil(budget.petals() * Math.max(0, t.fx().petals()));
    }

    /**
     * Builds the sky for a dimension at a time of day (ticks) and an animation time (seconds since the game started).
     * Returns false, writing nothing, when that dimension keeps the vanilla sky.
     */
    public boolean build(String dimension, long ticks, double seconds) {
        quads = 0; v = 0;
        Sky.Theme t = themeFor(dimension); if (t == null) return false;
        int cap = capacity(t); if (col.length < cap * 4) { pos = new float[cap * 12]; col = new int[cap * 4]; }
        SkyFx.Fx fx = t.fx(); Stars st = stars(t); Sky.StarField stars = st.f; SkyFx.Constellations cons = st.cons;
        double night = Sky.nightAmount(ticks), day = Sky.daylight(ticks), clk = SkyFx.clock(seconds, animSpeed, animate), starBase = starBrightness * t.starBrightness();

        dome(t, ticks);
        if (nebula && t.nebula() && t.nebulaColors().length > 0 && night > 0.01) {
            double drift = fx.nebulaDrift() * nebulaSpeed; int nc = t.nebulaColors().length;
            for (int k = 0; k < budget.nebulaBlobs(); k++) {
                SkyFx.nebula(77, k, clk, drift, o4); int c = Sky.adjust(t.nebulaColors()[k % nc], adjust), c2 = Sky.adjust(t.nebulaColors()[(k + 1) % nc], adjust);
                blob(o4[0], o4[1], o4[2], 1, 1, Sky.mix(c, c2, 0.35), c, Sky.mix(c, c2, 0.6), o4[3] * night * opacity, NEBULA, k, clk * (0.3 + drift), 0.2);
            }
        }
        if (night > 0.01) {
            int tint = Sky.adjust(t.starTint(), adjust);
            if (constellations && fx.constellations()) for (int q = 0; q < cons.groupOf.length; q++) {
                if (cons.groupOf[q] >= budget.constellationGroups()) continue; int a = cons.pairs[q * 2], c = cons.pairs[q * 2 + 1], ca = alpha(SkyFx.Constellations.alpha(cons.groupOf[q], clk, night) * opacity) | tint;
                softLine(stars.x[a] * CONSTELLATIONS, stars.y[a] * CONSTELLATIONS, stars.z[a] * CONSTELLATIONS, stars.x[c] * CONSTELLATIONS, stars.y[c] * CONSTELLATIONS, stars.z[c] * CONSTELLATIONS, 0.17f, ca, ca);
            }
            double base = starBase * night;
            if (base > 0.01) {
                // dim layer first (it sits behind the bright stars at the same distance)
                for (int k = 0; k < st.dim; k++) {
                    double br = base * st.dlum[k] * horizonFade(st.dy[k]) * (0.85 + 0.15 * Math.sin(clk * twinkle * 0.7 + k * 2.39)); if (br < 0.02) continue;
                    star(st.dx[k], st.dy[k], st.dz[k], st.dsize[k], alpha(br) | st.dimRgb, 0, 0);
                }
                for (int k = 0; k < stars.count; k++) {
                    float y = stars.y[k]; if (y < 0.02f) continue;
                    double ph = stars.phase[k], sp = clk * twinkle * st.tw[k], depth = 0.16 + 0.34 * (1 - smooth(0, 0.5, y));
                    double sc = 0.6 * (0.5 + 0.5 * Math.sin(sp * 2 + ph)) + 0.4 * (0.5 + 0.5 * Math.sin(sp * 3.7 + ph * 1.7));
                    double br = Sky.clamp(base * st.lum[k] * horizonFade(y) * (1 - depth * sc), 0, 1); if (br < 0.02) continue;
                    star(stars.x[k], y, stars.z[k], st.size[k], alpha(br) | st.rgb[k], st.halo[k] ? st.size[k] * 3.2f : 0, alpha(br * 0.32) | st.rgb[k]);
                }
            }
            int n = night > 0.15 && animate ? SkyFx.meteors(99, fx.meteorsPerMinute() * meteorMul, clk, budget.meteors(), met) : 0;
            for (int k = 0; k < n; k++) {
                int o = k * SkyFx.METEOR_FIELDS; double el = met[o + 1] * Math.PI / 2, tel = (met[o + 1] - met[o + 3] * 0.45) * Math.PI / 2;
                float[] h = dir(met[o], el, p[0], METEORS), tl = dir(met[o] - met[o + 2] * 0.45, tel, p[1], METEORS);
                streak(h[0], h[1], h[2], tl[0], tl[1], tl[2], met[o + 5] * night * opacity, tint);
            }
        }
        int layers = Math.min(fx.auroraLayers(), budget.auroraLayers());
        if (aurora && t.aurora() && night > 0.01) for (int l = layers - 1; l >= 0; l--) for (int ri = 0; ri < t.auroraColors().length; ri++) ribbon(t, ri, l, clk, night);
        if (clouds && fx.clouds() > 0) {
            int cc = Sky.adjust(fx.cloudColor(), adjust);
            for (int k = 0; k < budget.cloudPuffs(); k++) {
                SkyFx.cloud(17, k, clk, o4); int sky = Sky.skyColor(t, o4[1], ticks, adjust), c = SkyFx.cloudColor(cc, sky, day);
                blob(o4[0], o4[1], o4[2], 1.8, 0.55, c, Sky.mix(c, sky, 0.3), Sky.mix(c, 0xFFFFFF, 0.08 + 0.2 * day), o4[3] * fx.clouds() * opacity, CLOUDS, k + 100, clk * 0.5, 0.14);
            }
        }
        if (petals && fx.petals() > 0) {
            int c = Sky.adjust(fx.petalColor(), adjust), cnt = (int) Math.round(budget.petals() * fx.petals());
            for (int k = 0; k < cnt; k++) { SkyFx.petal(31, k, clk, o4); petal(o4[0], o4[1], o4[2], alpha(o4[3] * opacity) | c); }
        }
        return true;
    }

    static double smooth(double e0, double e1, double x) { double k = Sky.clamp((x - e0) / (e1 - e0), 0, 1); return k * k * (3 - 2 * k); }
    /** Stars thin out in the thick air near the horizon. y is the star's height on the unit sphere. */
    static double horizonFade(double y) { return 0.25 + 0.75 * smooth(0.0, 0.22, y); }

    /**
     * Dome, haze and ground. Ring colours come from Sky.skyColor; while the sun is rising or setting the glow is
     * redistributed toward the sun's side (the sun moves in the x-y plane: east is +x at sunrise, west is -x at sunset).
     */
    void dome(Sky.Theme t, long ticks) {
        int total = HAZE_RINGS + rings + 1, w = segs + 1; double sunset = Sky.sunsetAmount(ticks);
        int ground = Sky.adjust(t.ground(), adjust);
        if (sunset < 0.002) {
            for (int r = 0; r <= rings; r++) { int c = Sky.skyColor(t, ringElev[r + HAZE_RINGS], ticks, adjust); for (int s = 0; s <= segs; s++) vcol[(r + HAZE_RINGS) * w + s] = c; }
        } else {
            // the same blend as Sky.skyColor without its all-round sunset term, then a directional one
            double d = Sky.daylight(ticks), sunX = -Math.sin(Sky.skyAngle(ticks) * Math.PI * 2) >= 0 ? 1 : -1;
            for (int r = 0; r <= rings; r++) { double k = Math.pow(ringElev[r + HAZE_RINGS], 0.6); ringBase[r] = Sky.mix(Sky.mix(t.night().horizon(), t.night().zenith(), k), Sky.mix(t.day().horizon(), t.day().zenith(), k), d); }
            for (int r = 0; r <= rings; r++) for (int s = 0; s <= segs; s++) {
                int vi = (r + HAZE_RINGS) * w + s; double e = ringElev[r + HAZE_RINGS], cx = domeDir[vi * 3], ch = Math.sqrt(cx * cx + domeDir[vi * 3 + 2] * domeDir[vi * 3 + 2]);
                double f = ch < 1e-4 ? 0 : Math.max(0, cx / ch * sunX), amt = sunset * (0.32 + 0.78 * f * f) * Math.pow(1 - e, 2.3 - 1.1 * f);
                vcol[vi] = Sky.adjust(Sky.mix(ringBase[r], t.day().sunset(), amt), adjust);
            }
        }
        // haze below the horizon: the horizon colour eases into the ground
        for (int r = 0; r < HAZE_RINGS; r++) { double k = smooth(0, 1, (HAZE_RINGS - r) / (double) HAZE_RINGS); for (int s = 0; s <= segs; s++) vcol[r * w + s] = Sky.mix(vcol[HAZE_RINGS * w + s], ground, k); }
        // sky rings first (the horizon ring is the first segs quads), then the haze, then the ground fan
        for (int r = HAZE_RINGS; r < total - 1; r++) domeRow(r);
        for (int r = HAZE_RINGS - 1; r >= 0; r--) domeRow(r);
        int g = 0xFF000000 | ground;
        for (int s = 0; s < segs; s++) quad(dx(s), dy(s), dz(s), g, dx(s + 1), dy(s + 1), dz(s + 1), g, 0, -DOME, 0, g, 0, -DOME, 0, g);
    }
    void domeRow(int r) {
        int w = segs + 1;
        for (int s = 0; s < segs; s++) {
            int a = r * w + s, bb = a + 1, c = a + w, dd = c + 1;
            quad(dx(a), dy(a), dz(a), 0xFF000000 | vcol[a], dx(bb), dy(bb), dz(bb), 0xFF000000 | vcol[bb], dx(dd), dy(dd), dz(dd), 0xFF000000 | vcol[dd], dx(c), dy(c), dz(c), 0xFF000000 | vcol[c]);
        }
    }

    float dx(int vi) { return domeDir[vi * 3] * DOME; }
    float dy(int vi) { return domeDir[vi * 3 + 1] * DOME; }
    float dz(int vi) { return domeDir[vi * 3 + 2] * DOME; }
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

    /**
     * A star at STARS distance facing the centre: a small crisp square core and, when halo > 0, a soft octagonal glow of
     * that radius around it (bright in the middle, transparent at the rim).
     */
    void star(float x, float y, float z, float size, int argb, float halo, int haloArgb) {
        float px = x * STARS, py = y * STARS, pz = z * STARS, s = size;
        float tx = -z, tz = x, tl = (float) Math.sqrt(tx * tx + tz * tz); if (tl < 1e-4f) { tx = 1; tz = 0; tl = 1; } tx /= tl; tz /= tl;
        float ux = -y * x, uy = x * x + z * z, uz = -y * z, ul = (float) Math.sqrt(ux * ux + uy * uy + uz * uz); if (ul < 1e-6f) { ux = 0; uy = 0; uz = 1; ul = 1; } ux /= ul; uy /= ul; uz /= ul;
        if (halo > 0) {
            int rim = haloArgb & 0xFFFFFF; float[] r = inner;
            for (int k = 0; k <= 8; k++) { double a = k * Math.PI / 4; float c = (float) Math.cos(a) * halo, sn = (float) Math.sin(a) * halo;
                r[k * 3] = px + tx * c + ux * sn; r[k * 3 + 1] = py + uy * sn; r[k * 3 + 2] = pz + tz * c + uz * sn; }
            for (int k = 0; k < 8; k += 2) quad(px, py, pz, haloArgb, r[k * 3], r[k * 3 + 1], r[k * 3 + 2], rim, r[k * 3 + 3], r[k * 3 + 4], r[k * 3 + 5], rim, r[k * 3 + 6], r[k * 3 + 7], r[k * 3 + 8], rim);
        }
        float ax = tx * s, az = tz * s, bx = ux * s, by = uy * s, bz = uz * s;
        quad(px - ax - bx, py - by, pz - az - bz, argb, px + ax - bx, py - by, pz + az - bz, argb, px + ax + bx, py + by, pz + az + bz, argb, px - ax + bx, py + by, pz - az + bz, argb);
    }
    /** Unit normal of the plane through the origin, a and c, scaled by w (the side direction of a line seen from the camera). */
    boolean side(float ax, float ay, float az, float cx, float cy, float cz, float w, float[] out) {
        float lx = cx - ax, ly = cy - ay, lz = cz - az, nx = ly * az - lz * ay, ny = lz * ax - lx * az, nz = lx * ay - ly * ax, nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz); if (nl < 1e-5f) return false;
        out[0] = nx / nl * w; out[1] = ny / nl * w; out[2] = nz / nl * w; return true;
    }
    /** A line from a to c with soft edges: opaque along the middle, transparent at both sides. Color ca at a, cc at c. */
    void softLine(float ax, float ay, float az, float cx, float cy, float cz, float w, int ca, int cc) {
        float[] n = p[3]; if (!side(ax, ay, az, cx, cy, cz, w, n)) return; int ea = ca & 0xFFFFFF, ec = cc & 0xFFFFFF;
        quad(ax, ay, az, ca, ax + n[0], ay + n[1], az + n[2], ea, cx + n[0], cy + n[1], cz + n[2], ec, cx, cy, cz, cc);
        quad(ax, ay, az, ca, cx, cy, cz, cc, cx - n[0], cy - n[1], cz - n[2], ec, ax - n[0], ay - n[1], az - n[2], ea);
    }
    /** A shooting star: a small glowing head and a tail that tapers to nothing, white at the head, tinted toward the tail. */
    void streak(float hx, float hy, float hz, float tx, float ty, float tz, double a, int tint) {
        float[] n = p[3]; if (!side(hx, hy, hz, tx, ty, tz, 0.26f, n)) return;
        int head = alpha(a) | 0xFFFFFF, edge = 0xFFFFFF, tail = tint & 0xFFFFFF;
        quad(hx, hy, hz, head, hx + n[0], hy + n[1], hz + n[2], edge, tx, ty, tz, tail, tx, ty, tz, tail);
        quad(hx, hy, hz, head, tx, ty, tz, tail, hx - n[0], hy - n[1], hz - n[2], edge, hx - n[0], hy - n[1], hz - n[2], edge);
        // head glow: an octagon fan facing the camera
        float l = (float) Math.sqrt(hx * hx + hy * hy + hz * hz), fx = hx / l, fy = hy / l, fz = hz / l, nl = (float) Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
        float sx = n[0] / nl, sy = n[1] / nl, sz = n[2] / nl, ux = fy * sz - fz * sy, uy = fz * sx - fx * sz, uz = fx * sy - fy * sx, r = 0.75f; float[] o = inner; int ga = alpha(a * 0.55) | 0xFFFFFF;
        for (int k = 0; k <= 8; k++) { double ang = k * Math.PI / 4; float c = (float) Math.cos(ang) * r, s = (float) Math.sin(ang) * r; o[k * 3] = hx + sx * c + ux * s; o[k * 3 + 1] = hy + sy * c + uy * s; o[k * 3 + 2] = hz + sz * c + uz * s; }
        for (int k = 0; k < 8; k += 2) quad(hx, hy, hz, ga, o[k * 3], o[k * 3 + 1], o[k * 3 + 2], edge, o[k * 3 + 3], o[k * 3 + 4], o[k * 3 + 5], edge, o[k * 3 + 6], o[k * 3 + 7], o[k * 3 + 8], edge);
    }
    /**
     * Soft puff (nebula or cloud): a rounded falloff (inner ring at 72% alpha halfway out, transparent rim) on an irregular
     * outline that turns slowly with time. lo/hi colour the bottom/top of the inner ring (clouds are lit from above),
     * mid is the centre. Sizes in sky units (elevation 1 = 90 degrees). BLOB_QUADS quads.
     */
    void blob(double az, double el, double radius, double sx, double sy, int lo, int mid, int hi, double a, float dist, int id, double t, double wobble) {
        if (a < 0.004) return;
        double e = el * Math.PI / 2, r = radius * Math.PI / 2, ce0 = Math.max(0.2, Math.cos(e)), ph1 = SkyFx.u(5151, id, 0) * 6.283 + t * 0.03, ph2 = SkyFx.u(5151, id, 1) * 6.283 - t * 0.02;
        int ca = alpha(a) | mid, ia = alpha(a * 0.72);
        float[] c = dir(az, e, p[0], dist); float cx = c[0], cy = c[1], cz = c[2];
        for (int s = 0; s <= BLOB_SIDES; s++) {
            double th = s * Math.PI * 2 / BLOB_SIDES, shape = 1 + wobble * Math.sin(2 * th + ph1) + wobble * 0.55 * Math.sin(3 * th + ph2), ct = Math.cos(th) * shape, st = Math.sin(th) * shape;
            float[] q = dir(az + ct * r * sx / ce0, e + st * r * sy, p[1], dist); outer[s * 3] = q[0]; outer[s * 3 + 1] = q[1]; outer[s * 3 + 2] = q[2];
            q = dir(az + ct * 0.5 * r * sx / ce0, e + st * 0.5 * r * sy, p[1], dist); inner[s * 3] = q[0]; inner[s * 3 + 1] = q[1]; inner[s * 3 + 2] = q[2];
            innerCol[s] = Sky.mix(lo, hi, 0.5 + 0.5 * Math.sin(th));
        }
        for (int s = 0; s < BLOB_SIDES; s += 2)
            quad(cx, cy, cz, ca, inner[s * 3], inner[s * 3 + 1], inner[s * 3 + 2], ia | innerCol[s], inner[s * 3 + 3], inner[s * 3 + 4], inner[s * 3 + 5], ia | innerCol[s + 1], inner[s * 3 + 6], inner[s * 3 + 7], inner[s * 3 + 8], ia | innerCol[s + 2]);
        for (int s = 0; s < BLOB_SIDES; s++)
            quad(inner[s * 3], inner[s * 3 + 1], inner[s * 3 + 2], ia | innerCol[s], outer[s * 3], outer[s * 3 + 1], outer[s * 3 + 2], innerCol[s], outer[s * 3 + 3], outer[s * 3 + 4], outer[s * 3 + 5], innerCol[s + 1],
                inner[s * 3 + 3], inner[s * 3 + 4], inner[s * 3 + 5], ia | innerCol[s + 1]);
    }
    /** A petal: a small spinning diamond closer than the sky, so it reads as falling in front of it. */
    void petal(double az, double el, double spin, int argb) {
        double e = el * Math.PI / 2, s = 0.5, cs = Math.cos(spin) * s, sn = Math.sin(spin) * s * (0.5 + 0.5 * Math.abs(Math.sin(spin * 0.7)));
        float[] c = dir(az, e, p[0], PETALS), a1 = dir(az + cs / 60, e + sn / 60, p[1], PETALS), a2 = dir(az - cs / 60, e - sn / 60, p[2], PETALS), b1 = dir(az - sn * 0.5 / 60, e + cs * 0.5 / 60, p[3], PETALS);
        float bx = 2 * c[0] - b1[0], by = 2 * c[1] - b1[1], bz = 2 * c[2] - b1[2];
        quad(a1[0], a1[1], a1[2], argb, b1[0], b1[1], b1[2], argb, a2[0], a2[1], a2[2], argb, bx, by, bz, argb);
    }

    /**
     * Aurora curtain ri on layer l following SkyFx.auroraWave: per column a soft fade under the lower edge, a bright edge,
     * then a long fade upward toward the next aurora colour. Slow vertical rays vary each column's brightness and height.
     */
    void ribbon(Sky.Theme t, int ri, int layer, double sec, double night) {
        int[] cs = t.auroraColors(); int rgb = Sky.adjust(cs[ri], adjust), next = Sky.adjust(cs[(ri + 1) % cs.length], adjust);
        int edge = Sky.mix(rgb, 0xFFFFFF, 0.2), top = Sky.mix(rgb, next, 0.55), steps = auroraSteps;
        double base = t.auroraStrength() * night * 150, h = (0.18 - layer * 0.03) * 1.3, sp = t.auroraSpeed();
        column(t, ri, layer, sec, 0, base, h, sp, 0);
        for (int s = 1; s <= steps; s++) {
            column(t, ri, layer, sec, s * Math.PI * 2 / steps, base, h, sp, 4);
            int a0 = (int) colPrev[0], a1 = (int) colCur[0], m0 = (int) colPrev[1], m1 = (int) colCur[1];
            quad(pc[0][0], pc[0][1], pc[0][2], rgb, pc[4][0], pc[4][1], pc[4][2], rgb, pc[5][0], pc[5][1], pc[5][2], (a1 << 24) | edge, pc[1][0], pc[1][1], pc[1][2], (a0 << 24) | edge);
            quad(pc[1][0], pc[1][1], pc[1][2], (a0 << 24) | edge, pc[5][0], pc[5][1], pc[5][2], (a1 << 24) | edge, pc[6][0], pc[6][1], pc[6][2], (m1 << 24) | rgb, pc[2][0], pc[2][1], pc[2][2], (m0 << 24) | rgb);
            quad(pc[2][0], pc[2][1], pc[2][2], (m0 << 24) | rgb, pc[6][0], pc[6][1], pc[6][2], (m1 << 24) | rgb, pc[7][0], pc[7][1], pc[7][2], top, pc[3][0], pc[3][1], pc[3][2], top);
            for (int k = 0; k < 4; k++) { float[] sw = pc[k]; pc[k] = pc[k + 4]; pc[k + 4] = sw; }
            colPrev[0] = colCur[0]; colPrev[1] = colCur[1];
        }
    }
    /** One aurora column at azimuth az into pc[at..at+3] (under-edge, edge, middle, top) and its edge/middle alpha. */
    void column(Sky.Theme t, int ri, int layer, double sec, double az, double base, double h, double sp, int at) {
        double ray = 0.6 * (0.5 + 0.5 * Math.sin(az * 17 + ri * 2.3 + layer * 1.1 + sec * 0.11 * sp + 0.8 * Math.sin(az * 4 - sec * 0.07 * sp + ri)))
            + 0.4 * (0.5 + 0.5 * Math.sin(az * 29 - sec * 0.17 * sp + ri * 1.3 + layer));
        double e = SkyFx.auroraWave(az, sec, ri, layer, t.auroraHeight(), sp, waves), a = Math.min(255, base * SkyFx.auroraShimmer(az, sec, ri, layer, sp) * (0.35 + 0.65 * ray * Math.sqrt(ray))), hh = h * (0.8 + 0.45 * ray);
        double[] out = at == 0 ? colPrev : colCur; out[0] = a; out[1] = a * 0.55;
        double q = Math.PI / 2; dir(az, (e - 0.02) * q, pc[at], AURORA); dir(az, e * q, pc[at + 1], AURORA); dir(az, (e + hh * 0.3) * q, pc[at + 2], AURORA); dir(az, (e + hh) * q, pc[at + 3], AURORA);
    }
    static float[] dir(double az, double el, float[] out, double dist) { out[0] = (float) (Math.cos(el) * Math.cos(az) * dist); out[1] = (float) (Math.sin(el) * dist); out[2] = (float) (Math.cos(el) * Math.sin(az) * dist); return out; }
}
