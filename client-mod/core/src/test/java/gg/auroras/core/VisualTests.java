package gg.auroras.core;

import java.lang.management.ManagementFactory;
import java.nio.file.*;
import java.util.*;

/** Run from client-mod/core: java -cp out gg.auroras.core.VisualTests ../../visuals */
public final class VisualTests {
    static int pass, fail;
    static void check(String n, boolean ok, Object... info) { if (ok) pass++; else fail++; System.out.println((ok ? "PASS  " : "FAIL  ") + n + (ok || info.length == 0 ? "" : "  " + Arrays.toString(info))); }
    static boolean iae(Runnable r) { try { r.run(); return false; } catch (IllegalArgumentException e) { return true; } }
    static long alloc() { return ((com.sun.management.ThreadMXBean) ManagementFactory.getThreadMXBean()).getThreadAllocatedBytes(Thread.currentThread().threadId()); }
    static int ch(int c, int s) { return (c >> s) & 255; }

    static void skyFx(Map<String, Sky.Theme> th) {
        // animated skies
        check("sky fx: every theme carries its own animation mix", th.get("sakura").fx().petals() > 0 && th.get("aurora").fx().auroraLayers() == 3 && th.get("celestial").fx().constellations() && th.get("midnight").fx().constellations()
            && th.get("cosmic").fx().nebulaDrift() > 0 && th.get("sunset").fx().clouds() > 0 && th.values().stream().allMatch(t -> t.fx().meteorsPerMinute() > 0));
        check("sky fx: out-of-range effect data is refused", iae(() -> SkyFx.parse(Map.of("meteorsPerMinute", 99.0, "clouds", 0.0, "cloudColor", "#ffffff", "petals", 0.0, "petalColor", "#ffffff", "constellations", false, "nebulaDrift", 0.0, "auroraLayers", 1.0))));
        { float[] o = new float[SkyFx.METEOR_FIELDS * 4]; int meteorsSeen = 0; double prev = -1; boolean inSky = true;
          for (double t = 0; t < 3600; t += 0.05) { int c = SkyFx.meteors(7, 4, t, 4, o); for (int k = 0; k < c; k++) { inSky &= o[k * 6 + 1] > 0 && o[k * 6 + 1] < 1 && o[k * 6 + 5] >= 0 && o[k * 6 + 5] <= 1; if (o[k * 6 + 4] < prev - 0.5 || prev < 0) meteorsSeen++; prev = o[k * 6 + 4]; } if (c == 0) prev = -1; }
          check("sky fx: 4 shooting stars a minute averages close to 4 a minute over an hour", Math.abs(meteorsSeen / 60.0 - 4) < 0.6, meteorsSeen / 60.0);
          check("sky fx: shooting stars stay in the sky and fade in and out", inSky);
          check("sky fx: the same seed and time always give the same meteors", SkyFx.meteors(7, 4, 1234.5, 4, o) == SkyFx.meteors(7, 4, 1234.5, 4, new float[24]));
          check("sky fx: a rate of 0 or a budget of 0 draws none", SkyFx.meteors(7, 0, 100, 4, o) == 0 && SkyFx.meteors(7, 30, 100, 0, o) == 0); }
        { float[] o = new float[4]; boolean ok = true; for (int k = 0; k < 200; k++) for (double t = 0; t < 120; t += 0.7) { SkyFx.petal(3, k, t, o); ok &= o[1] <= 1.0001 && o[1] >= -0.1001 && o[3] >= 0 && o[3] <= 1; }
          SkyFx.petal(3, 5, 10, o); float e1 = o[1]; SkyFx.petal(3, 5, 10.5, o);
          check("sky fx: petals fall from the zenith to just below the horizon, fading at both ends", ok && o[1] < e1 || ok && o[1] > 0.9f); }
        { float[] a = new float[4], b2 = new float[4]; SkyFx.cloud(1, 2, 0, a); SkyFx.cloud(1, 2, 60, b2); check("sky fx: clouds drift around the horizon and stay low", b2[0] > a[0] && a[1] < 0.21f && b2[1] == a[1]);
          SkyFx.nebula(1, 2, 0, 0, a); SkyFx.nebula(1, 2, 60, 0, b2); float az0 = a[0], az1 = b2[0]; SkyFx.nebula(1, 2, 60, 2, b2); check("sky fx: nebula holds still at drift 0 and moves with drift", az0 == az1 && b2[0] != az0); }
        check("sky fx: layer 0 at wave 1 is the classic aurora curve; wave 0 is a flat band", Math.abs(SkyFx.auroraWave(1.3, 7, 1, 0, 0.32, 1, 1) - Sky.auroraElevation(1.3, 7, 1, 0.32, 1)) < 1e-12 && SkyFx.auroraWave(1.3, 7, 1, 0, 0.32, 1, 0) == 0.32 && SkyFx.auroraWave(4, 9, 1, 0, 0.32, 1, 0) == 0.32);
        { Sky.StarField f = new Sky.StarField(1337, 1.6, 1); SkyFx.Constellations c1 = new SkyFx.Constellations(f, 9, 6), c2 = new SkyFx.Constellations(f, 9, 6); boolean upper = true; for (int k : c1.pairs) upper &= f.y[k] > 0.3f;
          check("sky fx: constellations link nearby upper-sky stars, deterministically", c1.groups >= 3 && Arrays.equals(c1.pairs, c2.pairs) && upper, c1.groups); }
        check("sky fx: budgets grow from Low to High and Low skips aurora and nebula", SkyFx.budget(Quality.LOW).petals() < SkyFx.budget(Quality.BALANCED).petals() && SkyFx.budget(Quality.BALANCED).petals() < SkyFx.budget(Quality.HIGH).petals()
            && SkyFx.budget(Quality.LOW).auroraLayers() == 0 && SkyFx.budget(Quality.LOW).nebulaBlobs() == 0 && SkyFx.budget(Quality.HIGH).meteors() == 4);
        check("sky fx: sky quality 'auto' follows the client quality, otherwise it's its own", SkyFx.skyQuality("auto", Quality.HIGH) == Quality.HIGH && SkyFx.skyQuality("LOW", Quality.HIGH) == Quality.LOW && SkyFx.skyQuality("auto", null) == Quality.BALANCED);
        check("sky fx: animation speed scales the clock, off holds it at 0, speed is capped at 3", SkyFx.clock(10, 0.5, true) == 5 && SkyFx.clock(10, 9, true) == 30 && SkyFx.clock(10, 1, false) == 0);
        { Config.Registry reg = new Config.Registry(); Config.Module sky = reg.get("sky"); List<String> keys = sky.settings().stream().map(x -> x.key()).toList();
          check("sky fx: the sky module has speed, opacity, meteor, nebula, wave, cloud, petal, constellation and quality settings", keys.containsAll(List.of("animSpeed", "effectsOpacity", "shootingStars", "nebulaSpeed", "auroraWaves", "clouds", "petals", "constellations", "skyQuality")), keys); }
    }
    public static void main(String[] a) throws Exception {
        Path dir = Path.of(a.length > 0 ? a[0] : "../../visuals");
        // JSON
        check("json: nested values, escapes, numbers", Json.parse("{\"a\":[1,-2.5e1,true,null,\"x\\n\\u0041\"],\"b\":{}}").toString().equals("{a=[1.0, -25.0, true, null, x\nA], b={}}"));
        check("json: malformed input and duplicate keys rejected", iae(() -> Json.parse("{\"a\":1,}")) && iae(() -> Json.parse("{\"a\":1,\"a\":2}")) && iae(() -> Json.parse("[1 2]")) && iae(() -> Json.parse("\"open")) && iae(() -> Json.parse("{} x")));
        check("json: deep nesting refused", iae(() -> Json.parse("[".repeat(100) + "]".repeat(100))));
        // themes
        Map<String, Sky.Theme> th = Sky.load(Files.readString(dir.resolve("themes.json")));
        check("themes: file has exactly the eight theme ids the registry offers", new ArrayList<>(th.keySet()).equals(Sky.THEME_IDS), th.keySet());
        check("themes: bad colors and wrong schema are rejected", iae(() -> Sky.hex("#12345")) && iae(() -> Sky.hex("red")) && iae(() -> Sky.load("{\"schema\":2,\"themes\":{}}")));
        // time of day
        check("time: noon is full day, midnight is night", Math.abs(Sky.daylight(6000) - 1) < 1e-9 && Sky.daylight(18000) == 0);
        check("time: sunset glow only around dusk and dawn", Sky.sunsetAmount(6000) == 0 && Sky.sunsetAmount(18000) == 0 && Sky.sunsetAmount(12500) > 0.3 && Sky.sunsetAmount(23500) > 0.3);
        check("time: celestial angle matches Minecraft at sunrise, noon and midnight", Math.abs(Sky.skyAngle(6000)) < 1e-9 && Math.abs(Sky.skyAngle(18000) - 0.5) < 1e-9 && Math.abs(Sky.skyAngle(0) - 0.7842) < 1e-3);
        check("time: negative and huge tick values wrap", Sky.daylight(-18000) == Sky.daylight(6000) && Sky.daylight(6000 + 24000L * 1_000_000) == Sky.daylight(6000));
        Sky.Theme au = th.get("aurora");
        check("color: zenith at noon is the day zenith, horizon at midnight is the night horizon", Sky.skyColor(au, 1, 6000, Sky.Adjust.NONE) == au.day().zenith() && Sky.skyColor(au, 0, 18000, Sky.Adjust.NONE) == au.night().horizon());
        int dusk = Sky.skyColor(au, 0, 12500, Sky.Adjust.NONE), noDusk = Sky.mix(Sky.mix(au.night().horizon(), au.night().zenith(), 0), Sky.mix(au.day().horizon(), au.day().zenith(), 0), Sky.daylight(12500));
        check("color: dusk horizon is pulled toward the sunset color", Math.abs(ch(dusk, 16) - ch(au.day().sunset(), 16)) < Math.abs(ch(noDusk, 16) - ch(au.day().sunset(), 16)));
        check("adjust: identity leaves colors unchanged", Sky.adjust(0x3366CC, Sky.Adjust.NONE) == 0x3366CC && Sky.adjust(0x000000, Sky.Adjust.NONE) == 0 && Sky.adjust(0xFFFFFF, Sky.Adjust.NONE) == 0xFFFFFF);
        check("adjust: zero saturation is grey, full tint is the tint, brightness clamps", isGrey(Sky.adjust(0x3366CC, new Sky.Adjust(1, 0, 1, 0, 0))) && Sky.adjust(0x123456, new Sky.Adjust(1, 1, 1, 0xFF8800, 1)) == 0xFF8800 && Sky.adjust(0xCCCCCC, new Sky.Adjust(2, 1, 1, 0, 0)) == 0xFFFFFF);
        check("theme per dimension: nether and end can stay vanilla", Sky.themeFor("minecraft:overworld", "aurora", "off", "cosmic").equals("aurora") && Sky.themeFor("minecraft:the_nether", "aurora", "off", "cosmic") == null && Sky.themeFor("minecraft:the_end", "aurora", "off", "cosmic").equals("cosmic"));
        // stars
        Sky.StarField f = new Sky.StarField(1337, 1.0, 1.0), g = new Sky.StarField(1337, 1.0, 1.0);
        check("stars: deterministic for a seed and on the unit sphere", f.count == 1500 && Arrays.equals(f.x, g.x) && Arrays.equals(f.phase, g.phase) && onSphere(f));
        check("stars: density scales the count and is capped", new Sky.StarField(1, 2.0, 1).count == 3000 && new Sky.StarField(1, 99, 1).count == 4500 && new Sky.StarField(1, 0, 1).count == 0);
        check("stars: invisible in daylight, twinkle within 0..1 at night", f.brightness(0, 1, 1, 1, 0) == 0 && range(f, 0, 1));
        // dome
        Sky.Dome d = new Sky.Dome(16, 32);
        check("dome: horizon ring at elevation 0, top ring at 1, unit radius", d.elev[0] == 0 && d.elev[d.elev.length - 1] == 1 && Math.abs(d.pos[1]) < 1e-6 && Math.abs(d.pos[d.pos.length - 2] - 1) < 1e-6);
        // quality + particles
        check("quality: presets and parsing", Quality.parse("LOW").particleBudget < Quality.parse("BALANCED").particleBudget && Quality.parse("BALANCED").particleBudget < Quality.parse("HIGH").particleBudget && Quality.parse("ultra") == null && !Quality.LOW.aurora);
        Particles p = new Particles(512, 7); p.setBudget(1000, Quality.BALANCED, 1);
        check("particles: budget is the smallest of capacity, user limit and quality", p.budget() == 256);
        int spawned = 0; for (int k = 0; k < 100; k++) spawned += p.emit(30, 0.1, 0, 64, 0, 0.5f, 1, 1.5f, 1, 0x6FE3FF);
        check("particles: emission never exceeds the budget; fractional rates carry over", spawned == 256 && p.count == 256 && carryOk());
        for (int k = 0; k < 40; k++) p.update(0.05f, 0, 1, 32);
        check("particles: all expire after their lifetime", p.count == 0);
        p.emit(100, 1, 0, 0, 0, 0, 0, 5, 1, 0); int before = p.count; p.update(0.016f, 0, 64, 32);
        check("particles: emitters farther than the limit are dropped", before > 0 && p.count == 0);
        Particles off = new Particles(64, 1); off.enabled = false;
        check("particles: disabled pool spawns and updates nothing", off.emit(100, 1, 0, 0, 0, 0, 0, 1, 1, 0) == 0 && off.update(1, 0, 0, 10) == 0);
        p.setBudget(1000, Quality.HIGH, 1); p.emit(10_000, 1, 0, 0, 0, 0, 0, 5, 1, 0); p.setBudget(1000, Quality.LOW, 1);
        check("particles: lowering the quality trims live particles to the new budget", p.count == 64);
        Particles.Governor gov = new Particles.Governor(60); for (int k = 0; k < 60; k++) gov.update(40); double low = gov.factor(); for (int k = 0; k < 400; k++) gov.update(8);
        check("governor: slow frames cut the budget, fast frames restore it", low < 0.5 && gov.factor() == 1.0, low, gov.factor());
        Particles hot = new Particles(1024, 3); hot.setBudget(1024, Quality.HIGH, 1); int[] tmp = new int[1];
        for (int w = 0; w < 20000; w++) { hot.emit(200, 0.016, 0, 64, 0, 1, 1, 1.5f, 1, 0); hot.update(0.016f, 0.5f, 1, 32); tmp[0] += hot.count; }
        long b0 = alloc(); for (int w = 0; w < 200_000; w++) { hot.emit(200, 0.016, 0, 64, 0, 1, 1, 1.5f, 1, 0); hot.update(0.016f, 0.5f, 1, 32); tmp[0] += hot.count; } long bytes = alloc() - b0;
        Sky.Theme ct = th.get("cosmic"); long b1 = alloc(); long sink = 0; for (int w = 0; w < 200_000; w++) { sink += Sky.skyColor(ct, (w % 17) / 16.0, w * 7L, Sky.Adjust.NONE) + Sky.adjust(w, Sky.Adjust.NONE); sink += (long) (f.brightness(w % f.count, w * 0.016, 1, 1, 1) * 9); } long skyBytes = alloc() - b1;
        check("allocation: particle emit+update and sky color math allocate nothing per frame", bytes < 20_000 && skyBytes < 20_000, bytes, skyBytes, tmp[0] + sink);
        // cosmetics
        Cosmetics.CapeSim c = new Cosmetics.CapeSim(); c.tick(0, 64, 0, 0, false, 0, 0); c.tick(0, 64, 0, 0, false, 0, 0);
        check("cape: standing still rests at 6 degrees", Math.abs(c.swing - 6) < 1e-4);
        for (int k = 0; k < 20; k++) c.tick(0, 64, 0.2 * (k + 1), 0, false, 0, 0); float walking = c.swing;
        check("cape: walking forward (yaw 0 faces +Z) lifts the cape, within limits", walking > 20 && walking <= 6 + 75 + 32, walking);
        c.tick(0, 64, 4.2, 0, true, 0, 0); float sneak = c.swing; Cosmetics.CapeSim c2 = new Cosmetics.CapeSim(); c2.tick(0, 64, 0, 0, false, 0, 0); c2.tick(0, 64, 0, 0, true, 0, 0);
        check("cape: sneaking adds 25 degrees", Math.abs(c2.swing - 31) < 1e-4 && sneak > 25);
        Cosmetics.CapeSim c3 = new Cosmetics.CapeSim(); c3.tick(0, 64, 0, 0, false, 0, 0); c3.tick(500, 64, 0, 0, false, 0, 0);
        check("cape: teleporting snaps instead of whipping", Math.abs(c3.swing - 6) < 1e-4);
        check("cape: accepted image sizes", Cosmetics.capeScale(64, 32) == 1 && Cosmetics.capeScale(128, 64) == 2 && Cosmetics.capeScale(512, 256) == 8 && Cosmetics.capeScale(22, 17) == 0 && iae(() -> Cosmetics.capeScale(64, 64)) && iae(() -> Cosmetics.capeScale(1024, 512)));
        double[] o = new double[5]; Cosmetics.totemPose(0, 0.3, 0.3, o); double s0 = o[2]; Cosmetics.totemPose(1, 0.3, 0.3, o); double s1 = o[2]; double max = 0; for (int k = 0; k <= 40; k++) { Cosmetics.totemPose(k / 40.0, 0, 0, o); max = Math.max(max, o[2]); }
        check("totem pop: starts and ends at rest size, grows in between", Math.abs(s0 - 50) < 1e-9 && Math.abs(s1 - 50) < 1e-6 && max > 150, s0, s1, max);
        // registry
        Config.Registry reg = new Config.Registry();
        check("registry: every visual category has at least one module", Arrays.stream(Config.Category.values()).filter(x -> x.visual).allMatch(x -> reg.modules().stream().anyMatch(m -> m.cat() == x)));
        check("registry: visual modules with in-game code are labelled experimental; the particle system and aura are not claimed", List.of("sky", "totemfx", "glow", "cape").stream().allMatch(id -> reg.get(id).available() && reg.get(id).note().startsWith("Experimental")) && !reg.get("particlefx").available() && !reg.get("aura").available());
        check("registry: capes say they are never visible to other players", reg.get("cape").note().contains("never visible to other players"));
        check("registry: player-control modules are labelled as changing input, visuals as cosmetic", reg.get("zoom").impact() == Config.Impact.INPUT && reg.get("sky").impact() == Config.Impact.COSMETIC && reg.get("fps").impact() == Config.Impact.DISPLAY);
        check("registry: sky settings validate theme names and ranges", reg.validate("sky.theme", "cosmic") == null && reg.validate("sky.theme", "rainbow") != null && reg.validate("sky.netherTheme", "off") == null && reg.validate("sky.brightness", "5") != null && reg.validate("sky.tint", "88AAFF") == null);
        check("registry: quality preset validates", reg.validate("settings.quality", "HIGH") == null && reg.validate("settings.quality", "ULTRA") != null);
        // per-server profiles
        Config.ProfileManager pm = new Config.ProfileManager(reg);
        check("places: server keys are normalised", Config.ProfileManager.placeKey("Play.Example.NET:25565", null).equals("server:play.example.net") && Config.ProfileManager.placeKey(null, "My World").equals("world:My World") && Config.ProfileManager.placeKey(" ", null) == null);
        pm.create("PvP"); pm.switchTo("PvP"); pm.set("sky.theme", "void"); pm.switchTo("Default"); pm.assign("server:play.example.net", "PvP");
        check("places: joining an assigned server uses its profile; leaving restores the default", eq(pm, "aurora") && enter(pm, "server:play.example.net") && eq(pm, "void") && pm.current().equals("PvP") && pm.active().equals("Default") && leave(pm) && eq(pm, "aurora"));
        pm.enterPlace("server:other.net"); check("places: an unassigned server uses the default profile", pm.current().equals("Default")); pm.leavePlace();
        check("places: invalid place keys and unknown profiles are refused", iae(() -> pm.assign("server:../x", "PvP")) && iae(() -> pm.assign("http://x", "PvP")) && iae(() -> pm.assign("server:a.b", "Nope")));
        pm.rename("PvP", "Arena"); check("places: renaming a profile follows its assignments", "Arena".equals(pm.assignments().get("server:play.example.net")));
        Path tmpDir = Files.createTempDirectory("aur-places"); pm.save(tmpDir); Config.ProfileManager pm2 = new Config.ProfileManager(reg); pm2.load(tmpDir);
        check("places: assignments survive a restart", "Arena".equals(pm2.assignments().get("server:play.example.net")));
        Files.writeString(tmpDir.resolve("places.txt"), "server:a.b=Ghost\nnot a line\nworld:ok=Arena\n"); Config.ProfileManager pm3 = new Config.ProfileManager(reg); int skipped = pm3.load(tmpDir);
        check("places: bad lines and missing profiles in places.txt are skipped", pm3.assignments().equals(Map.of("world:ok", "Arena")) && skipped >= 2, pm3.assignments(), skipped);
        pm.delete("Arena"); check("places: deleting a profile removes its assignments", pm.assignments().isEmpty());
        // golden files
        check("golden: visuals/sky-golden.json is up to date (run Golden after changing sky math)", Files.readString(dir.resolve("sky-golden.json")).equals(Golden.sky(th)));
        check("golden: visuals/registry.json is up to date (run Golden after changing modules)", Files.readString(dir.resolve("registry.json")).equals(Golden.registry(reg)));
        check("golden: visuals/adapters.json is up to date (run Golden after changing adapters)", Files.readString(dir.resolve("adapters.json")).equals(Golden.adapters()));
        skyFx(th);
        System.out.println("\n" + pass + " passed, " + fail + " failed"); if (fail > 0) System.exit(1);
    }
    static boolean carryOk() { Particles q = new Particles(100, 1); int s = 0; for (int k = 0; k < 10; k++) s += q.emit(2.5, 0.2, 0, 0, 0, 0, 0, 9, 1, 0); return s == 5; }
    static boolean isGrey(int c) { return ch(c, 16) == ch(c, 8) && ch(c, 8) == ch(c, 0); }
    static boolean onSphere(Sky.StarField f) { for (int k = 0; k < f.count; k++) if (Math.abs(f.x[k] * f.x[k] + f.y[k] * f.y[k] + f.z[k] * f.z[k] - 1) > 1e-5) return false; return true; }
    static boolean range(Sky.StarField f, double lo, double hi) { for (int k = 0; k < f.count; k++) { double b = f.brightness(k, k * 0.37, 1, 1, 1); if (b < lo || b > hi) return false; } return true; }
    static boolean eq(Config.ProfileManager pm, String theme) { return pm.get("sky.theme").equals(theme); }
    static boolean enter(Config.ProfileManager pm, String k) { pm.enterPlace(k); return true; }
    static boolean leave(Config.ProfileManager pm) { pm.leavePlace(); return true; }
}
