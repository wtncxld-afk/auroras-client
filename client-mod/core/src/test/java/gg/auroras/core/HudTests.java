package gg.auroras.core;

import java.nio.file.*;
import java.util.*;

/** Run from client-mod/core: java -cp out gg.auroras.core.HudTests ../../visuals */
public final class HudTests {
    static int pass, fail;
    static void check(String n, boolean ok, Object... info) { if (ok) pass++; else fail++; System.out.println((ok ? "PASS  " : "FAIL  ") + n + (ok || info.length == 0 ? "" : "  " + Arrays.toString(info))); }
    static boolean iae(Runnable r) { try { r.run(); return false; } catch (IllegalArgumentException e) { return true; } }
    public static void main(String[] a) throws Exception {
        Path dir = Path.of(a.length > 0 ? a[0] : "../../visuals");
        check("fps: minimal, compact and detailed forms", HudKit.fps(144, 0, 0, false, false, HudKit.Style.MINIMAL).equals("FPS 144") && HudKit.fps(144, 0, 0, false, false, HudKit.Style.COMPACT).equals("144 fps") && HudKit.fps(144, 137.6, 6.94, true, true, HudKit.Style.EXPANDED).equals("FPS 144 · avg 138 · 6.9 ms"));
        check("coords: axis visibility and direction", HudKit.coords(12.345, 64, -5.55, 1, true, false, true, "N").startsWith("X 12.3  Z -5.") && HudKit.coords(1, 2, 3, 0, false, false, false, null).equals("—") && HudKit.coords(-0.04, 0, 0, 1, true, false, false, null).equals("X 0.0"));
        check("cps: compact and right-click forms", HudKit.cps(11, 4, true, HudKit.Style.MINIMAL).equals("CPS 11 | 4") && HudKit.cps(11, 4, false, HudKit.Style.COMPACT).equals("11"));
        check("ping: unknown latency is never shown as a number", HudKit.ping(-1).equals("Ping n/a") && HudKit.pingLevel(-1, 80, 160) == -1 && HudKit.ping(0).equals("Ping 0 ms"));
        check("ping: color thresholds", HudKit.pingLevel(80, 80, 160) == 0 && HudKit.pingLevel(81, 80, 160) == 1 && HudKit.pingLevel(161, 80, 160) == 2);
        check("potions: time formats including infinite and hours", HudKit.potionTime(-1).equals("∞") && HudKit.potionTime(19).equals("0:00") && HudKit.potionTime(1200).equals("1:00") && HudKit.potionTime(72000).equals("1:00:00"));
        check("potions: level names", HudKit.potionName("Speed", 0).equals("Speed") && HudKit.potionName("Speed", 1).equals("Speed II") && HudKit.potionName("Speed", 10).equals("Speed 11"));
        check("potions: ordering by time puts infinite last; by name is alphabetical", Arrays.toString(HudKit.potionOrder(new String[]{"Speed", "Haste", "Night Vision", "Absorption"}, new int[]{600, -1, 600, 40}, "duration")).equals("[3, 2, 0, 1]")
            && Arrays.toString(HudKit.potionOrder(new String[]{"Speed", "Haste", "Night Vision", "Absorption"}, new int[]{600, -1, 600, 40}, "name")).equals("[3, 1, 2, 0]"));
        check("durability: percent, numeric, empty slot", HudKit.durability(363, 200, "percent").equals("45%") && HudKit.durability(363, 200, "numeric").equals("163/363") && HudKit.durability(0, 0, "percent").isEmpty() && HudKit.durability(100, 500, "numeric").equals("0/100"));
        check("session: duration and info line skip missing parts", HudKit.session(3723000).equals("1:02:03") && HudKit.session(-5).equals("0:00:00")
            && HudKit.sessionInfo("1.21.4", "Fabric", "", null, 61000, true, true, true, true, true).equals("1.21.4 · Fabric · 0:01:01") && HudKit.sessionInfo("1.21.4", "Fabric", "S", "x", 0, false, false, false, false, false).equals("—"));
        check("target: health only when known", HudKit.target("Zombie", 12.5, 20, -1, true, false).equals("Zombie  12.5 / 20 ♥") && HudKit.target("Zombie", -1, 20, 3.21, true, true).equals("Zombie  3.2 m"));
        check("spotify: shows what the integration supplied, or why it can't", HudKit.spotify("Song", "Artist", true, 65000, 200000, true, null).equals("▶ Song — Artist  1:05 / 3:20") && HudKit.spotify(null, null, false, 0, 0, true, null).equals("Spotify: nothing playing")
            && HudKit.spotify("Song", "Artist", true, 1, 2, true, "not connected").equals("Spotify: not connected"));
        HudKit.Smooth s = new HudKit.Smooth(); s.update(0, 0.016, 0.15, false); double half = 0; for (int k = 0; k < 7; k++) half = s.update(20, 0.016, 0.15, false);
        HudKit.Smooth s2 = new HudKit.Smooth(); s2.update(0, 0.016, 0.15, false); double big = s2.update(20, 0.112, 0.15, false);
        check("smooth: frame-rate independent (7 small steps equal one big step)", Math.abs(half - big) < 1e-9, half, big);
        for (int k = 0; k < 200; k++) s.update(20, 0.016, 0.15, false); check("smooth: settles exactly on target; reduced motion jumps", s.value == 20 && new HudKit.Smooth().update(5, 0.016, 0.15, true) == 5);
        HudKit.Fade f = new HudKit.Fade(); for (int k = 0; k < 3; k++) f.update(true, 0.05, 0.2, false);
        check("fade: rises over its duration, clamps, and falls", Math.abs(f.alpha - 0.75) < 1e-9 && f.update(true, 1, 0.2, false) == 1 && f.update(false, 0.1, 0.2, false) == 0.5 && new HudKit.Fade().update(true, 0, 0.2, true) == 1);
        check("key glow: instant on press, 120 ms fade, no fade when animation is off", HudKit.keyGlow(0, true, 0.016, true) == 1 && Math.abs(HudKit.keyGlow(1, false, 0.06, true) - 0.5) < 1e-9 && HudKit.keyGlow(1, false, 0.016, false) == 0);
        List<HudKit.Entry> es = List.of(new HudKit.Entry("fps", "FPS Counter", "HUD", 70), new HudKit.Entry("zoom", "Zoom", "Player", 30), new HudKit.Entry("sky", "Custom Skies", "World", 70));
        check("module list: by length (ties by name), name, category", HudKit.moduleList(es, "length").stream().map(HudKit.Entry::id).toList().equals(List.of("sky", "fps", "zoom"))
            && HudKit.moduleList(es, "name").stream().map(HudKit.Entry::id).toList().equals(List.of("sky", "fps", "zoom")) && HudKit.moduleList(es, "category").stream().map(HudKit.Entry::id).toList().equals(List.of("fps", "zoom", "sky")));
        check("module list: right-aligned lines hug the right edge", HudKit.lineX(100, 80, 30, true) == 150 && HudKit.lineX(100, 80, 30, false) == 100);
        check("styles: box sizes and colors", Arrays.equals(HudKit.box(HudKit.Style.EXPANDED, 50, 9), new int[]{62, 15}) && HudKit.argb(0x101820, 50, 1) == 0x80101820 && HudKit.argb(0xFFFFFF, 100, 0) == 0x00FFFFFF);
        Config.Registry reg = new Config.Registry(); Config.ProfileManager pm = new Config.ProfileManager(reg);
        pm.set("fps.offX", "120"); pm.set("fps.style", "expanded"); pm.setEnabled("clock", true);
        Map<String, String> lay = HudKit.captureLayout(reg, pm);
        check("layouts: capture holds every on-screen element's placement and style, nothing else", lay.get("fps.offX").equals("120") && lay.get("fps.style").equals("expanded") && lay.get("clock.enabled").equals("true") && lay.keySet().stream().allMatch(k -> HudKit.positionable(reg.get(k.substring(0, k.indexOf('.'))))) && lay.containsKey("memory.anchor") && !lay.containsKey("zoom.enabled") && !lay.containsKey("fps.showAverage"));
        String txt = HudKit.exportLayout("Arena", lay); Config.ProfileManager pm2 = new Config.ProfileManager(reg); HudKit.applyLayout(pm2, HudKit.importLayout(reg, txt));
        check("layouts: export/import round trip applies to another profile", pm2.get("fps.offX").equals("120") && pm2.get("clock.enabled").equals("true") && pm2.get("fps.style").equals("expanded"));
        check("layouts: imports are validated (non-HUD keys, bad values, wrong header refused)", iae(() -> HudKit.importLayout(reg, "auroras-hudlayout=1\nname=x\nsky.theme=void\n")) && iae(() -> HudKit.importLayout(reg, "auroras-hudlayout=1\nname=x\nfps.scale=9\n"))
            && iae(() -> HudKit.importLayout(reg, "hello\nname=x\n")) && iae(() -> HudKit.importLayout(reg, "auroras-hudlayout=1\nname=x\nfps.showAverage=true\n")));
        Map<String, String> r = HudKit.resetElement(reg, "fps");
        check("layouts: reset element returns the default placement", r.equals(Map.of("fps.anchor", "TL", "fps.offX", "4", "fps.offY", "20", "fps.scale", "1.0")) && iae(() -> HudKit.resetElement(reg, "sky")));
        Path tmp = Files.createTempDirectory("aur-lay"); HudKit.saveLayout(tmp, "Arena 2", lay); Files.writeString(tmp.resolve("hud-layouts").resolve("bad.txt"), "junk");
        Map<String, Map<String, String>> all = HudKit.loadLayouts(reg, tmp);
        check("layouts: saved presets reload; junk files are skipped; bad names refused", all.keySet().equals(Set.of("Arena 2")) && all.get("Arena 2").equals(lay) && iae(() -> { try { HudKit.saveLayout(tmp, "../x", lay); } catch (java.io.IOException e) { throw new RuntimeException(e); } }));
        check("defaults: right-anchored elements sit 4 px in from the right edge, centred ones are centred", reg.get("clock").setting("offX").def().equals("-4") && reg.get("target").setting("offX").def().equals("0") && reg.get("fps").setting("offX").def().equals("4"));
        { Config.ProfileManager pmAll = new Config.ProfileManager(reg); List<int[]> boxes = new ArrayList<>(); List<String> ids = new ArrayList<>(); int sw = 427, sh = 240;
          for (String id : List.of("brandinghud", "fps", "coords", "cps", "ping", "clock", "potions", "target", "sessioninfo", "spotify", "keystrokes", "armor")) {
            int w = id.equals("keystrokes") ? 68 : id.equals("armor") ? 70 : 90, h = id.equals("keystrokes") ? 82 : id.equals("armor") ? 44 : id.equals("potions") ? 33 : 13;
            boxes.add(Hud.resolve(new Hud.Placement(Hud.Anchor.valueOf(pmAll.get(id + ".anchor")), Integer.parseInt(pmAll.get(id + ".offX")), Integer.parseInt(pmAll.get(id + ".offY"))), w, h, sw, sh)); ids.add(id + ":" + w + "x" + h); }
          String clash = null; for (int i = 0; i < boxes.size(); i++) for (int j = i + 1; j < boxes.size(); j++) { int[] A = boxes.get(i), B = boxes.get(j); int wa = Integer.parseInt(ids.get(i).replaceAll(".*:(\\d+)x.*", "$1")), ha = Integer.parseInt(ids.get(i).replaceAll(".*x", "")), wb = Integer.parseInt(ids.get(j).replaceAll(".*:(\\d+)x.*", "$1")), hb = Integer.parseInt(ids.get(j).replaceAll(".*x", ""));
            if (A[0] < B[0] + wb && B[0] < A[0] + wa && A[1] < B[1] + hb && B[1] < A[1] + ha) clash = ids.get(i) + " / " + ids.get(j); }
          check("defaults: typical elements don't overlap at the smallest common GUI size (427x240)", clash == null, clash); }
        NowPlaying.Snap np = NowPlaying.parse("{\"status\":\"\",\"title\":\"Song \\\"Live\\\"\",\"artist\":\"A, B\",\"playing\":true,\"progressMs\":65000,\"durationMs\":200000,\"at\":5}");
        check("now playing: the mod reads the launcher's file, including escaped quotes", np.title().equals("Song \"Live\"") && np.artist().equals("A, B") && np.playing() && np.durationMs() == 200000 && np.progressNow(2005) == 67000, np);
        check("now playing: progress stops at the end and doesn't move while paused", np.progressNow(10_000_000) == 200000 && NowPlaying.parse("{\"playing\":false,\"progressMs\":10,\"durationMs\":99,\"at\":0}").progressNow(5000) == 10);
        check("now playing: oversized files are refused", NowPlaying.parse("{\"title\":\"" + "x".repeat(9000) + "\"}").status().equals("unavailable"));
        check("golden: visuals/hud-golden.json is up to date (run Golden after changing HUD code)", Files.readString(dir.resolve("hud-golden.json")).equals(Golden.hud()));
        System.out.println("\n" + pass + " passed, " + fail + " failed"); if (fail > 0) System.exit(1);
    }
}
