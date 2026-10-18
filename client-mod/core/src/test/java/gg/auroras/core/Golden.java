package gg.auroras.core;

import java.nio.file.*;
import java.util.*;

/** Writes visuals/sky-golden.json (values the launcher's visuals.js must reproduce) and visuals/registry.json (module schema for the launcher).
 *  Run: java -cp out gg.auroras.core.Golden <path-to-visuals-folder>   (VisualTests fails if either file is out of date). */
public final class Golden {
    static String n(double d) { return Double.toString(d); }
    static String fl(float[] a, int n) { StringBuilder b = new StringBuilder("["); for (int k = 0; k < n; k++) b.append(k > 0 ? ", " : "").append(a[k]); return b.append("]").toString(); }
    /** Animated-sky cases: hash, meteor schedule, petals, clouds, nebula, layered aurora, constellations and budgets. */
    static String fx(Map<String, Sky.Theme> themes) {
        StringBuilder b = new StringBuilder("{\n");
        b.append("    \"u\": ["); for (int k = 0; k < 12; k++) b.append(k > 0 ? ", " : "").append("[").append(k * 7919 - 30000).append(", ").append(k % 4).append(", ").append(n(SkyFx.u(1234567 * (k - 5), k * 7919 - 30000, k % 4))).append("]"); b.append("],\n");
        float[] out = new float[SkyFx.METEOR_FIELDS * 4]; b.append("    \"meteors\": [");
        boolean first = true; for (double t = 0; t < 90; t += 0.37) { int c = SkyFx.meteors(99, 6, t, 4, out); if (c == 0) continue; b.append(first ? "" : ", ").append("[").append(n(t)).append(", ").append(c).append(", ").append(fl(out, c * SkyFx.METEOR_FIELDS)).append("]"); first = false; }
        int seen = 0; for (double t = 0; t < 600; t += 0.1) seen += SkyFx.meteors(5, 3, t, 4, out) > 0 ? 1 : 0;
        b.append("],\n    \"meteorFrames\": ").append(seen).append(",\n");
        float[] o4 = new float[4]; b.append("    \"petals\": [");
        for (int k = 0; k < 10; k++) { SkyFx.petal(31, k, k * 3.3, o4); b.append(k > 0 ? ", " : "").append("[").append(k).append(", ").append(n(k * 3.3)).append(", ").append(fl(o4, 4)).append("]"); } b.append("],\n");
        b.append("    \"clouds\": ["); for (int k = 0; k < 8; k++) { SkyFx.cloud(17, k, k * 11.0, o4); b.append(k > 0 ? ", " : "").append("[").append(k).append(", ").append(n(k * 11.0)).append(", ").append(fl(o4, 4)).append("]"); } b.append("],\n");
        b.append("    \"cloudColor\": [").append(SkyFx.cloudColor(0xFFC29E, 0x203050, 0)).append(", ").append(SkyFx.cloudColor(0xFFC29E, 0x203050, 0.5)).append(", ").append(SkyFx.cloudColor(0xFFC29E, 0x203050, 1)).append("],\n");
        b.append("    \"nebula\": ["); for (int k = 0; k < 8; k++) { SkyFx.nebula(77, k, k * 9.0, 0.5 + k * 0.25, o4); b.append(k > 0 ? ", " : "").append("[").append(k).append(", ").append(n(k * 9.0)).append(", ").append(n(0.5 + k * 0.25)).append(", ").append(fl(o4, 4)).append("]"); } b.append("],\n");
        b.append("    \"aurora\": ["); for (int k = 0; k < 9; k++) b.append(k > 0 ? ", " : "").append("[").append(n(SkyFx.auroraWave(k * 0.7, k * 2.1, k % 3, k % 3, 0.32, 1.0, k * 0.25))).append(", ").append(n(SkyFx.auroraShimmer(k * 0.7, k * 2.1, k % 3, k % 3, 1.2))).append("]"); b.append("],\n");
        b.append("    \"classicAurora\": ").append(n(SkyFx.auroraWave(1.1, 4.2, 2, 0, 0.32, 1.0, 1.0) - Sky.auroraElevation(1.1, 4.2, 2, 0.32, 1.0))).append(",\n");
        Sky.StarField f = new Sky.StarField(1337, 1.6, 1.0); SkyFx.Constellations cs = new SkyFx.Constellations(f, 4242, 6);
        b.append("    \"constellations\": { \"groups\": ").append(cs.groups).append(", \"pairs\": ").append(Arrays.toString(cs.pairs)).append(", \"groupOf\": ").append(Arrays.toString(cs.groupOf)).append(", \"alpha\": ").append(n(SkyFx.Constellations.alpha(3, 7.5, 0.8))).append(" },\n");
        b.append("    \"budgets\": {"); for (Quality q : Quality.values()) { SkyFx.Budget bu = SkyFx.budget(q); b.append(q.ordinal() > 0 ? ", " : "").append("\"").append(q).append("\": [").append(bu.meteors()).append(", ").append(bu.petals()).append(", ").append(bu.cloudPuffs()).append(", ").append(bu.nebulaBlobs()).append(", ").append(bu.auroraLayers()).append(", ").append(bu.ribbonSteps()).append(", ").append(bu.constellationGroups()).append("]"); } b.append("},\n");
        b.append("    \"themes\": {"); first = true; for (Sky.Theme t : themes.values()) { SkyFx.Fx x = t.fx(); b.append(first ? "" : ", ").append("\"").append(t.id()).append("\": [").append(n(x.meteorsPerMinute())).append(", ").append(n(x.clouds())).append(", ").append(x.cloudColor()).append(", ").append(n(x.petals())).append(", ").append(x.petalColor()).append(", ").append(x.constellations()).append(", ").append(n(x.nebulaDrift())).append(", ").append(x.auroraLayers()).append("]"); first = false; } b.append("},\n");
        b.append("    \"clock\": [").append(n(SkyFx.clock(10, 1.5, true))).append(", ").append(n(SkyFx.clock(10, 9, true))).append(", ").append(n(SkyFx.clock(10, 1, false))).append("]\n  }");
        return b.toString();
    }
    static String da(double[] a) { StringBuilder b = new StringBuilder("["); for (int k = 0; k < a.length; k++) b.append(k > 0 ? ", " : "").append(n(a[k])); return b.append("]").toString(); }
    /** Emote cases: easing, poses of every built-in emote, a controller scenario, wheel slots and validation verdicts. */
    static String emotes(List<Emotes.Emote> lib) {
        StringBuilder b = new StringBuilder("{\n  \"ease\": [");
        for (int e = 0; e < Emotes.EASINGS.size(); e++) for (int k = 0; k <= 8; k++) b.append(e + k > 0 ? ", " : "").append(n(Emotes.ease(e, k / 8.0)));
        b.append("],\n  \"poses\": {"); double[] o = new double[Emotes.N * Emotes.F]; boolean first = true;
        for (Emotes.Emote em : lib) { b.append(first ? "" : ", ").append("\n    \"").append(em.id()).append("\": ["); first = false;
            for (int k = 0; k <= 6; k++) { double t = em.duration() * k / 6.0 + (k == 3 ? 0.013 : 0); Emotes.pose(em, Math.min(t, em.duration()), o); b.append(k > 0 ? ", " : "").append(da(o)); } b.append("]"); }
        b.append("\n  },\n  \"local\": [");
        Emotes.Emote groove = lib.stream().filter(x -> x.id().equals("groove")).findFirst().get(), wave = lib.stream().filter(x -> x.id().equals("wave")).findFirst().get();
        double[] el = {-1, 0, 0.7, 1.6, 2.5, 3.3}; for (int k = 0; k < el.length; k++) b.append(k > 0 ? ", " : "").append("[").append(n(Emotes.localTime(groove, el[k]))).append(", ").append(n(Emotes.localTime(wave, el[k]))).append("]");
        b.append("],\n  \"controller\": [");
        Emotes.Controller c = new Emotes.Controller(); c.setSpeed(1.25); c.setBlend(0.2); double[] w = new double[Emotes.N]; first = true;
        Object[][] script = {{0.0, "play", "groove"}, {0.05, null, null}, {0.3, null, null}, {1.0, "play", "wave"}, {1.08, null, null}, {1.3, null, null}, {2.0, "cancel", null}, {2.05, null, null}, {2.3, null, null}, {3.0, "play", "wave"}, {4.7, null, null}, {4.8, null, null}};
        for (Object[] st : script) { double t = (Double) st[0]; if ("play".equals(st[1])) c.play("groove".equals(st[2]) ? groove : wave, t); else if ("cancel".equals(st[1])) c.cancel(t, "cancelled"); c.update(t); c.sample(t, o, w);
            b.append(first ? "" : ",").append("\n    [").append(n(t)).append(", \"").append(st[1] == null ? "" : st[1]).append("\", \"").append(st[2] == null ? "" : st[2]).append("\", ").append(c.playing()).append(", ").append(c.active(t)).append(", \"").append(c.lastEnd).append("\", ").append(da(o)).append(", ").append(da(w)).append("]"); first = false; }
        b.append("\n  ],\n  \"wheel\": ["); double[][] pts = {{0, -50}, {40, -40}, {50, 0}, {30, 30}, {0, 50}, {-35, 35}, {-50, 0}, {-30, -40}, {3, 4}, {10, -100}, {100, -10}};
        for (int k = 0; k < pts.length; k++) b.append(k > 0 ? ", " : "").append(Emotes.wheelSlot(pts[k][0], pts[k][1], 12));
        b.append("],\n  \"parse\": ["); first = true;
        for (String js : EMOTE_CASES) { boolean ok; try { Emotes.parse(Json.parse(js)); ok = true; } catch (IllegalArgumentException e) { ok = false; } b.append(first ? "" : ",").append("\n    [").append(ok).append(", ").append(q(js)).append("]"); first = false; }
        b.append("\n  ],\n  \"wheelText\": ").append(q(String.join(",", Arrays.stream(Emotes.parseWheel("auroras-wheel=1\nslot1=wave\nslot3=nope\nslot9=wave\nslotx=clap\nslot8 = clap\n", Set.of("wave", "clap"))).map(String::valueOf).toList()))).append("\n}\n");
        return b.toString();
    }
    static final String E0 = "\"id\":\"x\",\"name\":\"X\",\"category\":\"Custom\",\"duration\":1,\"loop\":false,";
    static final List<String> EMOTE_CASES = List.of(
        "{" + E0 + "\"keys\":{\"head\":[{\"t\":0},{\"t\":1,\"p\":20,\"e\":\"sine\"}]}}",
        "{" + E0 + "\"keys\":{\"head\":[{\"t\":0.5},{\"t\":0.5}]}}",
        "{" + E0 + "\"keys\":{\"head\":[{\"t\":1.5}]}}",
        "{" + E0 + "\"keys\":{\"tail\":[{\"t\":0}]}}",
        "{" + E0 + "\"keys\":{\"head\":[{\"t\":0,\"p\":200}]}}",
        "{" + E0 + "\"keys\":{\"root\":[{\"t\":0,\"p\":10}]}}",
        "{" + E0 + "\"keys\":{\"root\":[{\"t\":0,\"oy\":-4}]}}",
        "{" + E0 + "\"keys\":{\"head\":[{\"t\":0,\"oy\":2}]}}",
        "{" + E0 + "\"keys\":{\"head\":[{\"t\":0,\"e\":\"wobble\"}]}}",
        "{" + E0 + "\"keys\":{}}",
        "{" + E0 + "\"keys\":{\"head\":[{\"t\":0}]},\"extra\":1}",
        "{\"id\":\"Bad Id\",\"name\":\"X\",\"category\":\"Custom\",\"duration\":1,\"loop\":false,\"keys\":{\"head\":[{\"t\":0}]}}",
        "{\"id\":\"x\",\"name\":\"X\",\"category\":\"Memes\",\"duration\":1,\"loop\":false,\"keys\":{\"head\":[{\"t\":0}]}}",
        "{\"id\":\"x\",\"name\":\"X\",\"category\":\"Custom\",\"duration\":0.01,\"loop\":false,\"keys\":{\"head\":[{\"t\":0}]}}",
        "{\"id\":\"x\",\"name\":\"X\",\"category\":\"Custom\",\"duration\":1,\"loop\":\"yes\",\"keys\":{\"head\":[{\"t\":0}]}}",
        "{\"id\":\"x\",\"name\":\"\",\"category\":\"Custom\",\"duration\":1,\"loop\":false,\"keys\":{\"head\":[{\"t\":0}]}}");
    public static String sky(Map<String, Sky.Theme> themes) {
        StringBuilder b = new StringBuilder("{\n");
        long[] ticks = {0, 1000, 6000, 11500, 12500, 13000, 18000, 22500, 23500};
        b.append("  \"time\": ["); for (int k = 0; k < ticks.length; k++) b.append(k > 0 ? ", " : "").append("[").append(ticks[k]).append(", ").append(n(Sky.skyAngle(ticks[k]))).append(", ").append(n(Sky.daylight(ticks[k]))).append(", ").append(n(Sky.sunsetAmount(ticks[k]))).append(", ").append(n(Sky.nightAmount(ticks[k]))).append("]"); b.append("],\n");
        double[] elevs = {0, 0.15, 0.5, 1}; long[] ct = {6000, 12500, 18000, 23500};
        Sky.Adjust adj = new Sky.Adjust(1.2, 0.6, 1.1, 0x88AAFF, 0.25);
        b.append("  \"colors\": [");
        boolean first = true;
        for (Sky.Theme t : themes.values()) for (double e : elevs) for (long tk : ct) for (int a = 0; a < 2; a++) {
            b.append(first ? "" : ", ").append("[\"").append(t.id()).append("\", ").append(n(e)).append(", ").append(tk).append(", ").append(a).append(", ").append(Sky.skyColor(t, e, tk, a == 0 ? Sky.Adjust.NONE : adj)).append("]"); first = false; }
        b.append("],\n");
        Sky.Rng r = new Sky.Rng(42); b.append("  \"rng\": ["); for (int k = 0; k < 8; k++) b.append(k > 0 ? ", " : "").append(n(r.next())); b.append("],\n");
        Sky.StarField f = new Sky.StarField(1337, 1.0, 1.0); b.append("  \"stars\": { \"count\": ").append(f.count).append(", \"first\": [");
        for (int k = 0; k < 5; k++) b.append(k > 0 ? ", " : "").append("[").append(f.x[k]).append(", ").append(f.y[k]).append(", ").append(f.z[k]).append(", ").append(f.size[k]).append(", ").append(f.phase[k]).append(", ").append(n(f.brightness(k, 3.5, 1.0, 1.0, 1.0))).append("]");
        b.append("] },\n");
        b.append("  \"aurora\": ["); for (int k = 0; k < 6; k++) b.append(k > 0 ? ", " : "").append(n(Sky.auroraElevation(k * 0.9, k * 1.7, k % 3, 0.32, 1.0))); b.append("],\n");
        b.append("  \"fx\": ").append(fx(themes)).append(",\n");
        Cosmetics.CapeSim c = new Cosmetics.CapeSim(); b.append("  \"cape\": [");
        for (int k = 0; k < 30; k++) { double z = k < 20 ? 0.2 * k : 3.8; c.tick(0, 64, z, 0, k >= 25, k < 20 ? 0.8 : 0, k * 0.6); b.append(k > 0 ? ", " : "").append("[").append(c.swing).append(", ").append(c.sideways).append("]"); }
        b.append("],\n");
        double[] o = new double[5]; b.append("  \"totem\": [");
        double[] ts = {0, 0.1, 0.25, 0.5, 0.75, 1}; for (int k = 0; k < ts.length; k++) { Cosmetics.totemPose(ts[k], 0.3, -0.2, o); b.append(k > 0 ? ", " : "").append("[").append(n(o[0])).append(", ").append(n(o[1])).append(", ").append(n(o[2])).append(", ").append(n(o[3])).append(", ").append(n(o[4])).append("]"); }
        b.append("],\n");
        Config.Registry reg = new Config.Registry(); List<String[]> probes = new ArrayList<>();
        String[] extra = {"", "abc", "1e3", "1.5f", " 1", "0x10", "-0", "+1", "1.", ".5", "999999999999", "true", "FALSE", "#FFFFFF", "ffffff", "GGGGGG", "off", "TL", "XX", "-1", "349", "BALANCED", "HIGH", "ultra"};
        for (Config.Module m : reg.modules()) for (Config.SettingDef d : m.settings()) {
            String k = m.id() + "." + d.key(); probes.add(new String[]{k, d.def()}); probes.add(new String[]{k, Double.toString(d.min())}); probes.add(new String[]{k, Double.toString(d.max())});
            probes.add(new String[]{k, String.valueOf((long) d.max() + 1)}); probes.add(new String[]{k, String.valueOf((long) d.min() - 1)}); if (!d.options().isEmpty()) probes.add(new String[]{k, d.options().get(d.options().size() - 1)});
            if (m.id().equals("fps") || m.id().equals("sky") || m.id().equals("zoom")) for (String x : extra) probes.add(new String[]{k, x});
        }
        for (String k : new String[]{"settings.guiKey", "settings.quality", "settings.other", "nomodule.enabled", "fps.nosetting", "fps", ".enabled"}) for (String x : extra) probes.add(new String[]{k, x});
        probes.add(new String[]{"fps.enabled", "x".repeat(65)}); probes.add(new String[]{"fps.color", "FFFFFF\n"});
        b.append("  \"validation\": [");
        for (int k = 0; k < probes.size(); k++) b.append(k > 0 ? ", " : "").append("[").append(q(probes.get(k)[0])).append(", ").append(q(probes.get(k)[1])).append(", ").append(reg.validate(probes.get(k)[0], probes.get(k)[1]) == null).append("]");
        b.append("]\n}\n");
        return b.toString();
    }
    static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""; }
    public static String registry(Config.Registry reg) {
        StringBuilder b = new StringBuilder("{\n  \"schema\": 1,\n  \"special\": { \"settings.guiKey\": { \"type\": \"KEY\", \"def\": \"344\", \"min\": 0, \"max\": 348 }, \"settings.quality\": { \"type\": \"ENUM\", \"def\": \"BALANCED\", \"options\": [\"LOW\", \"BALANCED\", \"HIGH\"] } },\n  \"modules\": [\n");
        boolean first = true;
        for (Config.Module m : reg.modules()) {
            b.append(first ? "" : ",\n").append("    { \"id\": ").append(q(m.id())).append(", \"name\": ").append(q(m.name())).append(", \"category\": ").append(q(m.cat().label)).append(", \"visual\": ").append(m.cat().visual)
             .append(", \"impact\": ").append(q(m.impact().name())).append(", \"impactLabel\": ").append(q(m.impact().label)).append(", \"available\": ").append(m.available()).append(", \"note\": ").append(q(m.note())).append(", \"settings\": [");
            for (int k = 0; k < m.settings().size(); k++) { Config.SettingDef d = m.settings().get(k);
                b.append(k > 0 ? ", " : "").append("{ \"key\": ").append(q(d.key())).append(", \"type\": ").append(q(d.type().name())).append(", \"def\": ").append(q(d.def())).append(", \"min\": ").append(n(d.min())).append(", \"max\": ").append(n(d.max()));
                if (!d.options().isEmpty()) { b.append(", \"options\": ["); for (int o = 0; o < d.options().size(); o++) b.append(o > 0 ? ", " : "").append(q(d.options().get(o))); b.append("]"); }
                b.append(" }"); }
            b.append("] }"); first = false;
        }
        b.append("\n  ],\n  \"builtIns\": {");
        Config.ProfileManager pm = new Config.ProfileManager(reg); Map<String, String> def = reg.defaults(); boolean f2 = true;
        for (String name : Config.ProfileManager.BUILT_IN) { pm.switchTo(name); b.append(f2 ? " " : ", ").append(q(name)).append(": {"); boolean f3 = true;
            for (Map.Entry<String, String> e : def.entrySet()) if (!pm.get(e.getKey()).equals(e.getValue())) { b.append(f3 ? " " : ", ").append(q(e.getKey())).append(": ").append(q(pm.get(e.getKey()))); f3 = false; }
            b.append(" }"); f2 = false; }
        return b.append(" }\n}\n").toString();
    }
    static String arr(List<String> l) { StringBuilder b = new StringBuilder("["); for (int k = 0; k < l.size(); k++) b.append(k > 0 ? ", " : "").append(l.get(k)); return b.append("]").toString(); }
    /** Values the launcher's HUD editor (visuals.js) must reproduce: every formatter, the animation curves and the layout maths. */
    public static String hud() {
        List<String> f = new ArrayList<>();
        for (String st : new String[]{"minimal", "compact", "expanded"}) for (boolean a : new boolean[]{false, true}) for (boolean m : new boolean[]{false, true}) f.add(arr(List.of(q("fps"), q(st), String.valueOf(a), String.valueOf(m), q(HudKit.fps(144, 137.6, 6.94, a, m, HudKit.Style.of(st))))));
        double[][] cs = {{12.345, 64, -5.55}, {-0.04, 70.5, 1e6}, {0, 0, 0}};
        for (double[] c : cs) for (int d = 0; d <= 2; d++) for (int mask = 0; mask < 8; mask++) f.add(arr(List.of(q("coords"), n(c[0]), n(c[1]), n(c[2]), String.valueOf(d), String.valueOf(mask), q(HudKit.coords(c[0], c[1], c[2], d, (mask & 1) > 0, (mask & 2) > 0, (mask & 4) > 0, mask == 7 ? "NW" : null)))));
        for (String st : new String[]{"minimal", "compact"}) for (boolean r : new boolean[]{false, true}) f.add(arr(List.of(q("cps"), q(st), String.valueOf(r), q(HudKit.cps(11, 4, r, HudKit.Style.of(st))))));
        for (String lay : new String[]{"compact", "expanded"}) for (boolean art : new boolean[]{false, true}) for (boolean pr : new boolean[]{false, true}) { HudKit.SpotifyCard c = HudKit.spotifyCard(lay, art, pr);
            f.add(arr(List.of(q("spotifyCard"), q(lay), String.valueOf(art), String.valueOf(pr), arr(List.of(String.valueOf(c.w()), String.valueOf(c.h()), String.valueOf(c.art()), String.valueOf(c.pad()), String.valueOf(c.textX()), String.valueOf(c.textW()), String.valueOf(c.titleY()), String.valueOf(c.artistY()), String.valueOf(c.barY()), String.valueOf(c.barH()), String.valueOf(c.expanded())))))); }
        for (int tw : new int[]{80, 140, 300}) for (double t : new double[]{0, 1.2, 1.6, 3.3, 7.9, 12.5, 40.25}) for (boolean rm : new boolean[]{false, true}) f.add(arr(List.of(q("marquee"), String.valueOf(tw), n(t), String.valueOf(rm), n(HudKit.marquee(tw, 120, t, 24, 1.5, rm)))));
        for (int[] pd : new int[][]{{0, 0}, {65000, 200000}, {250000, 200000}, {-5, 100}}) f.add(arr(List.of(q("progressFrac"), String.valueOf(pd[0]), String.valueOf(pd[1]), n(HudKit.progressFrac(pd[0], pd[1])))));
        for (int ms : new int[]{-1, 0, 45, 80, 81, 160, 161, 999}) f.add(arr(List.of(q("ping"), String.valueOf(ms), q(HudKit.ping(ms)), String.valueOf(HudKit.pingLevel(ms, 80, 160)))));
        for (int t : new int[]{-1, 0, 19, 20, 1199, 1200, 71999, 72000, 1234567}) f.add(arr(List.of(q("potionTime"), String.valueOf(t), q(HudKit.potionTime(t)))));
        for (int a : new int[]{0, 1, 4, 9, 10, 254}) f.add(arr(List.of(q("potionName"), String.valueOf(a), q(HudKit.potionName("Speed", a)))));
        String[] pn = {"Speed", "Haste", "Night Vision", "Absorption"}; int[] pt = {600, -1, 600, 40};
        for (String mode : new String[]{"duration", "name"}) { int[] o = HudKit.potionOrder(pn, pt, mode); List<String> l = new ArrayList<>(); for (int v : o) l.add(String.valueOf(v)); f.add(arr(List.of(q("potionOrder"), q(mode), arr(l)))); }
        for (String fm : new String[]{"percent", "numeric", "bar"}) for (int[] md : new int[][]{{363, 0}, {363, 200}, {100, 500}, {0, 0}}) f.add(arr(List.of(q("durability"), q(fm), String.valueOf(md[0]), String.valueOf(md[1]), q(HudKit.durability(md[0], md[1], fm)))));
        for (long ms : new long[]{0, 999, 61000, 3723000, -5}) f.add(arr(List.of(q("session"), String.valueOf(ms), q(HudKit.session(ms)))));
        for (int mask = 0; mask < 32; mask++) f.add(arr(List.of(q("sessionInfo"), String.valueOf(mask), q(HudKit.sessionInfo("1.21.4", "Fabric", mask % 3 == 0 ? "" : "Survival", "play.example.net", 754000, (mask & 1) > 0, (mask & 2) > 0, (mask & 4) > 0, (mask & 8) > 0, (mask & 16) > 0)))));
        double[][] tg = {{20, 20, 3.21}, {12.5, 20, -1}, {-1, 20, 7}, {7.25, 40, 0}};
        for (double[] t : tg) for (int mask = 0; mask < 4; mask++) f.add(arr(List.of(q("target"), n(t[0]), n(t[1]), n(t[2]), String.valueOf(mask), q(HudKit.target("Zombie", t[0], t[1], t[2], (mask & 1) > 0, (mask & 2) > 0)))));
        f.add(arr(List.of(q("spotify"), q(HudKit.spotify("Song", "Artist", true, 65000, 200000, true, null)))));
        f.add(arr(List.of(q("spotify"), q(HudKit.spotify("Song", "", false, 0, 0, true, null)))));
        f.add(arr(List.of(q("spotify"), q(HudKit.spotify(null, null, false, 0, 0, true, null)))));
        f.add(arr(List.of(q("spotify"), q(HudKit.spotify("Song", "Artist", true, 1, 2, false, "not connected")))));
        HudKit.Smooth sm = new HudKit.Smooth(); List<String> sv = new ArrayList<>(); sm.update(0, 0.016, 0.15, false); for (int k = 0; k < 20; k++) sv.add(n(sm.update(20, 0.016, 0.15, false))); f.add(arr(List.of(q("smooth"), arr(sv))));
        HudKit.Fade fd = new HudKit.Fade(); List<String> fv = new ArrayList<>(); for (int k = 0; k < 12; k++) fv.add(n(fd.update(k < 8, 0.05, 0.2, false))); f.add(arr(List.of(q("fade"), arr(fv))));
        List<String> kg = new ArrayList<>(); double g = 0; for (int k = 0; k < 10; k++) { g = HudKit.keyGlow(g, k < 2, 0.03, true); kg.add(n(g)); } f.add(arr(List.of(q("keyGlow"), arr(kg))));
        List<HudKit.Entry> es = List.of(new HudKit.Entry("fps", "FPS Counter", "HUD", 70), new HudKit.Entry("zoom", "Zoom", "Player", 30), new HudKit.Entry("sky", "Custom Skies", "World", 70), new HudKit.Entry("clock", "Clock", "HUD", 32));
        for (String srt : new String[]{"length", "name", "category"}) { List<String> l = new ArrayList<>(); for (HudKit.Entry e : HudKit.moduleList(es, srt)) l.add(q(e.id())); f.add(arr(List.of(q("moduleList"), q(srt), arr(l)))); }
        for (String st : new String[]{"minimal", "compact", "expanded"}) { int[] b = HudKit.box(HudKit.Style.of(st), 50, 9); f.add(arr(List.of(q("box"), q(st), String.valueOf(b[0]), String.valueOf(b[1])))); }
        int[][] scr = {{854, 480}, {427, 240}, {640, 480}, {1280, 540}};
        for (int[] sc : scr) for (Hud.Anchor an : Hud.Anchor.values()) for (int[] o : new int[][]{{4, 4}, {-30, 12}, {5000, -5000}}) {
            int[] r = Hud.resolve(new Hud.Placement(an, o[0], o[1]), 80, 13, sc[0], sc[1]); Hud.Placement back = Hud.fromPosition(r[0], r[1], 80, 13, sc[0], sc[1]);
            f.add(arr(List.of(q("resolve"), String.valueOf(sc[0]), String.valueOf(sc[1]), q(an.name()), String.valueOf(o[0]), String.valueOf(o[1]), String.valueOf(r[0]), String.valueOf(r[1]), q(back.anchor().name()), String.valueOf(back.offX()), String.valueOf(back.offY()))));
        }
        int[][] sn = {{423, 100}, {300, 100}, {203, 50}, {849, 470}, {-20, 7}, {398, 233}};
        for (int[] p : sn) { int[] r = Hud.snap(p[0], p[1], 60, 12, 854, 480, 6, List.of(new int[]{200, 300, 100, 20})); f.add(arr(List.of(q("snap"), String.valueOf(p[0]), String.valueOf(p[1]), String.valueOf(r[0]), String.valueOf(r[1])))); }
        for (float[] d : new float[][]{{1, 50}, {1, -100}, {2.9f, 500}, {1.5f, 7}}) f.add(arr(List.of(q("scaleFromDrag"), n(d[0]), String.valueOf((int) d[1]), n(Hud.scaleFromDrag(d[0], (int) d[1], 100)))));
        StringBuilder b = new StringBuilder("{\n  \"cases\": [\n    "); for (int k = 0; k < f.size(); k++) b.append(k > 0 ? ",\n    " : "").append(f.get(k)); return b.append("\n  ]\n}\n").toString();
    }
    /** The adapter table and feature list for the launcher's compatibility matrix. */
    public static String adapters() {
        StringBuilder b = new StringBuilder("{\n  \"schema\": 1,\n  \"features\": [");
        Adapters.Feature[] fs = Adapters.Feature.values();
        for (int k = 0; k < fs.length; k++) b.append(k > 0 ? ", " : "").append("{ \"id\": ").append(q(fs[k].name().toLowerCase())).append(", \"label\": ").append(q(fs[k].label)).append(" }");
        b.append("],\n  \"adapters\": [");
        for (int k = 0; k < Adapters.ALL.size(); k++) { Adapters.Adapter ad = Adapters.ALL.get(k);
            b.append(k > 0 ? ", " : "").append("{ \"id\": ").append(q(ad.id())).append(", \"loader\": ").append(q(ad.loader())).append(", \"min\": ").append(q(ad.min().major() + "." + ad.min().minor() + "." + ad.min().patch()))
             .append(", \"max\": ").append(q(ad.max().major() + "." + ad.max().minor() + "." + ad.max().patch())).append(", \"status\": ").append(q(ad.status().name())).append(", \"features\": [");
            boolean f1 = true; for (Adapters.Feature f : fs) if (ad.has(f)) { b.append(f1 ? "" : ", ").append(q(f.name().toLowerCase())); f1 = false; }
            b.append("], \"note\": ").append(q(ad.note())).append(" }"); }
        return b.append("]\n}\n").toString();
    }
    public static void main(String[] a) throws Exception {
        Path dir = Path.of(a[0]); Map<String, Sky.Theme> themes = Sky.load(Files.readString(dir.resolve("themes.json")));
        Files.writeString(dir.resolve("emote-golden.json"), emotes(Emotes.parseLibrary(Files.readString(dir.resolve("emotes.json")))));
        Files.writeString(dir.resolve("sky-golden.json"), sky(themes)); Files.writeString(dir.resolve("registry.json"), registry(new Config.Registry()));
        Files.writeString(dir.resolve("adapters.json"), adapters());
        Files.writeString(dir.resolve("hud-golden.json"), hud());
        System.out.println("wrote sky-golden.json and registry.json");
    }
}
