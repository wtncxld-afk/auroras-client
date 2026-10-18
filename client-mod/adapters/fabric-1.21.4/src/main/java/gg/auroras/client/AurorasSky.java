package gg.auroras.client;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Written against Fabric API's DimensionRenderingRegistry and the 1.21.2+ rendering
// API (Tessellator/BufferBuilder, ShaderProgramKeys) without access to those jars. Expect small API fixes on first build.
//
// Uses Fabric API's sky hook rather than a mixin, so other mods' sky renderers win if they register for the same dimension.
// The hook replaces the sky for the whole session, so turning Custom Skies on or off takes effect after a restart (the
// launcher says so). Themes and settings are re-read whenever the profile changes.
//
// Animated effects (shooting stars, nebula drift, clouds, petals, constellations, layered aurora) come from core SkyFx:
// pure functions of (seed, index, time), the same ones the launcher preview draws, so nothing is simulated per frame.
// Per frame: dome ring colors and effect positions are written into arrays allocated once; geometry is precomputed in
// core (Sky.Dome, Sky.StarField, SkyFx.Constellations). How much is drawn follows the sky quality budget.

import com.mojang.blaze3d.systems.RenderSystem;
import gg.auroras.core.*;
import net.fabricmc.fabric.api.client.rendering.v1.DimensionRenderingRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderContext;
import net.minecraft.client.gl.ShaderProgramKeys;
import net.minecraft.client.render.*;
import net.minecraft.registry.RegistryKey;
import net.minecraft.world.World;
import org.joml.Matrix4f;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public final class AurorasSky {
    private AurorasSky() {}
    static Map<String, Sky.Theme> themes;
    static int seen = -1; static Sky.Adjust adjust = Sky.Adjust.NONE; static Sky.Dome dome; static Sky.StarField stars; static SkyFx.Constellations cons;
    static String overworld, nether, end; static double starBrightness, twinkle, animSpeed, opacity, meteorMul, nebulaSpeed, waves;
    static boolean aurora, nebula, animate, clouds, petals, constellations; static Quality quality = Quality.BALANCED; static SkyFx.Budget budget = SkyFx.budget(Quality.BALANCED);
    static int[] ringColor; static final double STAR_DIST = 100; static final long START = System.nanoTime();
    static final float[] MET = new float[SkyFx.METEOR_FIELDS * 4], O4 = new float[4]; static final float[][] P = new float[4][3];

    /** Called once at startup. Registers only for dimensions that have a theme, and only when the module is on. */
    static void register() {
        if (!AurorasClient.PM.enabled("sky")) return;
        try (InputStream in = AurorasSky.class.getResourceAsStream("/assets/auroras_client/themes.json")) {
            themes = Sky.load(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        } catch (Exception e) { System.out.println("[Auroras] sky themes couldn't be loaded, keeping the vanilla sky: " + e.getMessage()); return; }
        refresh();
        reg(World.OVERWORLD, "minecraft:overworld");
        if (!"off".equals(nether)) reg(World.NETHER, "minecraft:the_nether");
        if (!"off".equals(end)) reg(World.END, "minecraft:the_end");
    }
    static void reg(RegistryKey<World> key, String dim) { DimensionRenderingRegistry.registerSkyRenderer(key, ctx -> render(ctx, dim)); }

    static void refresh() {
        Config.ProfileManager pm = AurorasClient.PM; if (pm.revision() == seen) return; seen = pm.revision();
        overworld = pm.get("sky.theme"); nether = pm.get("sky.netherTheme"); end = pm.get("sky.endTheme");
        adjust = new Sky.Adjust(d("sky.brightness"), d("sky.saturation"), d("sky.contrast"), Integer.parseInt(pm.get("sky.tint"), 16), d("sky.tintStrength"));
        Quality global = Quality.parse(pm.get(Config.Registry.QUALITY));
        quality = SkyFx.skyQuality(pm.get("sky.skyQuality"), global); budget = SkyFx.budget(quality);
        dome = new Sky.Dome(quality.domeRings, 32); ringColor = new int[dome.rings + 1];
        Sky.Theme t = themes.get(overworld);
        stars = new Sky.StarField(1337, d("sky.starDensity") * t.starDensity() * quality.starMultiplier, d("sky.starSize") * t.starSize());
        cons = new SkyFx.Constellations(stars, 4242, 8);
        starBrightness = d("sky.starBrightness") * t.starBrightness(); twinkle = d("sky.twinkleSpeed");
        aurora = b("sky.aurora") && quality.aurora; nebula = b("sky.nebula") && quality.nebula; animate = b("sky.animate");
        animSpeed = d("sky.animSpeed"); opacity = d("sky.effectsOpacity"); meteorMul = d("sky.shootingStars"); nebulaSpeed = d("sky.nebulaSpeed"); waves = d("sky.auroraWaves");
        clouds = b("sky.clouds"); petals = b("sky.petals"); constellations = b("sky.constellations");
    }
    static double d(String k) { return Double.parseDouble(AurorasClient.PM.get(k)); }
    static boolean b(String k) { return "true".equals(AurorasClient.PM.get(k)); }

    static void render(WorldRenderContext ctx, String dim) {
        refresh();
        String id = Sky.themeFor(dim, overworld, nether, end); if (id == null) return;
        Sky.Theme t = themes.get(id); if (t == null) return; SkyFx.Fx fx = t.fx();
        long ticks = ctx.world().getTimeOfDay(); double night = Sky.nightAmount(ticks), day = Sky.daylight(ticks);
        double clk = SkyFx.clock((System.nanoTime() - START) / 1e9, animSpeed, animate);
        Matrix4f m = ctx.positionMatrix();
        for (int r = 0; r <= dome.rings; r++) ringColor[r] = Sky.skyColor(t, r / (double) dome.rings, ticks, adjust);

        RenderSystem.depthMask(false); RenderSystem.enableBlend(); RenderSystem.defaultBlendFunc(); RenderSystem.setShader(ShaderProgramKeys.POSITION_COLOR);
        Tessellator tess = Tessellator.getInstance();
        BufferBuilder b = tess.begin(VertexFormat.DrawMode.TRIANGLES, VertexFormats.POSITION_COLOR);
        int segs = dome.segments + 1;
        for (int r = 0; r < dome.rings; r++) for (int s = 0; s < dome.segments; s++) {
            int a = r * segs + s, bb = a + 1, c = a + segs, dd = c + 1;
            tri(b, m, a, bb, c, ringColor[r], ringColor[r], ringColor[r + 1]); tri(b, m, bb, dd, c, ringColor[r], ringColor[r + 1], ringColor[r + 1]);
        }
        // ground below the horizon so the dome never shows the void
        int g = Sky.adjust(t.ground(), adjust);
        for (int s = 0; s < dome.segments; s++) quadDown(b, m, s, s + 1, g);

        if (nebula && t.nebula() && t.nebulaColors().length > 0 && night > 0.01) {
            double drift = fx.nebulaDrift() * nebulaSpeed;
            for (int k = 0; k < budget.nebulaBlobs(); k++) { SkyFx.nebula(77, k, clk, drift, O4); blob(b, m, O4[0], O4[1], O4[2], 1, 1, Sky.adjust(t.nebulaColors()[k % t.nebulaColors().length], adjust), O4[3] * night * opacity, 92); }
        }
        int tint = Sky.adjust(t.starTint(), adjust);
        if (night > 0.01) {
            for (int k = 0; k < stars.count; k++) {
                if (stars.y[k] < 0.02f) continue; double br = stars.brightness(k, clk, twinkle, starBrightness, night); if (br < 0.02) continue;
                star(b, m, stars.x[k], stars.y[k], stars.z[k], stars.size[k], ((int) (br * 255) << 24) | tint);
            }
            if (constellations && fx.constellations()) for (int p = 0; p < cons.groupOf.length; p++) {
                if (cons.groupOf[p] >= budget.constellationGroups()) continue; int a = cons.pairs[p * 2], c = cons.pairs[p * 2 + 1];
                line(b, m, stars.x[a] * 99, stars.y[a] * 99, stars.z[a] * 99, stars.x[c] * 99, stars.y[c] * 99, stars.z[c] * 99, 0.12f, alpha(SkyFx.Constellations.alpha(cons.groupOf[p], clk, night) * opacity) | tint, alpha(SkyFx.Constellations.alpha(cons.groupOf[p], clk, night) * opacity) | tint);
            }
            int n = night > 0.15 && animate ? SkyFx.meteors(99, fx.meteorsPerMinute() * meteorMul, clk, budget.meteors(), MET) : 0;
            for (int k = 0; k < n; k++) {
                int o = k * SkyFx.METEOR_FIELDS; double el = MET[o + 1] * Math.PI / 2, tel = (MET[o + 1] - MET[o + 3] * 0.45) * Math.PI / 2;
                float[] h = dir(MET[o], el, P[0], 98), tl = dir(MET[o] - MET[o + 2] * 0.45, tel, P[1], 98);
                line(b, m, h[0], h[1], h[2], tl[0], tl[1], tl[2], 0.22f, alpha(MET[o + 5] * night * opacity) | 0xFFFFFF, tint);
            }
        }
        int layers = Math.min(fx.auroraLayers(), budget.auroraLayers());
        if (aurora && t.aurora() && night > 0.01) for (int l = layers - 1; l >= 0; l--) for (int ri = 0; ri < t.auroraColors().length; ri++) auroraRibbon(b, m, t, ri, l, clk, night);
        if (clouds && fx.clouds() > 0) for (int k = 0; k < budget.cloudPuffs(); k++) {
            SkyFx.cloud(17, k, clk, O4); int c = SkyFx.cloudColor(Sky.adjust(fx.cloudColor(), adjust), Sky.skyColor(t, O4[1], ticks, adjust), day);
            blob(b, m, O4[0], O4[1], O4[2], 1.8, 0.55, c, O4[3] * fx.clouds() * opacity, 90);
        }
        if (petals && fx.petals() > 0) {
            int c = Sky.adjust(fx.petalColor(), adjust), cnt = (int) Math.round(budget.petals() * fx.petals());
            for (int k = 0; k < cnt; k++) { SkyFx.petal(31, k, clk, O4); petal(b, m, O4[0], O4[1], O4[2], alpha(O4[3] * opacity) | c); }
        }
        BuiltBuffer built = b.endNullable(); if (built != null) BufferRenderer.drawWithGlobalProgram(built);
        RenderSystem.disableBlend(); RenderSystem.depthMask(true);
    }
    static int alpha(double a) { return (int) Math.round(Sky.clamp(a, 0, 1) * 255) << 24; }
    static void v(BufferBuilder b, Matrix4f m, int vi, int rgb, int alpha) { b.vertex(m, dome.pos[vi * 3] * 100, dome.pos[vi * 3 + 1] * 100, dome.pos[vi * 3 + 2] * 100).color((alpha << 24) | rgb); }
    static void tri(BufferBuilder b, Matrix4f m, int i, int j, int k, int ci, int cj, int ck) { v(b, m, i, ci, 255); v(b, m, j, cj, 255); v(b, m, k, ck, 255); }
    static void quadDown(BufferBuilder b, Matrix4f m, int i, int j, int rgb) {
        float xi = dome.pos[i * 3] * 100, zi = dome.pos[i * 3 + 2] * 100, xj = dome.pos[j * 3] * 100, zj = dome.pos[j * 3 + 2] * 100; int c = 0xFF000000 | rgb;
        b.vertex(m, xi, 0, zi).color(c); b.vertex(m, xj, 0, zj).color(c); b.vertex(m, 0, -100, 0).color(c);
    }
    static void star(BufferBuilder b, Matrix4f m, float x, float y, float z, float size, int argb) {
        float px = x * (float) STAR_DIST, py = y * (float) STAR_DIST, pz = z * (float) STAR_DIST, s = size;
        // small square facing the centre: two tangent vectors from the star direction
        float tx = -z, tz = x, tl = (float) Math.sqrt(tx * tx + tz * tz); if (tl < 1e-4f) { tx = 1; tz = 0; tl = 1; } tx = tx / tl * s; tz = tz / tl * s; float ux = -y * x, uy = x * x + z * z, uz = -y * z, ul = (float) Math.sqrt(ux * ux + uy * uy + uz * uz); ux = ux / ul * s; uy = uy / ul * s; uz = uz / ul * s;
        b.vertex(m, px - tx - ux, py - uy, pz - tz - uz).color(argb); b.vertex(m, px + tx - ux, py - uy, pz + tz - uz).color(argb); b.vertex(m, px + tx + ux, py + uy, pz + tz + uz).color(argb);
        b.vertex(m, px - tx - ux, py - uy, pz - tz - uz).color(argb); b.vertex(m, px + tx + ux, py + uy, pz + tz + uz).color(argb); b.vertex(m, px - tx + ux, py + uy, pz - tz + uz).color(argb);
    }
    /** A thin quad from a to c, widened sideways (perpendicular to the line and the view direction), colors ca at a and cc at c. */
    static void line(BufferBuilder b, Matrix4f m, float ax, float ay, float az, float cx, float cy, float cz, float w, int ca, int cc) {
        float dx = cx - ax, dy = cy - ay, dz = cz - az, nx = dy * az - dz * ay, ny = dz * ax - dx * az, nz = dx * ay - dy * ax, nl = (float) Math.sqrt(nx * nx + ny * ny + nz * nz); if (nl < 1e-5f) return;
        nx = nx / nl * w; ny = ny / nl * w; nz = nz / nl * w;
        b.vertex(m, ax - nx, ay - ny, az - nz).color(ca); b.vertex(m, ax + nx, ay + ny, az + nz).color(ca); b.vertex(m, cx + nx, cy + ny, cz + nz).color(cc);
        b.vertex(m, ax - nx, ay - ny, az - nz).color(ca); b.vertex(m, cx + nx, cy + ny, cz + nz).color(cc); b.vertex(m, cx - nx, cy - ny, cz - nz).color(cc);
    }
    /** Soft round glow: a fan bright in the middle and transparent at the rim. Sizes are in sky units (elevation 1 = 90°). */
    static void blob(BufferBuilder b, Matrix4f m, double az, double el, double radius, double sx, double sy, int rgb, double a, double dist) {
        int ca = alpha(a) | rgb, ce = rgb; double e = el * Math.PI / 2, r = radius * Math.PI / 2, ce0 = Math.max(0.2, Math.cos(e)); float[] c = dir(az, e, P[0], dist); final int N = 12;
        for (int s = 0; s < N; s++) {
            double t0 = s * Math.PI * 2 / N, t1 = (s + 1) * Math.PI * 2 / N;
            float[] p0 = dir(az + Math.cos(t0) * r * sx / ce0, e + Math.sin(t0) * r * sy, P[1], dist), p1 = dir(az + Math.cos(t1) * r * sx / ce0, e + Math.sin(t1) * r * sy, P[2], dist);
            b.vertex(m, c[0], c[1], c[2]).color(ca); b.vertex(m, p0[0], p0[1], p0[2]).color(ce); b.vertex(m, p1[0], p1[1], p1[2]).color(ce);
        }
    }
    /** A petal: a small spinning diamond closer than the sky, so it reads as falling in front of it. */
    static void petal(BufferBuilder b, Matrix4f m, double az, double el, double spin, int argb) {
        double e = el * Math.PI / 2, s = 0.5, cs = Math.cos(spin) * s, sn = Math.sin(spin) * s * (0.5 + 0.5 * Math.abs(Math.sin(spin * 0.7)));
        float[] c = dir(az, e, P[0], 60), a1 = dir(az + cs / 60, e + sn / 60, P[1], 60), a2 = dir(az - cs / 60, e - sn / 60, P[2], 60), b1 = dir(az - sn * 0.5 / 60, e + cs * 0.5 / 60, P[3], 60);
        b.vertex(m, a1[0], a1[1], a1[2]).color(argb); b.vertex(m, b1[0], b1[1], b1[2]).color(argb); b.vertex(m, a2[0], a2[1], a2[2]).color(argb);
        float bx = 2 * c[0] - b1[0], by = 2 * c[1] - b1[1], bz = 2 * c[2] - b1[2];
        b.vertex(m, a1[0], a1[1], a1[2]).color(argb); b.vertex(m, a2[0], a2[1], a2[2]).color(argb); b.vertex(m, bx, by, bz).color(argb);
    }
    static void auroraRibbon(BufferBuilder b, Matrix4f m, Sky.Theme t, int ri, int layer, double sec, double night) {
        int rgb = Sky.adjust(t.auroraColors()[ri], adjust), steps = budget.ribbonSteps(); double base = t.auroraStrength() * night * 140, h = 0.18 - layer * 0.03;
        for (int s = 0; s < steps; s++) {
            double a0 = s * Math.PI * 2 / steps, a1 = (s + 1) * Math.PI * 2 / steps;
            double e0 = SkyFx.auroraWave(a0, sec, ri, layer, t.auroraHeight(), t.auroraSpeed(), waves) * Math.PI / 2, e1 = SkyFx.auroraWave(a1, sec, ri, layer, t.auroraHeight(), t.auroraSpeed(), waves) * Math.PI / 2;
            int top0 = (int) Math.min(255, base * SkyFx.auroraShimmer(a0, sec, ri, layer, t.auroraSpeed())) << 24, top1 = (int) Math.min(255, base * SkyFx.auroraShimmer(a1, sec, ri, layer, t.auroraSpeed())) << 24;
            float[] p0 = dir(a0, e0, P[0], 95), p1 = dir(a1, e1, P[1], 95), q0 = dir(a0, e0 + h, P[2], 95), q1 = dir(a1, e1 + h, P[3], 95);
            b.vertex(m, p0[0], p0[1], p0[2]).color(top0 | rgb); b.vertex(m, p1[0], p1[1], p1[2]).color(top1 | rgb); b.vertex(m, q1[0], q1[1], q1[2]).color(rgb);
            b.vertex(m, p0[0], p0[1], p0[2]).color(top0 | rgb); b.vertex(m, q1[0], q1[1], q1[2]).color(rgb); b.vertex(m, q0[0], q0[1], q0[2]).color(rgb);
        }
    }
    static float[] dir(double az, double el, float[] out, double dist) { out[0] = (float) (Math.cos(el) * Math.cos(az) * dist); out[1] = (float) (Math.sin(el) * dist); out[2] = (float) (Math.cos(el) * Math.sin(az) * dist); return out; }
}
