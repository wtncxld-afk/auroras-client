package gg.auroras.core;

import java.nio.file.*;
import java.util.*;

/** Rules behind the player, rendering, information and cosmetic modules (GameLogic). Run: java -cp out gg.auroras.core.ModuleTests ../../visuals */
public class ModuleTests {
    static int pass, fail;
    static boolean sane(Calc.Zoom z) { z.frame(false, 10); return z.fovMultiplier() <= 1 && z.fovMultiplier() > 0; }
    static void check(String n, boolean ok, Object... info) { if (ok) pass++; else fail++; System.out.println((ok ? "PASS  " : "FAIL  ") + n + (ok || info.length == 0 ? "" : "  " + Arrays.toString(info))); }

    public static void main(String[] a) throws Exception {
        Path dir = Path.of(a.length > 0 ? a[0] : "../../visuals");
        Config.Registry reg = new Config.Registry();
        // direction
        check("direction: Minecraft yaw maps to compass headings (yaw 0 faces south, 90 west, 180 north, -90 east)", GameLogic.heading(0) == 180 && GameLogic.heading(90) == 270 && GameLogic.heading(180) == 0 && GameLogic.heading(-90) == 90 && GameLogic.heading(-180) == 0, GameLogic.heading(0), GameLogic.heading(90), GameLogic.heading(180), GameLogic.heading(-90));
        check("direction: letters and degrees agree", GameLogic.direction(180, true).equals("N  0°") && GameLogic.direction(-90, false).equals("E") && GameLogic.direction(45, true).equals("SW  225°"), GameLogic.direction(180, true), GameLogic.direction(45, true));
        String strip = GameLogic.compassStrip(180, 7);
        check("direction: the compass strip is centred on where you face", strip.equals("NW · · N · · NE"), strip);
        check("direction: the strip has the requested width whatever the heading", List.of(0f, 37f, -123f, 359f).stream().allMatch(y -> GameLogic.compassStrip(y, 9).split(" ").length == 9));
        // information
        check("memory: percent, megabytes and an optional bar", GameLogic.memory(512L << 20, 2048L << 20, false).equals("Memory 25%  512 / 2048 MB") && GameLogic.memory(512L << 20, 2048L << 20, true).endsWith("███░░░░░░░") && GameLogic.memory(0, 0, false).startsWith("Memory 0%"), GameLogic.memory(512L << 20, 2048L << 20, true));
        check("biome: ids become readable names; modded biomes keep their namespace", GameLogic.biomeName("minecraft:dark_forest").equals("Dark Forest") && GameLogic.biomeName("terralith:alpine/high_peaks").equals("Alpine High Peaks (terralith)") && GameLogic.biomeName(null).equals("Unknown biome"));
        check("biome: dimension names", GameLogic.biome("minecraft:plains", "minecraft:the_nether", true).equals("Plains · Nether") && GameLogic.biome("minecraft:plains", "minecraft:overworld", false).equals("Plains") && GameLogic.dimensionName("minecraft:the_end").equals("End"));
        check("server info: shows only what the game reported", GameLogic.serverInfo("play.example.net", 12, 48, "1.21.4", true, true, true, true).equals(List.of("play.example.net", "12 players · 48 ms · 1.21.4")) && GameLogic.serverInfo("a.b", -1, 0, null, true, true, true, true).equals(List.of("a.b")) && GameLogic.serverInfo("a.b", 1, 5, "x", false, true, false, false).equals(List.of("1 player")));
        check("server info: singleplayer says so; hiding everything still shows a label", GameLogic.serverInfo(null, 3, 3, "x", true, true, true, true).equals(List.of("Singleplayer")) && GameLogic.serverInfo("a.b", 3, 3, "x", false, false, false, false).equals(List.of("Multiplayer")));
        // frame graph
        GameLogic.FrameGraph g = new GameLogic.FrameGraph(64); int[] hs = new int[64];
        for (double ms : new double[]{10, 25, 50, 100}) g.add(ms);
        int n = g.heights(64, 20, hs);
        check("frame graph: bars are oldest first and 50 ms fills the graph (longer frames are capped)", n == 4 && hs[0] == 4 && hs[1] == 10 && hs[2] == 20 && hs[3] == 20 && g.worst(64) == 100, n, Arrays.toString(Arrays.copyOf(hs, 4)));
        for (int k = 0; k < 200; k++) g.add(16); n = g.heights(32, 20, hs);
        check("frame graph: the ring keeps only the newest frames", n == 32 && g.count() == 64 && g.worst(64) == 16 && Arrays.stream(hs, 0, 32).allMatch(v -> v == 6));
        check("frame graph: colors mark 60 fps, 30 fps and slower", GameLogic.FrameGraph.color(6, 20) == 0x6FCF97 && GameLogic.FrameGraph.color(10, 20) == 0xE0B45A && GameLogic.FrameGraph.color(18, 20) == 0xE57373);
        long before = alloc(); for (int k = 0; k < 200_000; k++) { g.add(k % 40); g.heights(64, 20, hs); } long used = alloc() - before;
        check("frame graph: adding and reading frames allocates nothing", used < 64 * 1024, used);
        // session
        GameLogic.Session s = new GameLogic.Session(); s.start(1000);
        s.move(0, 64, 0); s.move(3, 64, 4); s.move(3, 64, 104); s.move(3, 64, 109); s.blockBroken(); s.blockBroken();
        s.health(20); s.health(0); s.health(0); s.health(20); s.health(0);
        check("session: walking distance ignores teleports; deaths count once each", Math.round(s.distance) == 10 && s.blocks == 2 && s.deaths == 2, s.distance, s.deaths);
        check("session: lines follow the settings", s.lines(1000 + 3_725_000, true, true, true, true).equals(List.of("Session 1:02:05", "Walked 10 m", "Blocks broken 2", "Deaths 2")) && s.lines(0, false, false, false, false).equals(List.of("Session")));
        s.distance = 2345; check("session: long walks switch to kilometres", s.lines(1000, false, true, false, false).get(0).equals("Walked 2.3 km") || s.lines(1000, false, true, false, false).get(0).equals("Walked 2,3 km"), s.lines(1000, false, true, false, false));
        s.start(5000); check("session: joining a world restarts it", s.distance == 0 && s.blocks == 0 && s.deaths == 0 && s.startMs == 5000);
        // player
        GameLogic.Toggle t = new GameLogic.Toggle();
        check("toggle sneak: press turns it on, holding doesn't flip, second press turns it off", !t.update(false) && t.update(true) && t.update(true) && t.update(false) && !t.update(true) && !t.update(false));
        check("zoom scroll: scrolling changes the factor within the setting's range", GameLogic.zoomScroll(4, 1) == 4.6 && GameLogic.zoomScroll(4, -1) == 3.48 && GameLogic.zoomScroll(10, 3) == 10 && GameLogic.zoomScroll(1.1, -5) == 1.1);
        Calc.Zoom z = new Calc.Zoom(4, 1); z.tick(true); z.setFactor(GameLogic.zoomScroll(z.factor(), 1)); z.tick(true);
        check("zoom scroll: the FOV follows the new factor while held and still restores exactly on release", Math.abs(z.fovMultiplier() - 1 / 4.6) < 1e-9 && run(() -> { z.tick(false); }) && z.fovMultiplier() == 1.0);
        GameLogic.Freelook f = new GameLogic.Freelook();
        f.key(true, "hold", 30, 10); f.look(100, 0, 1); f.look(0, 1000, 1);
        check("freelook (hold): starts from where you face, turns the camera, clamps pitch", f.active && Math.abs(f.yaw - 45) < 1e-4 && f.pitch == 90, f.yaw, f.pitch);
        check("freelook (hold): releasing ends it", !f.key(false, "hold", 30, 10));
        GameLogic.Freelook ft = new GameLogic.Freelook();
        boolean on1 = ft.key(true, "toggle", 0, 0), held = ft.key(true, "toggle", 0, 0), up = ft.key(false, "toggle", 0, 0), off = ft.key(true, "toggle", 0, 0);
        check("freelook (toggle): press on, stays on when released, next press off", on1 && held && up && !off);
        check("perspective: cycles first person, back, front; skip front goes back to first person", GameLogic.nextPerspective(0, false) == 1 && GameLogic.nextPerspective(1, false) == 2 && GameLogic.nextPerspective(2, false) == 0 && GameLogic.nextPerspective(1, true) == 0);
        // crosshair
        List<int[]> cross = GameLogic.crosshair("cross", 5, 1, 2, false, 0);
        check("crosshair: cross has four arms around the gap, symmetric", cross.size() == 4 && cross.get(0)[0] == -7 && cross.get(0)[2] == 5 && cross.get(1)[0] == 3 && cross.get(2)[1] == -7 && cross.get(3)[1] == 3, Arrays.toString(cross.get(0)), Arrays.toString(cross.get(1)));
        List<int[]> wide = GameLogic.crosshair("cross", 5, 1, 2, false, 1);
        check("crosshair: dynamic spread widens the gap", wide.get(1)[0] == cross.get(1)[0] + 4);
        check("crosshair: dot, circle and square styles, and a centre dot", GameLogic.crosshair("dot", 5, 2, 2, false, 0).size() == 1 && GameLogic.crosshair("circle", 6, 1, 2, false, 0).size() == 8 && GameLogic.crosshair("square", 5, 1, 2, false, 0).size() == 4 && GameLogic.crosshair("cross", 5, 1, 2, true, 0).size() == 5 && GameLogic.crosshair("dot", 5, 2, 2, true, 0).size() == 1);
        check("crosshair: every piece has size and the outline is one pixel larger all round", GameLogic.crosshair("square", 5, 2, 2, true, 0).stream().allMatch(p -> p[2] > 0 && p[3] > 0) && Arrays.equals(GameLogic.outline(List.of(new int[]{-3, -1, 6, 2})).get(0), new int[]{-4, -2, 8, 4}));
        // rendering
        check("low fire: full height leaves the overlay alone, lower settings push it down", GameLogic.fireOffset(1) == 0 && GameLogic.fireOffset(0) == 0.3 && Math.abs(GameLogic.fireOffset(0.5) - 0.15) < 1e-9);
        GameLogic.ParticleFilter pf = new GameLogic.ParticleFilter(); pf.multiplier = 0.25; int kept = 0; for (int k = 0; k < 400; k++) if (pf.keep("minecraft:flame")) kept++;
        check("particles: the multiplier keeps that share of particles, evenly", kept == 100, kept);
        pf.multiplier = 1; pf.hidden.addAll(GameLogic.ParticleFilter.hiddenTypes(true, true, false));
        check("particles: hidden types are dropped, others kept", !pf.keep("minecraft:explosion") && !pf.keep("minecraft:block") && pf.keep("minecraft:rain") && pf.keep("minecraft:flame"));
        check("fullbright: brightness scales with the level", GameLogic.fullbrightGamma(1) == 16f && GameLogic.fullbrightGamma(0) == 1f && GameLogic.fullbrightGamma(5) == 16f);
        check("hit color: color and opacity pack into ARGB (vanilla red at 70% matches the game's 0xB2FF0000)", GameLogic.hitColor(0xFF0000, 70) == 0xB2FF0000 && GameLogic.hitColor(0x00FF00, 100) == 0xFF00FF00 && GameLogic.hitColor(0x123456, 0) == 0x00123456);
        check("boss bar: hidden returns nothing; scale is clamped", GameLogic.bossBar(true, 1, 0) == null && GameLogic.bossBar(false, 3, 10)[0] == 1.5 && GameLogic.bossBar(false, 1, 10)[1] == 10);
        // cosmetics
        GameLogic.TotemFx fx = new GameLogic.TotemFx(); fx.density = 1; fx.duration = 1.5; fx.overlay = true;
        check("totem effects: nothing happens before a totem pops", fx.update(0.05) == 0 && !fx.active() && fx.overlayAlpha() == 0);
        fx.pop(); double a0 = -1; int total = 0; boolean fading = true;
        for (int k = 0; k < 100; k++) { total += fx.update(0.05); double al = fx.overlayAlpha(); if (a0 >= 0 && al > a0 + 1e-12) fading = false; a0 = al; }
        check("totem effects: spawns the configured particle count over the duration, then stops", total == 40 && !fx.active(), total);
        GameLogic.TotemFx fx2 = new GameLogic.TotemFx(); fx2.overlay = true; fx2.pop(); fx2.update(0.0001); double first = fx2.overlayAlpha();
        check("totem effects: the overlay starts at its intensity and fades out", Math.abs(first - 0.4) < 0.001 && fading && a0 == 0, first);
        GameLogic.TotemFx fx3 = new GameLogic.TotemFx(); fx3.density = 2; fx3.pop(); int t3 = 0; for (int k = 0; k < 7; k++) t3 += fx3.update(0.3);
        check("totem effects: density scales the count and large steps don't lose particles", t3 == 80, t3);
        check("menu animation: speed shortens or lengthens transitions; reduced motion skips them", GameLogic.animTau(0.1, 2, false) == 0.05 && GameLogic.animTau(0.1, 0.5, false) == 0.2 && GameLogic.animTau(0.1, 1, true) == 0);
        // registry wiring
        check("registry: every on-screen information module has a position", List.of("direction", "freelookstatus", "session", "serverinfo", "frametime", "memory", "biome", "logo").stream().allMatch(id -> HudKit.positionable(reg.get(id))));
        check("registry: player and rendering modules are not on-screen elements", List.of("zoom", "sprint", "freelook", "crosshair", "fullbright", "bossbar").stream().noneMatch(id -> HudKit.positionable(reg.get(id))));
        check("registry: modules that servers may forbid say so", reg.get("freelook").note().toLowerCase(Locale.ROOT).contains("server") && reg.get("fullbright").note().toLowerCase(Locale.ROOT).contains("server"));
        check("registry: the cape says only you see it", reg.get("cape").note().contains("Only you"));
        Config.Registry r2 = new Config.Registry(); r2.restrict(List.of("sky", "cape", "nope"), "Not in the Minecraft 26.3 build yet"); Config.ProfileManager pm2 = new Config.ProfileManager(r2);
        boolean refused; try { pm2.setEnabled("sky", true); refused = false; } catch (IllegalArgumentException x) { refused = true; }
        check("registry: an adapter can lock modules it hasn't ported, with a reason, keeping their settings", !r2.get("sky").available() && r2.get("sky").note().contains("26.3") && r2.get("sky").settings().equals(reg.get("sky").settings()) && refused && r2.get("fps").available() && reg.get("sky").available());
        { Calc.Zoom za = new Calc.Zoom(4, 0.25), zb = new Calc.Zoom(4, 0.25), zc = new Calc.Zoom(4, 0.25); za.tick(true); for (int k = 0; k < 12; k++) zb.frame(true, 0.05 / 12); zc.frame(true, 0.05);
          check("zoom: per-frame easing at any frame rate lands where one tick would, so it glides instead of stepping", Math.abs(za.fovMultiplier() - zb.fovMultiplier()) < 1e-9 && Math.abs(za.fovMultiplier() - zc.fovMultiplier()) < 1e-9, za.fovMultiplier(), zb.fovMultiplier());
          Calc.Zoom zd = new Calc.Zoom(4, 0.25); for (int k = 0; k < 200; k++) zd.frame(true, 0.016); Calc.Zoom e2 = zd.withSettings(6, 0.5);
          check("zoom: changing settings mid-zoom keeps the current level (no jump); a long pause can't overshoot", Math.abs(e2.fovMultiplier() - 0.25) < 1e-9 && e2.factor() == 6 && sane(zd)); }
        // toggle sprint / sneak status and reset
        check("toggle status: sneaking wins; sprint says whether it is holding sprint; hidden or untoggled shows nothing", "Sneaking (toggled)".equals(GameLogic.toggleStatus(true, true, true, true, true)) && "Sprinting (toggled)".equals(GameLogic.toggleStatus(true, true, true, false, true))
            && "Sprint toggled".equals(GameLogic.toggleStatus(true, true, false, true, false)) && GameLogic.toggleStatus(false, true, true, false, true) == null && GameLogic.toggleStatus(true, false, false, true, false) == null);
        { Calc.SprintToggle st = new Calc.SprintToggle(); st.update(true, true, false, true); st.update(false, true, false, true); boolean wasOn = st.on(); st.reset();
          check("toggle sprint: reset (module turned off) forgets the toggle, so re-enabling doesn't sprint by itself", wasOn && !st.on() && !st.update(false, true, false, true)); }
        renderFx(reg);
        System.out.println("\n" + pass + " passed, " + fail + " failed"); if (fail > 0) System.exit(1);
    }
    static void renderFx(Config.Registry reg) {
        // registry
        check("render modules: registered in their categories, available, experimental, local-only notes", reg.get("blockoverlay").cat() == Config.Category.VISUALS && reg.get("colorgrade").cat() == Config.Category.VISUALS && reg.get("motionblur").cat() == Config.Category.VISUALS
            && reg.get("customfov").cat() == Config.Category.PLAYER && reg.get("glint").cat() == Config.Category.VISUALS && reg.get("lowhealth").cat() == Config.Category.HUD && reg.get("timechanger").cat() == Config.Category.SKY && reg.get("norender").cat() == Config.Category.VISUALS
            && List.of("blockoverlay", "colorgrade", "motionblur", "customfov", "glint", "lowhealth", "timechanger", "norender").stream().allMatch(id -> reg.get(id).available() && reg.get(id).note().startsWith("Experimental") && !HudKit.positionable(reg.get(id))));
        check("render modules: all off by default (motion blur included), Time Changer says it is local", reg.defaults().get("motionblur.enabled").equals("false") && reg.defaults().get("norender.enabled").equals("false") && reg.get("timechanger").note().contains("only for you"));
        check("render modules: No Render and Low Fire stay separate jobs (hide vs lower), Fullbright/Zoom are not duplicated", reg.get("norender").setting("fire") != null && reg.get("lowfire") != null && reg.get("norender").setting("brightness") == null && reg.get("customfov").setting("zoom") == null);
        // block overlay
        RenderFx.BlockOverlay bo = new RenderFx.BlockOverlay(); double[] a = {0, 64, 0, 1, 65, 1}, b = {1, 64, 0, 2, 64.5, 1};
        bo.update(true, a, 0.016, 0.07, 0.14);
        check("block overlay: the first block appears in place (no sweep from the origin) and fades in", bo.box[0] == 0 && bo.box[4] == 65 && bo.alpha > 0.1 && bo.alpha < 0.2, bo.alpha);
        for (int k = 0; k < 20; k++) bo.update(true, a, 0.016, 0.07, 0.14);
        bo.update(true, b, 0.016, 0.07, 0.14);
        check("block overlay: moving to the next block glides (part way after one frame) towards its real shape", bo.box[0] > 0 && bo.box[0] < 1 && bo.box[4] < 65 && bo.box[4] > 64.5 && bo.alpha == 1, bo.box[0], bo.box[4]);
        for (int k = 0; k < 60; k++) bo.update(true, b, 0.016, 0.07, 0.14);
        check("block overlay: the glide settles exactly on the block", Arrays.equals(bo.box, b));
        bo.update(true, new double[]{40, 64, 0, 41, 65, 1}, 0.016, 0.07, 0.14);
        check("block overlay: a far jump snaps instead of sweeping across the screen", bo.box[0] == 40);
        for (int k = 0; k < 4; k++) bo.update(false, null, 0.016, 0.07, 0.14);
        check("block overlay: looking away fades out in place", bo.alpha > 0 && bo.alpha < 1 && bo.box[0] == 40 && bo.visible());
        for (int k = 0; k < 20; k++) bo.update(false, null, 0.016, 0.07, 0.14);
        check("block overlay: fully faded, it's hidden; instant settings (0 ms) jump at once", !bo.visible() && run(() -> bo.update(true, a, 0.016, 0, 0)) && bo.alpha == 1 && bo.box[3] == 1);
        check("block overlay: chroma cycles, solid colour is the setting", RenderFx.overlayColor(0x123456, false, 1, 3) == 0x123456 && RenderFx.overlayColor(0x123456, true, 1, 0) != RenderFx.overlayColor(0x123456, true, 1, 3) && RenderFx.overlayColor(0, true, 1, 0) == RenderFx.overlayColor(0, true, 1, 6));
        // colour grading
        RenderFx.Grade n = RenderFx.Grade.NEUTRAL;
        check("color grading: neutral settings leave pixels unchanged", RenderFx.grade(0x7FA04C, 0.5, 0.5, n) == 0x7FA04C && RenderFx.grade(0x101010, 0.0, 0.0, n) == 0x101010 && n.neutral());
        int grey = RenderFx.grade(0xFF0000, 0.5, 0.5, new RenderFx.Grade(0, 1, 1, 0, 0, 0, 0.5));
        check("color grading: saturation 0 gives grey (Rec. 709 luma)", (grey >> 16 & 255) == (grey & 255) && (grey >> 8 & 255) == (grey & 255) && Math.abs((grey & 255) - 54) <= 1, Integer.toHexString(grey));
        int hi = RenderFx.grade(0xC0C0C0, 0.5, 0.5, new RenderFx.Grade(1, 1.5, 1, 0, 0, 0, 0.5)), lo = RenderFx.grade(0x404040, 0.5, 0.5, new RenderFx.Grade(1, 1.5, 1, 0, 0, 0, 0.5));
        check("color grading: contrast pushes light and dark apart around mid grey", (hi & 255) > 0xC0 && (lo & 255) < 0x40);
        int warm = RenderFx.grade(0x808080, 0.5, 0.5, new RenderFx.Grade(1, 1, 1, 1, 0, 0, 0.5));
        check("color grading: warmth adds orange (more red, less blue)", (warm >> 16 & 255) > 0x80 && (warm & 255) < 0x80);
        RenderFx.Grade v = new RenderFx.Grade(1, 1, 1, 0, 0, 1, 0.5);
        check("color grading: the vignette darkens corners, not the centre", RenderFx.grade(0xFFFFFF, 0.5, 0.5, v) == 0xFFFFFF && (RenderFx.grade(0xFFFFFF, 0.0, 0.0, v) & 255) < 0x40);
        int[] tex = RenderFx.gradeTexture(new RenderFx.Grade(1.3, 0.8, 1.2, -0.5, 0.25, 0.4, 0.6), 0.45, new int[2]); double[] dec = RenderFx.decodeTexture(tex);
        double[] want = {1.3, 0.8, 1.2, -0.5, 0.25, 0.4, 0.6, 0.45}; boolean close = true; for (int k = 0; k < 8; k++) close &= Math.abs(dec[k] - want[k]) < 0.0045;
        check("color grading: the shader's parameter texture round-trips every value within 8-bit precision", close, Arrays.toString(dec));
        int[] neutralTex = RenderFx.gradeTexture(n, 0, new int[2]); double[] nd = RenderFx.decodeTexture(neutralTex);
        check("color grading: neutral values decode close enough that the shader changes nothing visible", Math.abs(nd[0] - 1) < 0.005 && Math.abs(nd[1] - 1) < 0.003 && Math.abs(nd[2] - 1) < 0.003 && Math.abs(nd[3]) < 0.005 && nd[7] == 0);
        // motion blur
        double w = 0; for (int k = 0; k < 30; k++) w = RenderFx.blurWeight(0, 1, true, w, 0.016);
        double wt = 0; for (int k = 0; k < 30; k++) wt = RenderFx.blurWeight(720, 0.5, true, wt, 0.016);
        check("motion blur: standing still or walking straight stays sharp; turning fast blurs by the strength", w == 0 && Math.abs(wt - 0.45) < 0.01, w, wt);
        double wa = 0; for (int k = 0; k < 30; k++) wa = RenderFx.blurWeight(0, 1, false, wa, 0.016);
        check("motion blur: never a frozen image (capped at 0.9); 'only when turning' off blurs all the time", wa <= 0.9 && wa > 0.85);
        check("motion blur: turn angle wraps around north", Math.abs(RenderFx.turnDegrees(359, 0, 1, 0) - 2) < 1e-9 && Math.abs(RenderFx.turnDegrees(10, 0, 10, 30) - 30) < 1e-9);
        // fov
        check("custom fov: goes beyond the vanilla 30..110 slider, clamped to 10..170; dynamic FOV can be scaled or turned off", RenderFx.customFov(150) == 150 && RenderFx.customFov(500) == 170 && RenderFx.customFov(1) == 10 && RenderFx.fovEffects(false, 1) == 0 && RenderFx.fovEffects(true, 0.4) == 0.4);
        // glint
        int[] gt = RenderFx.glintTexture(32, 0xFF0000, 1, new int[32 * 32]);
        boolean onlyRed = true, tiles = true; int max = 0; for (int p : gt) { onlyRed &= (p & 0xFFFF) == 0 && p >>> 24 == 255; max = Math.max(max, p >> 16 & 255); }
        int adj = 0; for (int y = 0; y < 31; y++) for (int x = 0; x < 31; x++) adj = Math.max(adj, Math.max(Math.abs((gt[y * 32 + x] >> 16 & 255) - (gt[(y + 1) * 32 + x] >> 16 & 255)), Math.abs((gt[y * 32 + x] >> 16 & 255) - (gt[y * 32 + x + 1] >> 16 & 255))));
        for (int k = 0; k < 32; k++) { tiles &= Math.abs((gt[k] >> 16 & 255) - (gt[31 * 32 + k] >> 16 & 255)) <= adj && Math.abs((gt[k * 32] >> 16 & 255) - (gt[k * 32 + 31] >> 16 & 255)) <= adj; }
        check("glint: the texture is light in the chosen colour only, bright streaks, tiling without seams", onlyRed && max > 200 && tiles, max);
        int[] gd = RenderFx.glintTexture(32, 0xFFFFFF, 0.5, new int[32 * 32]); int maxD = 0; for (int p : gd) maxD = Math.max(maxD, p & 255);
        check("glint: intensity dims it; chroma cycles", maxD < max && RenderFx.glintColor(0x00FF00, false, 1, 5) == 0x00FF00 && RenderFx.glintColor(0, true, 1, 0) != RenderFx.glintColor(0, true, 1, 2));
        // low health
        check("low health: nothing above the threshold or when dead; absorption counts only when chosen", RenderFx.lowHealth(10, 0, 6, true, true, 1, 0) == 0 && RenderFx.lowHealth(0, 0, 6, true, true, 1, 0) == 0
            && RenderFx.lowHealth(4, 4, 6, true, false, 1, 0) == 0 && RenderFx.lowHealth(4, 4, 6, false, false, 1, 0) > 0);
        check("low health: stronger the lower you are", RenderFx.lowHealth(1, 0, 6, true, false, 1, 0) > RenderFx.lowHealth(5, 0, 6, true, false, 1, 0));
        double mn = 1, mx = 0; for (int k = 0; k < 200; k++) { double x = RenderFx.lowHealth(3, 0, 6, true, true, 1, k * 0.01); mn = Math.min(mn, x); mx = Math.max(mx, x); }
        check("low health: it pulses (a heartbeat) between soft and full, within 0..1", mx - mn > 0.15 && mn > 0 && mx <= 1, mn, mx);
        int[] m = RenderFx.edgeMask(64, 0.22, new int[64 * 64]);
        check("low health: the edge mask is clear in the middle and solid at the edges, white only", m[32 * 64 + 32] >>> 24 == 0 && m[32 * 64] >>> 24 > 200 && m[0] >>> 24 > 230 && (m[0] & 0xFFFFFF) == 0xFFFFFF);
        // time changer
        check("time changer: fixed time, wall clock (06:00 sunrise, 12:00 noon, 00:00 midnight) and off", RenderFx.localTime("fixed", 123, 18000, 1, 0, 0, 0, 0) == 18000 && RenderFx.realTicks(6, 0) == 0 && RenderFx.realTicks(12, 0) == 6000 && RenderFx.realTicks(0, 0) == 18000 && RenderFx.realTicks(5, 30) == 23500 && RenderFx.localTime("off", 777, 0, 1, 0, 0, 0, 0) == 777);
        check("time changer: speed mode runs a local clock (x1 = 20 ticks a second, 0 freezes) and wraps the day", RenderFx.localTime("speed", 0, 0, 1, 1000, 10, 0, 0) == 1200 && RenderFx.localTime("speed", 0, 0, 0, 1000, 99, 0, 0) == 1000 && RenderFx.localTime("speed", 0, 0, 10, 23000, 10, 0, 0) == 1000);
        check("time changer: the server's day count is kept (moon phase), labels read as a clock", RenderFx.withDay(24000 * 5 + 300, 13000) == 24000 * 5 + 13000 && RenderFx.clockLabel(0).equals("06:00") && RenderFx.clockLabel(6000).equals("12:00") && RenderFx.clockLabel(18000).equals("00:00"));
        // no render
        RenderFx.NoRender nr = new RenderFx.NoRender(); nr.fire = true; nr.explosions = true;
        check("no render: nothing is hidden while the module is off", !nr.fire() && !nr.hidesParticle("minecraft:explosion"));
        nr.on = true;
        check("no render: toggles hide only what they name; explosions drop explosion particles only", nr.fire() && !nr.pumpkin() && nr.hidesParticle("minecraft:explosion_emitter") && !nr.hidesParticle("minecraft:flame"));
        long before = alloc(); RenderFx.BlockOverlay bx = new RenderFx.BlockOverlay(); int[] px = new int[2]; double acc = 0;
        for (int k = 0; k < 100_000; k++) { bx.update(k % 50 != 0, a, 0.016, 0.07, 0.14); acc += RenderFx.blurWeight(k % 720, 0.5, true, acc * 0, 0.016) + RenderFx.lowHealth(3, 0, 6, true, true, 1, k * 0.016); RenderFx.gradeTexture(n, 0.1, px); }
        long used = alloc() - before;
        check("render modules: per-frame work (overlay, blur weight, warning, grade parameters) allocates almost nothing", used < 6_000_000 && acc > 0, used);
    }
    static boolean run(Runnable r) { r.run(); return true; }
    static long alloc() { return ((com.sun.management.ThreadMXBean) java.lang.management.ManagementFactory.getThreadMXBean()).getThreadAllocatedBytes(Thread.currentThread().threadId()); }
}
