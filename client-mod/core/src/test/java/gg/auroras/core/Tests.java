package gg.auroras.core;

import java.nio.file.*;
import java.util.*;

public final class Tests {
    static int pass, fail;
    static void check(String name, boolean ok) { if (ok) pass++; else fail++; System.out.println((ok ? "PASS  " : "FAIL  ") + name); }
    static boolean throwsIAE(Runnable r) { try { r.run(); return false; } catch (IllegalArgumentException e) { return true; } }

    public static void main(String[] a) throws Exception {
        // CPS
        Calc.CpsCounter c = new Calc.CpsCounter(1000);
        for (int i = 0; i < 10; i++) c.click(i * 100L);
        check("cps: 10 clicks in 1s window = 10", c.cps(999) == 10);
        check("cps: clicks expire after the window", c.cps(2500) == 0);
        Calc.CpsCounter half = new Calc.CpsCounter(500); for (int i = 0; i < 5; i++) half.click(i * 100L);
        check("cps: 500ms window normalises to per-second", half.cps(450) == 10);
        c.reset(); check("cps: reset clears", c.cps(0) == 0);
        check("cps: rejects absurd window", throwsIAE(() -> new Calc.CpsCounter(5)));
        // FPS
        Calc.FpsSmoother f = new Calc.FpsSmoother(500); long t = 0, step = 16_666_667L;
        for (int i = 0; i < 90; i++) { f.frame(t); t += step; }
        check("fps: 60 fps frames report ~60", Math.abs(f.fps() - 60) <= 1);
        check("fps: frame time ~16.7ms", Math.abs(f.frameTimeMs() - 16.67) < 0.5);
        Calc.FpsSmoother slow = new Calc.FpsSmoother(500); t = 0; for (int i = 0; i < 40; i++) { slow.frame(t); t += 50_000_000L; }
        check("fps: 20 fps frames report ~20", Math.abs(slow.fps() - 20) <= 1);
        // clock
        check("clock: 24h", Calc.clock(15, 7, 9, true, false).equals("15:07"));
        check("clock: 24h seconds", Calc.clock(5, 7, 9, true, true).equals("05:07:09"));
        check("clock: 12h pm", Calc.clock(15, 7, 9, false, false).equals("3:07 PM"));
        check("clock: midnight is 12 AM", Calc.clock(0, 0, 0, false, true).equals("12:00:00 AM"));
        check("clock: noon is 12 PM", Calc.clock(12, 30, 0, false, false).equals("12:30 PM"));
        check("clock: rejects bad time", throwsIAE(() -> Calc.clock(24, 0, 0, true, false)));
        // coords + direction
        check("coords: formatting", Calc.coords(12.345, 64, -5.55, 1, "N").equals("XYZ: 12.3 64.0 -5.5 (N)") || Calc.coords(12.345, 64, -5.55, 1, "N").equals("XYZ: 12.3 64.0 -5.6 (N)"));
        check("coords: no negative zero", Calc.coords(-0.04, 0, 0.0, 1, null).equals("XYZ: 0.0 0.0 0.0"));
        check("coords: zero decimals", Calc.coords(1.6, 2.4, 3.5, 0, null).startsWith("XYZ: 2 2 "));
        check("direction: yaw 0 = S, 90 = W, 180 = N, -90 = E", Calc.compass(0).equals("S") && Calc.compass(90).equals("W") && Calc.compass(180).equals("N") && Calc.compass(-90).equals("E"));
        check("direction: wraps large and negative yaw", Calc.compass(450).equals("W") && Calc.compass(-270).equals("W"));
        // armor
        check("armor: 100% when undamaged", Calc.armorPercent(363, 0) == 100);
        check("armor: half damaged", Calc.armorPercent(100, 50) == 50);
        check("armor: damage beyond max clamps to 0", Calc.armorPercent(100, 500) == 0);
        check("armor: empty/unbreakable slot is -1", Calc.armorPercent(0, 0) == -1);
        check("armor: colours by threshold", Calc.armorColor(80) == 0x55FF55 && Calc.armorColor(40) == 0xFFFF55 && Calc.armorColor(10) == 0xFF5555 && Calc.armorColor(-1) == 0xAAAAAA);
        // zoom
        Calc.Zoom z = new Calc.Zoom(4.0, 0.3);
        check("zoom: inactive before pressing", !z.active() && z.fovMultiplier() == 1.0);
        for (int i = 0; i < 60; i++) z.tick(true);
        check("zoom: converges to 1/factor while held", Math.abs(z.fovMultiplier() - 0.25) < 0.01 && z.active());
        check("zoom: sensitivity scales down while zoomed", z.sensitivityScale() < 0.3);
        for (int i = 0; i < 80; i++) z.tick(false);
        check("zoom: exactly restores FOV on release", z.fovMultiplier() == 1.0 && !z.active());
        check("zoom: rejects invalid factor", throwsIAE(() -> new Calc.Zoom(0.5, 0.2)));
        // sprint
        Calc.SprintToggle s = new Calc.SprintToggle();
        check("sprint: off by default", !s.update(false, true, false, true));
        check("sprint: toggles on with key edge and sprints while walking forward", s.update(true, true, false, true) && s.on());
        check("sprint: holding the key does not re-toggle", s.update(true, true, false, true));
        s.update(false, true, false, true);
        check("sprint: sneaking stops sprint", !s.update(false, true, true, true));
        check("sprint: no sprint without forward input", !s.update(false, false, false, true));
        check("sprint: server/hunger restriction respected", !s.update(false, true, false, false));
        s.update(true, true, false, true); check("sprint: second press toggles off", !s.on());
        // keybind conflicts
        Map<String, Integer> kb = new HashMap<>(Map.of("key.jump", 32, "key.sneak", 340, "auroras.coords", 67));
        check("keybind: detects conflict", Calc.keyConflicts(kb, "auroras.zoom", 32).equals(List.of("key.jump")));
        check("keybind: own binding is not a conflict", Calc.keyConflicts(kb, "auroras.coords", 67).isEmpty());
        check("keybind: unbound never conflicts", Calc.keyConflicts(kb, "x", -1).isEmpty());
        // HUD maths
        int sw = 854, sh = 480;
        for (Hud.Anchor an : Hud.Anchor.values()) {
            Hud.Placement p = new Hud.Placement(an, 3, -2); int[] pos = Hud.resolve(p, 100, 20, sw, sh);
            Hud.Placement back = Hud.fromPosition(pos[0], pos[1], 100, 20, sw, sh); int[] pos2 = Hud.resolve(back, 100, 20, sw, sh);
            check("hud: position round-trips for anchor " + an, pos[0] == pos2[0] && pos[1] == pos2[1]);
        }
        check("hud: top-right anchor hugs the right edge", Hud.resolve(new Hud.Placement(Hud.Anchor.TR, 0, 0), 100, 20, sw, sh)[0] == sw - 100);
        check("hud: elements are clamped on screen after a resolution change", Hud.resolve(new Hud.Placement(Hud.Anchor.TL, 5000, 5000), 100, 20, 320, 240)[0] == 220);
        check("hud: snaps centre to screen centre", Hud.snap(sw / 2 - 50 + 4, 100, 100, 20, sw, sh, 6, List.of())[0] == sw / 2 - 50);
        check("hud: does not snap beyond threshold", Hud.snap(300, 100, 100, 20, sw, sh, 6, List.of())[0] == 300);
        check("hud: snaps to another element's edge", Hud.snap(203, 100, 100, 20, sw, sh, 6, List.of(new int[]{200, 300, 100, 20}))[0] == 200);
        check("hud: drag-resize grows and clamps scale", Hud.scaleFromDrag(1.0f, 50, 100) == 1.5f && Hud.scaleFromDrag(2.9f, 500, 100) == 3.0f && Hud.scaleFromDrag(0.6f, -500, 100) == 0.5f);
        check("hud: scaled size never below 1", Hud.scaled(1, 0.1f) == 1 && Hud.scaled(100, 1.5f) == 150);
        // modules + profiles
        Config.Registry reg = new Config.Registry(); Config.ProfileManager pm = new Config.ProfileManager(reg);
        check("registry: required HUD modules present", List.of("fps", "coords", "keystrokes", "cps", "armor", "clock").stream().allMatch(id -> reg.get(id) != null));
        check("registry: the in-world cosmetics are available, labelled experimental, and say they are local only or never through walls", List.of("damage", "aura", "nameplate", "emblem", "trails", "particlefx").stream().allMatch(id -> reg.get(id).available() && reg.get(id).note().startsWith("Experimental"))
            && List.of("aura", "emblem", "trails").stream().allMatch(id -> reg.get(id).note().contains("Only you see")) && List.of("damage", "nameplate").stream().allMatch(id -> reg.get(id).note().contains("never through walls")));
        check("registry: player, rendering and information modules are available and labelled experimental", List.of("zoom", "sprint", "sneak", "freelook", "perspective", "direction", "freelookstatus", "crosshair", "fullbright", "particles", "serverinfo", "memory", "biome", "frametime", "session").stream().allMatch(id -> reg.get(id).available() && reg.get(id).note().startsWith("Experimental")));
        check("registry: modules with in-game code are labelled experimental", List.of("fps", "coords", "keystrokes", "cps", "armor", "clock", "ping", "potions", "target", "sessioninfo", "spotify", "modulelist", "brandinghud").stream().allMatch(id -> reg.get(id).available() && reg.get(id).note().startsWith("Experimental")));
        check("registry: modules with in-game code are flagged experimental until tested in a real game", reg.get("fps").available() && reg.get("fps").note().startsWith("Experimental"));
        check("modules: enable and disable an available module", !pm.enabled("fps") && runOk(() -> pm.setEnabled("fps", true)) && pm.enabled("fps") && runOk(() -> pm.setEnabled("fps", false)) && !pm.enabled("fps"));
        { Config.Registry locked = new Config.Registry(); locked.restrict(List.of("aura"), "Not in this build"); Config.ProfileManager lp = new Config.ProfileManager(locked);
          check("modules: unavailable modules cannot be enabled", throwsIAE(() -> lp.setEnabled("aura", true)) && !locked.get("aura").available() && locked.get("aura").note().equals("Not in this build")); }
        check("settings: rejects out-of-range scale", throwsIAE(() -> pm.set("fps.scale", "99")));
        check("settings: rejects bad colour", throwsIAE(() -> pm.set("fps.color", "red")));
        check("settings: accepts valid colour and number", runOk(() -> { pm.set("fps.color", "FF00AA"); pm.set("fps.scale", "1.5"); }) && pm.get("fps.scale").equals("1.5"));
        check("settings: GUI key defaults to Right Shift (344)", pm.get("settings.guiKey").equals("344"));
        check("profiles: built-ins exist; Minimal HUD enables only fps", pm.names().containsAll(Config.ProfileManager.BUILT_IN));
        pm.switchTo("Minimal HUD"); check("profiles: switching changes enabled modules", pm.enabled("fps") && !pm.enabled("coords"));
        pm.switchTo("Default");
        pm.create("Mine"); pm.switchTo("Mine"); pm.setEnabled("clock", true); pm.set("clock.h24", "false");
        check("profiles: create + edit isolated from Default", pm.enabled("clock")); pm.switchTo("Default"); check("profiles: Default unaffected", !pm.enabled("clock"));
        pm.duplicate("Mine", "Mine copy"); pm.switchTo("Mine copy"); check("profiles: duplicate copies settings", pm.enabled("clock") && pm.get("clock.h24").equals("false"));
        pm.rename("Mine copy", "Renamed"); check("profiles: rename keeps active + settings", pm.active().equals("Renamed") && pm.enabled("clock"));
        check("profiles: built-ins cannot be renamed or deleted", throwsIAE(() -> pm.rename("Default", "X")) && throwsIAE(() -> pm.delete("Casual")));
        check("profiles: bad names rejected", throwsIAE(() -> pm.create("../evil")) && throwsIAE(() -> pm.create("")));
        pm.delete("Renamed"); check("profiles: deleting active falls back to Default", pm.active().equals("Default") && !pm.names().contains("Renamed"));
        // export / import
        pm.switchTo("Mine"); String exported = pm.export("Mine");
        Config.ProfileManager other = new Config.ProfileManager(reg); Config.Profile imp = other.importProfile(exported);
        other.switchTo(imp.name); check("import: export/import round-trips settings", other.enabled("clock") && other.get("clock.h24").equals("false"));
        check("import: name collision gets a new name instead of overwriting", other.importProfile(exported).name.equals("Mine 2"));
        check("import: rejects wrong header", throwsIAE(() -> other.importProfile("hello\nname=x\n")));
        check("import: rejects unknown setting", throwsIAE(() -> other.importProfile("auroras-profile=1\nname=Evil\nfps.bogus=1\n")));
        check("import: rejects out-of-range value", throwsIAE(() -> other.importProfile("auroras-profile=1\nname=Evil\nfps.scale=500\n")));
        check("import: rejects path-like name", throwsIAE(() -> other.importProfile("auroras-profile=1\nname=../../x\n")));
        check("import: rejects oversized file", throwsIAE(() -> other.importProfile("auroras-profile=1\nname=x\n" + "a".repeat(70000))));
        check("import: failed import leaves no partial profile", !other.names().contains("Evil"));
        // persistence
        Path dir = Files.createTempDirectory("auroras-test");
        pm.switchTo("Mine"); pm.set("coords.decimals", "2"); pm.save(dir);
        Config.ProfileManager reloaded = new Config.ProfileManager(reg); int skipped = reloaded.load(dir);
        check("persistence: profiles reload with active profile and settings", skipped == 0 && reloaded.active().equals("Mine") && reloaded.get("coords.decimals").equals("2") && reloaded.enabled("clock"));
        Files.writeString(dir.resolve("profile-Broken.txt"), "auroras-profile=1\nname=Broken\nfps.scale=999\n");
        Config.ProfileManager again = new Config.ProfileManager(reg);
        check("persistence: a bad value in a saved file is skipped and counted; the rest of that profile still loads", again.load(dir) == 0 && again.names().contains("Broken") && again.skippedLines == 1);
        again.switchTo("Broken"); check("persistence: the skipped value falls back to its default", again.get("fps.scale").equals("1.0"));
        Files.writeString(dir.resolve("profile-Junk.txt"), "not a profile at all\n"); Config.ProfileManager third = new Config.ProfileManager(reg);
        check("persistence: a file that isn't a profile is skipped whole", third.load(dir) == 1 && !third.names().contains("Junk"));
        // migration from format 1
        Config.ProfileManager mig = new Config.ProfileManager(reg); Config.Profile old = mig.importProfile("auroras-profile=1\nname=Old\nbranding.enabled=true\nfps.enabled=true\n");
        mig.switchTo(old.name); check("migration: format-1 files load and renamed keys move to their new name", mig.get("brandinghud.enabled").equals("true") && mig.get("fps.enabled").equals("true"));
        check("migration: files are written in the current format", mig.export("Old").startsWith("auroras-profile=2\n"));
        check("migration: unknown future formats are refused", throwsIAE(() -> mig.importProfile("auroras-profile=3\nname=X\n")));
        check("import from the user stays strict: one bad line rejects the file", throwsIAE(() -> mig.importProfile("auroras-profile=2\nname=Y\nfps.scale=999\n")));

        System.out.println("\n" + pass + " passed, " + fail + " failed");
        if (fail > 0) System.exit(1);
    }
    static boolean runOk(Runnable r) { try { r.run(); return true; } catch (RuntimeException e) { System.out.println("  unexpected: " + e.getMessage()); return false; } }
}
