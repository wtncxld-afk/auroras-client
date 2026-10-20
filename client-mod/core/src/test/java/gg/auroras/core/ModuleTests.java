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
        playerFx(reg);
        worldFx(reg);
        System.out.println("\n" + pass + " passed, " + fail + " failed"); if (fail > 0) System.exit(1);
    }
    static boolean run(Runnable r) { r.run(); return true; }
    /** Swing Animation, Weapon Inspect, blade skins, Hand Aura, Totem Spirit, Name Protect, Stream Hide and Skin Changer (core PlayerFx). */
    static void playerFx(Config.Registry reg) {
        // registry: the new modules sit in existing categories, are available, and say they are local only
        String[][] want = {{"swinganim", "Animations"}, {"inspect", "Animations"}, {"handaura", "Player Visuals"}, {"totemspirit", "Totems"}, {"nameprotect", "Player"}, {"streamhide", "Player"}, {"skinchanger", "Cosmetics"}};
        boolean cats = true; for (String[] w : want) { Config.Module m = reg.get(w[0]); cats &= m != null && m.cat().label.equals(w[1]) && m.available(); }
        check("player fx: the seven modules are registered in their categories", cats);
        check("player fx: Name Protect and Stream Hide are labelled as changing only what you see", reg.get("nameprotect").impact() == Config.Impact.COSMETIC && reg.get("streamhide").impact() == Config.Impact.COSMETIC);
        check("player fx: cosmetic notes say only you see them", reg.get("skinchanger").note().contains("Only you see") && reg.get("nameprotect").note().contains("real name") && reg.get("inspect").note().contains("Only you"));
        check("player fx: the inspect key defaults to I (F is Minecraft's swap-hands key)", reg.get("inspect").setting("key").def().equals("73"));
        // text settings
        check("text settings: aliases accept names and reject anything that could break the settings file", reg.validate("nameprotect.alias", "Aurora_Fan 7") == null && reg.validate("nameprotect.alias", "") == null
            && reg.validate("nameprotect.alias", "a=b") != null && reg.validate("nameprotect.alias", "seventeen chars!!") != null && reg.validate("nameprotect.alias", "naïve") != null && reg.validate("nameprotect.alias", "x\ny") != null);
        Config.ProfileManager pm = new Config.ProfileManager(reg); ModuleMenu mm = new ModuleMenu(reg, pm); mm.openSettings("nameprotect"); Config.SettingDef al = reg.get("nameprotect").setting("alias");
        mm.eraseText(al); mm.eraseText(al); mm.eraseText(al); boolean typed = mm.typeText(al, "S") && mm.typeText(al, "k") && !mm.typeText(al, "=") && !mm.typeText(al, "é");
        for (int k = 0; k < 20; k++) mm.typeText(al, "x");
        check("text settings: typing in game keeps only allowed characters and stops at 16", typed && pm.get("nameprotect.alias").startsWith("Sk") && pm.get("nameprotect.alias").length() == 16 && UiKit.controlFor(al) == UiKit.Control.TEXT, pm.get("nameprotect.alias"));
        // swing
        check("swing: vanilla and legacy keep the curve; smooth eases in and out and still ends at the ends", PlayerFx.swing("vanilla", 0.3) == 0.3 && PlayerFx.swing("legacy", 0.3) == 0.3 && PlayerFx.swing("smooth", 0) == 0 && PlayerFx.swing("smooth", 1) == 1
            && PlayerFx.swing("smooth", 0.1) < 0.1 && PlayerFx.swing("smooth", 0.9) > 0.9 && Math.abs(PlayerFx.swing("smooth", 0.5) - 0.5) < 1e-9);
        boolean mono = true; for (int k = 1; k <= 100; k++) mono &= PlayerFx.swing("smooth", k / 100.0) >= PlayerFx.swing("smooth", (k - 1) / 100.0);
        check("swing: the smooth curve never goes backwards", mono);
        check("swing: speed stretches the animation (slow halves it again), clamped to 1..40 ticks", PlayerFx.swingTicks("vanilla", 6, 1) == 6 && PlayerFx.swingTicks("vanilla", 6, 0.5) == 12 && PlayerFx.swingTicks("slow", 6, 1) == 12
            && PlayerFx.swingTicks("vanilla", 6, 2) == 3 && PlayerFx.swingTicks("slow", 30, 0.25) == 40 && PlayerFx.swingTicks("vanilla", 0, 2) == 1);
        check("swing: the 1.7 style hides the cooldown dip by itself", PlayerFx.hideCooldownDip("legacy", false) && !PlayerFx.hideCooldownDip("vanilla", false) && PlayerFx.hideCooldownDip("smooth", true));
        double[] o = new double[7]; PlayerFx.itemOffset(0.3, -0.2, 0.1, 1.5, 10, 20, 30, true, o);
        check("swing: the off hand mirrors sideways moves and turns; values are clamped", o[0] == -0.3 && o[1] == -0.2 && o[5] == -20 && o[6] == -30 && o[4] == 10 && o[3] == 1.5);
        PlayerFx.itemOffset(0, 0, 0, 1, 0, 0, 0, false, o); boolean id = PlayerFx.identity(o); PlayerFx.itemOffset(5, 0, 0, 9, 0, 0, 999, false, o);
        check("swing: default offsets are the identity (no extra work), out-of-range ones are clamped", id && o[0] == 1 && o[3] == 2 && o[6] == 180);
        // inspect
        double[] pz = new double[6]; boolean rest = true;
        for (String st : PlayerFx.INSPECT_STYLES) { PlayerFx.inspectPose(st, 0, pz); for (double v : pz) rest &= Math.abs(v % 360) < 1e-9; PlayerFx.inspectPose(st, 1, pz); for (double v : pz) rest &= Math.abs(v % 360) < 1e-9; }
        check("inspect: every style starts and ends at rest", rest);
        boolean smooth = true;
        for (String st : PlayerFx.INSPECT_STYLES) { double[] a = new double[6], b = new double[6]; for (int k = 1; k <= 400; k++) { PlayerFx.inspectPose(st, (k - 1) / 400.0, a); PlayerFx.inspectPose(st, k / 400.0, b);
            for (int j = 0; j < 3; j++) smooth &= Math.abs(a[j] - b[j]) < 0.01; for (int j = 3; j < 6; j++) if (!(st.equals("twirl") && j == 4 && (k == 320 || k == 400))) smooth &= Math.abs(a[j] - b[j]) < 6; } }
        check("inspect: poses change smoothly from frame to frame (no jumps)", smooth);
        PlayerFx.Inspect in = new PlayerFx.Inspect(); in.start("showcase", 1.0); for (int k = 0; k < 30; k++) in.frame(1 / 60.0); in.pose(pz); double mid = Math.abs(pz[0]);
        for (int k = 0; k < 120; k++) in.frame(1 / 60.0);
        check("inspect: plays for its duration and then stops by itself", mid > 0.05 && !in.active());
        in.start("twirl", 3); for (int k = 0; k < 60; k++) in.frame(1 / 60.0); in.cancel(); in.pose(pz); double before = Math.abs(pz[0]); in.frame(0.05); in.pose(pz); double during = Math.abs(pz[0]); in.frame(0.2);
        check("inspect: cancelling blends back over a moment instead of snapping", before > 0 && during < before && during > 0 && !in.active());
        PlayerFx.Inspect fr = new PlayerFx.Inspect(), fs = new PlayerFx.Inspect(); fr.start("flip", 2); fs.start("flip", 2); for (int k = 0; k < 144; k++) fr.frame(1 / 144.0); for (int k = 0; k < 30; k++) fs.frame(1 / 30.0);
        double[] p1 = new double[6], p2 = new double[6]; fr.pose(p1); fs.pose(p2);
        check("inspect: the same moment looks the same at 30 and 144 fps", Math.abs(p1[3] - p2[3]) < 1e-6);
        // blade skins
        check("blade skins: none leaves the item alone; strength 0 is white; 1 is the full colour", PlayerFx.bladeTint("none", 0, 1, 0) == -1 && PlayerFx.bladeTint("frost", 0, 0, 0) == 0xFFFFFFFF && PlayerFx.bladeTint("frost", 0, 1, 0) == 0xFF9FE8FF
            && PlayerFx.bladeTint("custom", 0x123456, 1, 0) == 0xFF123456);
        check("blade skins: every listed skin gives an opaque tint", PlayerFx.BLADE_SKINS.stream().filter(k -> !k.equals("none")).allMatch(k -> (PlayerFx.bladeTint(k, 0x808080, 0.7, 3) >>> 24) == 0xFF));
        check("blade skins: aurora and eclipse move over time; the rest stay put", PlayerFx.bladeTint("aurora", 0, 1, 0) != PlayerFx.bladeTint("aurora", 0, 1, 2) && PlayerFx.bladeTint("eclipse", 0, 1, 0) != PlayerFx.bladeTint("eclipse", 0, 1, 1) && PlayerFx.bladeTint("ember", 0, 1, 0) == PlayerFx.bladeTint("ember", 0, 1, 9));
        check("colour helpers: hue wheel and mixing", PlayerFx.hue(0) == 0xFF0000 && PlayerFx.hue(1 / 3.0) == 0x00FF00 && PlayerFx.hue(2 / 3.0) == 0x0000FF && PlayerFx.mixRgb(0x000000, 0xFFFFFF, 0.5) == 0x808080);
        // hand aura
        int a0 = PlayerFx.auraColor(0x6FE3FF, false, 1, 1, false, 0, 3, 0), a2 = PlayerFx.auraColor(0x6FE3FF, false, 1, 1, false, 2, 3, 0);
        check("hand aura: inner shells are stronger than outer ones, all translucent, in the chosen colour", (a0 >>> 24) > (a2 >>> 24) && (a0 >>> 24) < 255 && (a0 & 0xFFFFFF) == 0x6FE3FF && PlayerFx.auraColor(0x6FE3FF, false, 1, 0, false, 0, 3, 0) == 0);
        check("hand aura: chroma changes colour over time; shells spread out to 1 + size", PlayerFx.auraColor(0, true, 1, 1, false, 0, 2, 0) != PlayerFx.auraColor(0, true, 1, 1, false, 0, 2, 2) && Math.abs(PlayerFx.auraScale(0.1, 1, 2) - 1.1) < 1e-9 && PlayerFx.auraScale(0.1, 0, 2) < PlayerFx.auraScale(0.1, 1, 2));
        // totem spirit
        PlayerFx.Spirit sp = new PlayerFx.Spirit(7, 2.0); int first = sp.count(1, 0.05); sp.age = 1.5; int late = sp.count(1, 0.05); sp.age = 2; int gone = sp.count(1, 0.05);
        check("totem spirit: strongest at the pop, fading to nothing by the end", first > late && late > 0 && gone == 0 && sp.done() && new PlayerFx.Spirit(1, 1).count(3, 0.05) > first);
        boolean inside = true; double[] mo = new double[4];
        for (String sh : PlayerFx.SPIRIT_SHAPES) for (int k = 0; k < 40; k++) for (double age = 0; age < 2; age += 0.1) { PlayerFx.spiritMote(sh, age, 2, k, 40, 3, 1, 42, mo); inside &= Math.hypot(mo[0], mo[2]) <= 1.0 && mo[1] >= 0 && mo[1] <= 3.0 && mo[3] > 0; }
        check("totem spirit: every mote of every shape starts in a column around the player, rising", inside);
        PlayerFx.spiritMote("pillar", 0.5, 2, 3, 10, 3, 1, 42, mo); double x1 = mo[0]; PlayerFx.spiritMote("pillar", 0.5, 2, 3, 10, 3, 1, 42, mo);
        check("totem spirit: motes are a pure function of the seed (same input, same place)", x1 == mo[0]);
        check("totem spirit: colours blend from the base colour to the top colour", PlayerFx.spiritColor(0xFF0000, 0x0000FF, false, 0, 2, 0, 0) == 0xFF0000 && PlayerFx.spiritColor(0xFF0000, 0x0000FF, false, 2, 2, 0, 0) == 0x0000FF);
        // name protect
        String[] nm = new String[8], als = new String[8]; int nc = PlayerFx.nameTable("Steve", "You", List.of("Alex", "Steve", "Alexander"), true, "Player", nm, als);
        check("name protect: the table has you first-or-longest, others numbered in a stable order, no duplicate of you", nc == 3 && nm[0].equals("Alexander") && Arrays.asList(nm).subList(0, 3).containsAll(List.of("Steve", "Alex", "Alexander"))
            && als[Arrays.asList(nm).indexOf("Alex")].equals("Player 1") && als[Arrays.asList(nm).indexOf("Alexander")].equals("Player 2"));
        String chat = "<Steve> hi Alex and alexander, steve_2 isn't Steve";
        String out = PlayerFx.protect(chat, nm, als, nc);
        check("name protect: whole names are replaced (any case), longer names first, parts of other names are left alone", out.equals("<You> hi Player 1 and Player 2, steve_2 isn't You"), out);
        String plain = "nothing to see"; check("name protect: text without names comes back as the same object (no allocation)", PlayerFx.protect(plain, nm, als, nc) == plain && PlayerFx.protect(chat, nm, als, 0) == chat);
        int[] cps = "§Steve!".codePoints().toArray(); Object[] sty = new Object[cps.length]; for (int i = 0; i < cps.length; i++) sty[i] = i < 3 ? "red" : "blue"; int[] oc = new int[64]; Object[] os = new Object[64];
        int on = PlayerFx.protect(cps, sty, cps.length, nm, als, nc, oc, os);
        check("name protect: styled text keeps each letter's style; the alias takes the name's first style", on == 5 && new String(oc, 0, on).equals("§You!") && os[1] == "red" && os[3] == "red" && os[4] == "blue", on);
        check("name protect: styled text without names says so (draw the original)", PlayerFx.protect("hello".codePoints().toArray(), new Object[5], 5, nm, als, nc, oc, os) == -1);
        check("name protect: bad aliases fall back", PlayerFx.cleanAlias("  ", "You").equals("You") && PlayerFx.cleanAlias("a=b", "You").equals("You") && PlayerFx.cleanAlias(" Nova ", "You").equals("Nova"));
        long b0 = alloc(); for (int k = 0; k < 100_000; k++) PlayerFx.protect(plain, nm, als, nc); long used = alloc() - b0;
        check("name protect: checking text without names allocates nothing", used < 64 * 1024, used);
        // stream hide
        check("stream hide: nothing is hidden while off or toggled off; each part has its own bit", PlayerFx.hideMask(false, true, true, true, true, true) == 0 && PlayerFx.hideMask(true, false, true, true, true, true) == 0
            && PlayerFx.hideMask(true, true, true, false, true, false) == 5 && PlayerFx.hideMask(true, true, true, true, true, true) == 15);
        // skin changer
        check("skin changer: 64x64 and old 64x32 skins only; auto keeps the account's arms", PlayerFx.skinSize(64, 64) && PlayerFx.skinSize(64, 32) && !PlayerFx.skinSize(128, 128) && !PlayerFx.skinSize(64, 48)
            && PlayerFx.slim("auto", true) && !PlayerFx.slim("auto", false) && PlayerFx.slim("slim", false) && !PlayerFx.slim("wide", true));
        int[] old = new int[64 * 32]; for (int i = 0; i < old.length; i++) old[i] = 0xFF000000 | i; int[] conv = PlayerFx.legacySkin(old);
        check("skin changer: old skins get Minecraft's mirrored left arm and leg; the top half is unchanged", conv.length == 4096 && conv[0] == old[0] && conv[31 * 64 + 63] == old[31 * 64 + 63]
            && conv[52 * 64 + 24] == old[20 * 64 + 3] && conv[52 * 64 + 43] == old[20 * 64 + 40] && conv[48 * 64 + 20] == old[16 * 64 + 7] && conv[63 * 64 + 0] == 0);
    }
    /** In-world cosmetics: projection, palettes, aura shapes, emitters, damage numbers, nameplate layout, emblem. */
    static void worldFx(Config.Registry reg) {
        WorldFx.View v = new WorldFx.View(); double[] p = new double[3];
        v.setAngles(0, 0, 0, 0, 0, 70, 400, 200);
        check("view: a point straight ahead lands in the middle of the screen", v.project(0, 0, 10, p) && Math.abs(p[0] - 200) < 1e-6 && Math.abs(p[1] - 100) < 1e-6 && Math.abs(p[2] - 10) < 1e-9, Arrays.toString(p));
        double edge = Math.tan(Math.toRadians(35)) * 10;
        check("view: half the vertical field of view up is the top edge; Minecraft's left (+X at yaw 0) is the screen's left", v.project(0, edge, 10, p) && Math.abs(p[1]) < 1e-6 && v.project(3, 0, 10, p) && p[0] < 200, Arrays.toString(p));
        check("view: points behind the camera are not projected", !v.project(0, 0, -5, p) && !v.project(0, 0, 0.01, p));
        v.setAngles(0, 0, 0, 90, 0, 70, 400, 200);
        check("view: yaw 90 looks west (-X)", v.project(-10, 0, 0, p) && Math.abs(p[0] - 200) < 1e-6 && !v.project(10, 0, 0, p));
        v.setAngles(0, 0, 0, 0, 90, 70, 400, 200);
        check("view: pitch 90 looks down", v.project(0, -10, 0, p) && Math.abs(p[0] - 200) < 1e-6 && Math.abs(p[1] - 100) < 1e-6);
        WorldFx.View v2 = new WorldFx.View(); v2.set(0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 70, 400, 200); v.setAngles(0, 0, 0, 0, 0, 70, 400, 200);
        double[] q = new double[3]; boolean same = true; for (double[] t : new double[][]{{1, 2, 9}, {-3, 0.5, 4}, {0.2, -1, 20}}) { v.project(t[0], t[1], t[2], p); v2.project(t[0], t[1], t[2], q); same &= Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9; }
        check("view: the camera's own forward/up/left vectors give the same projection as yaw and pitch", same);
        check("view: one block covers fewer GUI units further away; faces() tells front from back", v.perBlock(20) < v.perBlock(5) && Math.abs(v.perBlock(10) * edge - 100) < 1e-6 && v.faces(0, 0, 5, 0, -1) && !v.faces(0, 0, 5, 0, 1));
        // colours
        int[] pal = WorldFx.palette("sakura");
        check("palette: every particle style has its own colours; unknown styles fall back to aurora", Particles.STYLE_IDS.stream().map(s -> Arrays.toString(WorldFx.palette(s))).distinct().count() == Particles.STYLE_IDS.size() && Arrays.equals(WorldFx.palette("nope"), WorldFx.palette("aurora")));
        boolean inPal = true; for (int i = 0; i < 50; i++) { int c = WorldFx.color("style", new int[]{0x112233}, 0, i * 0.3, i); inPal &= c == 0x112233; }
        check("colour: style mode stays within the palette, custom mode stays near the chosen colour, rainbow changes hue", inPal && ((WorldFx.color("custom", pal, 0xFF0000, 1, 3) >> 16) & 255) >= 0xD8 && (WorldFx.color("custom", pal, 0xFF0000, 1, 3) & 0xFFFF) == 0 && WorldFx.color("rainbow", pal, 0, 0, 0) != WorldFx.color("rainbow", pal, 0, 2, 0));
        check("colour: hsv primaries", WorldFx.hsv(0, 1, 1) == 0xFF0000 && WorldFx.hsv(1 / 3.0, 1, 1) == 0x00FF00 && WorldFx.hsv(2 / 3.0, 1, 1) == 0x0000FF && WorldFx.hsv(0.5, 0, 1) == 0xFFFFFF);
        java.util.Set<String> kinds = new java.util.HashSet<>(); for (String st : Particles.STYLE_IDS) for (int i = 0; i < 12; i++) kinds.add(WorldFx.kind(st, i));
        check("particle kinds: every style maps to particles the adapter knows", java.util.Set.of("glow", "soft", "dust", "transition", "petal", "enchant", "spark").containsAll(kinds) && WorldFx.kind("sakura", 0).equals("petal"), kinds);
        // aura
        double[] o = new double[6]; boolean ringOk = true;
        for (int k = 0; k < 24; k++) { WorldFx.auraPoint("ring", k, 24, 1.3, 1, 0.7, 1, 0.5, o); ringOk &= Math.abs(Math.hypot(o[0], o[2]) - 0.7) < 1e-9 && o[1] < 0.2; }
        WorldFx.auraPoint("halo", 0, 12, 0, 1, 0.7, 1, 0, o); double haloY = o[1]; WorldFx.auraPoint("halo", 0, 12, 0, 1, 0.7, 1.5, 0, o);
        check("aura: the ring circles the feet at its radius; the halo floats above the head and follows height", ringOk && haloY > 2 && o[1] > haloY);
        WorldFx.auraPoint("ring", 0, 24, 0, 1, 0.7, 1, 0, o); double a0 = Math.atan2(o[2], o[0]); WorldFx.auraPoint("ring", 0, 24, 0.5, 1, 0.7, 1, 0, o); double a1 = Math.atan2(o[2], o[0]);
        WorldFx.auraPoint("ring", 0, 24, 0.5, 0, 0.7, 1, 0, o); double still = Math.atan2(o[2], o[0]);
        check("aura: speed turns the shape over time; speed 0 holds it still", Math.abs(a1 - a0) > 0.1 && Math.abs(still - a0) < 1e-9);
        boolean bounded = true; for (String sh : WorldFx.AURA_SHAPES) for (int k = 0; k < 40; k++) { WorldFx.auraPoint(sh, k, 40, k * 0.37, 1.5, 1.2, 1, (k * 0.61) % 1, o); bounded &= Math.hypot(o[0], o[2]) <= 1.2 + 1e-9 && o[1] >= 0 && o[1] <= 2.4 && Double.isFinite(o[4]); }
        check("aura: every shape stays inside its radius and around the player's height", bounded);
        // stride
        WorldFx.Stride st = new WorldFx.Stride(); int total = st.step(0, 0, 0, 0.5);
        for (int k = 1; k <= 20; k++) total += st.step(k * 0.1, 0, 0, 0.5);
        check("stride: points come by distance (2 blocks at 0.5 spacing gives 4), none when standing still", total == 4 && st.step(2, 0, 0, 0.5) == 0, total);
        int jump = st.step(50, 0, 0, 0.5);
        int n3 = st.step(51.5, 0, 0, 0.5);
        check("stride: a teleport doesn't fill the gap; points spread along the segment", jump == 0 && n3 == 3 && Math.abs(st.at(0, 3, 0) - 50.5) < 1e-9 && Math.abs(st.at(2, 3, 0) - 51.5) < 1e-9, jump, n3);
        WorldFx.Strides ss = new WorldFx.Strides(4); WorldFx.Stride s1 = ss.get(7, 0); boolean reused = ss.get(7, 1) == s1; ss.get(8, 0); ss.get(9, 25); ss.sweep(30, 20);
        check("strides: one per entity, reused, and stale ones are swept", reused && ss.size() == 1);
        // sight cache
        WorldFx.Sight sight = new WorldFx.Sight(2); sight.put(1, 10, true); sight.put(2, 10, false);
        check("sight: cached answers expire after a few ticks", sight.get(1, 12, 4) == 1 && sight.get(2, 12, 4) == 0 && sight.get(1, 20, 4) == -1 && sight.get(3, 12, 4) == -1);
        sight.put(3, 15, true); check("sight: when full the oldest entry makes room", sight.get(3, 15, 4) == 1);
        // damage
        WorldFx.Damage dm = new WorldFx.Damage(4, 3);
        dm.track(5, 20, 0, 3); float d0 = dm.observe(5, 20, 0.05); float d1 = dm.observe(5, 14.5f, 0.1); float d2 = dm.observe(5, 16, 0.2);
        check("damage: the first look sets the baseline; then health changes come back signed", d0 == 0 && Math.abs(d1 + 5.5f) < 1e-6 && Math.abs(d2 - 1.5f) < 1e-6 && dm.lastHit(5) == 0.1);
        check("damage: untracked entities report nothing", dm.observe(6, 1, 0.1) == 0 && !dm.tracked(6));
        dm.expire(2.0, 4); boolean kept = dm.tracked(5); dm.expire(10, 4); check("damage: entries stay while watched or recently hurt, then expire", kept && !dm.tracked(5));
        for (int k = 0; k < 5; k++) dm.spawn(1, -k, 0, 0, 0, k, 0);
        check("damage numbers: a full pool replaces the oldest", dm.nums == 3 && Arrays.stream(dm.numBorn, 0, 3).min().getAsDouble() == 2);
        dm.age(4.5, 2.0); check("damage numbers: expire after their duration", dm.nums == 2);
        double[] mo = new double[3]; WorldFx.numberMotion(0, 1.2, 1, mo); double r0 = mo[0], f0 = mo[1]; WorldFx.numberMotion(1.2, 1.2, 1, mo);
        check("damage numbers: rise and fade out over their life", r0 == 0 && f0 == 1 && mo[0] > 0.8 && mo[1] == 0);
        check("damage numbers: formatting in health points or hearts, heals marked +", WorldFx.formatAmount(-4, "hp", 1).equals("4") && WorldFx.formatAmount(-3.5, "hp", 1).equals("3.5") && WorldFx.formatAmount(-3.5, "hearts", 2).equals("1.75") && WorldFx.formatAmount(2, "hp", 0).equals("+2") && WorldFx.formatAmount(-0.333, "hp", 2).equals("0.33"),
            WorldFx.formatAmount(-3.5, "hearts", 2), WorldFx.formatAmount(-0.333, "hp", 2));
        check("health colours: red when low, green when full", WorldFx.healthColor(0) == 0xFF5A6E && WorldFx.healthColor(1) == 0x6FE38A && WorldFx.pingColor(40) == 0x6FE38A && WorldFx.pingColor(300) == 0xFF5A6E && WorldFx.pingColor(0) == 0x9AA3B5);
        // nameplate
        double[] lay = WorldFx.plateLayout(40, 14, true, true, 7, new double[8]), bare = WorldFx.plateLayout(40, 0, false, false, 7, new double[8]);
        check("nameplate: item, ping and health bar make the plate wider and taller; pieces don't overlap", lay[0] > bare[0] && lay[1] > bare[1] && lay[2] >= lay[4] + 8 && lay[3] >= lay[2] + 40 && lay[3] + 14 <= lay[0] && lay[5] < lay[1]);
        check("nameplate: size follows distance but stays readable", WorldFx.plateScale(1000, 1) == 1.15 && WorldFx.plateScale(1, 1) == 0.6 && WorldFx.plateScale(1, 2) == 1.2 && WorldFx.distanceFade(10, 48) == 1 && WorldFx.distanceFade(48, 48) == 0 && WorldFx.distanceFade(44, 48) < 1);
        // emblem
        double[] e = new double[7]; WorldFx.emblemAnchor("back", 0, false, 1, e);
        check("emblem: on the back at yaw 0 (facing +Z) it sits behind (-Z) and faces backwards", e[2] < 0 && e[4] < 0 && Math.abs(e[0]) < 1e-9 && e[1] > 1);
        WorldFx.emblemAnchor("chest", 0, false, 1, e); boolean chest = e[2] > 0 && e[4] > 0; WorldFx.emblemAnchor("shoulder", 0, false, 1, e);
        check("emblem: chest faces forward, shoulder faces the left side (+X at yaw 0); crouching lowers it", chest && e[3] > 0.99 && e[0] > 0.3 && lower(e));
        WorldFx.emblemAnchor("back", 90, false, 2, e); check("emblem: turns with the body and scales with the model", e[0] > 0.3 && Math.abs(e[2]) < 1e-9 && e[1] > 2);
        check("emblem: body yaw interpolates the short way round", Math.abs(WorldFx.rotLerp(0.5, 350, 10) - 360) < 1e-9 && Math.abs(WorldFx.rotLerp(0.5, 10, 350) - 0) < 1e-9);
        boolean art = true; for (String d : WorldFx.EMBLEMS) { int[] px = WorldFx.emblemArt(d, 32, 0x6FE3FF, 0xB78CFF, true); long on = Arrays.stream(px).filter(c -> (c >>> 24) > 128).count(); art &= on > 32 * 32 / 10 && on < 32 * 32 * 0.95 && (px[0] >>> 24) == 0; }
        check("emblem art: every design fills part of its square and leaves the corners clear", art);
        int[] ht = WorldFx.emblemArt("diamond", 32, 0xFF0000, 0x0000FF, false);
        check("emblem art: the colour runs from top to bottom", (ht[4 * 32 + 16] & 0xFF0000) > (ht[27 * 32 + 16] & 0xFF0000) && (ht[27 * 32 + 16] & 0xFF) > (ht[4 * 32 + 16] & 0xFF));
        // the particle pool as the in-game budget
        Particles pool = new Particles(64, 3); pool.setBudget(10, Quality.HIGH, 1); int ok = 0; for (int k = 0; k < 20; k++) if (pool.spawn(0, 0, 0, 0, 0, 0, 1, 1, 0)) ok++;
        pool.update(0.5f, 0, 0, 32); boolean alive = pool.count == 10; pool.update(0.6f, 0, 0, 32);
        check("particles: exact spawns stop at the budget and free up as particles expire", ok == 10 && alive && pool.count == 0 && pool.spawn(0, 0, 0, 0, 0, 0, 1, 1, 0));
        Particles dueP = new Particles(64, 3); dueP.setBudget(5, Quality.HIGH, 1); int due = dueP.due(100, 0.1); check("particles: due() asks for rate x time, capped by the free budget; fractions carry", due == 5 && dueP.due(2.5, 0.2) == 0 && dueP.due(2.5, 0.2) == 1);
        // registry
        check("registry: every new cosmetic setting has a sane default", List.of("damage", "aura", "nameplate", "emblem", "trails", "particlefx").stream().allMatch(id -> reg.get(id).settings().stream().allMatch(sd -> reg.validate(id + "." + sd.key(), sd.def()) == null)));
        long before = alloc(); for (int k = 0; k < 100_000; k++) { v.project(k % 7, 1, 10, p); WorldFx.auraPoint("helix", k, 48, k * 0.01, 1, 0.7, 1, 0.3, o); WorldFx.color("style", pal, 0, k, k); st.step(k * 0.01, 0, 0, 0.3); } long used = alloc() - before;
        check("world fx: projection, aura points, colours and strides allocate nothing per call", used < 64 * 1024, used);
    }
    static boolean lower(double[] shoulder) { double[] c = new double[7]; WorldFx.emblemAnchor("shoulder", 0, true, 1, c); return c[1] < shoulder[1]; }
    static long alloc() { return ((com.sun.management.ThreadMXBean) java.lang.management.ManagementFactory.getThreadMXBean()).getThreadAllocatedBytes(Thread.currentThread().threadId()); }
}
