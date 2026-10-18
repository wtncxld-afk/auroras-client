package gg.auroras.core;

import java.lang.management.ManagementFactory;
import java.nio.file.*;
import java.util.*;

/** Emote format, sampling, controller, wheel and custom-emote loading. Run: java -cp out gg.auroras.core.EmoteTests ../../visuals */
public class EmoteTests {
    static int pass, fail;
    static void check(String n, boolean ok, Object... info) { if (ok) pass++; else fail++; System.out.println((ok ? "PASS  " : "FAIL  ") + n + (ok || info.length == 0 ? "" : "  " + Arrays.toString(info))); }
    static boolean iae(Runnable r) { try { r.run(); return false; } catch (IllegalArgumentException e) { return true; } }
    static String msg(Runnable r) { try { r.run(); return ""; } catch (IllegalArgumentException e) { return e.getMessage(); } }
    static long allocated() { return ((com.sun.management.ThreadMXBean) ManagementFactory.getThreadMXBean()).getThreadAllocatedBytes(Thread.currentThread().threadId()); }

    public static void main(String[] a) throws Exception {
        Path dir = Path.of(a.length > 0 ? a[0] : "../../visuals");
        List<Emotes.Emote> lib = Emotes.parseLibrary(Files.readString(dir.resolve("emotes.json"))); Map<String, Emotes.Emote> by = new HashMap<>(); for (Emotes.Emote e : lib) by.put(e.id(), e);
        check("library: loads 14 emotes across Greetings, Celebrate, Dance and Reactions", lib.size() == 14 && lib.stream().map(Emotes.Emote::category).distinct().count() == 4, lib.size());
        check("library: duplicate ids are refused", iae(() -> Emotes.parseLibrary("{\"schema\":1,\"emotes\":[" + E("a") + "," + E("a") + "]}")));
        // easing
        boolean ends = true; for (int e = 0; e < Emotes.EASINGS.size(); e++) ends &= Math.abs(Emotes.ease(e, 0)) < 1e-12 && Math.abs(Emotes.ease(e, 1) - 1) < 1e-12;
        check("easing: every curve starts at 0 and ends at 1; step holds until the end; back overshoots", ends && Emotes.ease(5, 0.99) == 0 && maxOf(6) > 1.0);
        check("easing: ease-in is slow at first, ease-out fast at first", Emotes.ease(1, 0.25) < 0.25 && Emotes.ease(2, 0.25) > 0.25 && Math.abs(Emotes.ease(3, 0.5) - 0.5) < 1e-12);
        // sampling
        double[] o = new double[Emotes.N * Emotes.F]; Emotes.Emote wave = by.get("wave");
        Emotes.pose(wave, 0.3, o); check("pose: the wave raises the right arm overhead at 0.3 s", Math.abs(o[2 * 4] + 165) < 1e-9 && Math.abs(o[2 * 4 + 2] + 12) < 1e-9, o[8], o[10]);
        Emotes.pose(wave, 0.15, o); check("pose: between keyframes it eases (ease-out passes the midpoint early)", o[8] < -165 / 2.0, o[8]);
        check("pose: parts an emote doesn't use stay at 0 with weight 0", !wave.animates(4) && o[4 * 4] == 0);
        Emotes.pose(by.get("sit"), 1, o); check("pose: Sit lowers the whole model with the root offset", o[6 * 4 + 3] == 10);
        check("timing: loops wrap, one-shots report -1 when done", Math.abs(Emotes.localTime(by.get("groove"), 2.0) - 0.4) < 1e-9 && Emotes.localTime(wave, 2.0) == -1 && Emotes.localTime(wave, 1.99) == 1.99);
        // controller
        Emotes.Controller c = new Emotes.Controller(); double[] w = new double[Emotes.N]; c.setBlend(0.2);
        c.play(by.get("groove"), 0); c.sample(0.1, o, w); check("controller: an emote blends in over the blend time", Math.abs(w[0] - 0.5) < 1e-9);
        c.sample(0.5, o, w); check("controller: fully on after blending", w[0] == 1 && w[2] == 1);
        c.play(wave, 1.0); c.sample(1.1, o, w); check("controller: switching cross-fades with no dip to the normal pose; parts the new emote doesn't use fade out", Math.abs(w[2] - 1) < 1e-9 && Math.abs(w[1] - 0.5) < 1e-9, w[1], w[2]);
        c.cancel(2.0, "moved"); check("controller: cancelling stops playback but fades out", !c.playing() && c.active(2.1) && !c.active(2.25) && c.lastEnd.equals("moved"));
        c.sample(2.3, o, w); check("controller: after the fade, every weight is 0 (normal animation)", Arrays.stream(w).allMatch(x -> x == 0));
        c.play(wave, 3); c.update(4.99); check("controller: a one-shot is still playing just before its end", c.playing()); c.update(5.0); check("controller: and finishes on its own", !c.playing() && c.lastEnd.equals("finished"));
        c.setSpeed(2); c.play(wave, 10); c.update(11.01); check("controller: speed 2 plays a 2 s emote in 1 s", !c.playing());
        c.setSpeed(99); c.setBlend(-1); c.play(wave, 20); c.sample(20, o, w); check("controller: speed is capped at 3 and blend 0 snaps on immediately", w[2] == 1);
        { Emotes.Controller cc = new Emotes.Controller(); cc.play(by.get("groove"), 0); double acc = 0; for (int k = 0; k < 2000; k++) { cc.update(k / 60.0); cc.sample(k / 60.0, o, w); acc += o[8]; }
          long b0 = allocated(); for (int k = 0; k < 200_000; k++) { double t = k / 60.0; if (k % 600 == 0) cc.play(k % 1200 == 0 ? wave : by.get("groove"), t); cc.update(t); cc.sample(t, o, w); acc += o[8] + w[0]; }
          long by2 = allocated() - b0; check("controller: playing, switching and sampling allocate nothing per frame", by2 < 20_000, by2 + " bytes (" + (acc != 0) + ")"); }
        // validation
        String E0 = "{\"id\":\"x\",\"name\":\"X\",\"category\":\"Custom\",\"duration\":1,\"loop\":false,\"keys\":";
        check("validation: a minimal emote parses", !iae(() -> Emotes.parse(Json.parse(E0 + "{\"head\":[{\"t\":0,\"p\":10}]}}"))));
        check("validation: times must increase and stay within the duration", msg(() -> Emotes.parse(Json.parse(E0 + "{\"head\":[{\"t\":0.5},{\"t\":0.2}]}}"))).contains("times must increase") && msg(() -> Emotes.parse(Json.parse(E0 + "{\"head\":[{\"t\":2}]}}"))).contains("t must be a number from 0 to 1"));
        check("validation: unknown parts, fields and easings are refused by name", msg(() -> Emotes.parse(Json.parse(E0 + "{\"tail\":[{\"t\":0}]}}"))).contains("\"tail\"") && msg(() -> Emotes.parse(Json.parse(E0 + "{\"head\":[{\"t\":0,\"zz\":1}]}}"))).contains("\"zz\"") && msg(() -> Emotes.parse(Json.parse(E0 + "{\"head\":[{\"t\":0,\"e\":\"bouncy\"}]}}"))).contains("easing"));
        check("validation: angles are limited to ±180 and root only moves up and down", msg(() -> Emotes.parse(Json.parse(E0 + "{\"head\":[{\"t\":0,\"p\":181}]}}"))).contains("-180 to 180") && msg(() -> Emotes.parse(Json.parse(E0 + "{\"root\":[{\"t\":0,\"y\":5}]}}"))).contains("root"));
        StringBuilder many = new StringBuilder(E0 + "{\"head\":["); for (int k = 0; k < 65; k++) many.append(k > 0 ? "," : "").append("{\"t\":").append(k / 100.0).append("}"); many.append("]}}");
        check("validation: more than 64 keyframes on one part is refused", msg(() -> Emotes.parse(Json.parse(many.toString()))).contains("more than 64"));
        check("emote file: wrong schema and oversized files are refused", msg(() -> Emotes.parseFile("{\"schema\":2,\"emote\":{}}")).contains("schema 1") && msg(() -> Emotes.parseFile(" ".repeat(70_000))).contains("too large"));
        // wheel
        String[] slots = {"wave", null, "clap", null, null, null, null, "sit"};
        check("wheel: writes and reads back the same slots, skipping ids that no longer exist", Arrays.equals(Emotes.parseWheel(Emotes.writeWheel(slots), Set.of("wave", "clap", "sit")), slots) && Emotes.parseWheel(Emotes.writeWheel(slots), Set.of("wave"))[2] == null);
        check("wheel: slot 0 is straight up, slots go clockwise, the centre is a dead zone", Emotes.wheelSlot(0, -40, 10) == 0 && Emotes.wheelSlot(40, 0, 10) == 2 && Emotes.wheelSlot(0, 40, 10) == 4 && Emotes.wheelSlot(-40, 0, 10) == 6 && Emotes.wheelSlot(2, 2, 10) == -1);
        // custom emotes folder
        Path tmp = Files.createTempDirectory("auroras-emotes");
        Files.writeString(tmp.resolve("good.json"), "{\"schema\":1,\"emote\":" + E("mine").replace("\"Greetings\"", "\"Dance\"") + "}");
        Files.writeString(tmp.resolve("bad.json"), "{\"schema\":1,\"emote\":{\"id\":\"BAD\"}}"); Files.writeString(tmp.resolve("notes.txt"), "ignored");
        List<String> errs = new ArrayList<>(); List<Emotes.Emote> custom = Emotes.loadCustom(tmp, errs);
        check("custom emotes: good files load (as Custom), bad ones are skipped with a reason", custom.size() == 1 && custom.get(0).id().equals("mine") && custom.get(0).category().equals("Custom") && errs.size() == 1 && errs.get(0).startsWith("bad.json"), custom, errs);
        check("custom emotes: a missing folder is simply empty", Emotes.loadCustom(tmp.resolve("nope"), errs).isEmpty());
        // registry
        Config.Module m = new Config.Registry().get("emotes");
        check("registry: Emotes is available, says it's local only, and has wheel key, speed, blend, cancel-on-move and third-person settings", m.available() && m.note().contains("Only you see") && m.setting("wheelKey") != null && m.setting("speed") != null && m.setting("blend") != null && m.setting("cancelOnMove") != null && m.setting("thirdPerson") != null);
        System.out.println("\n" + pass + " passed, " + fail + " failed"); if (fail > 0) System.exit(1);
    }
    static double maxOf(int e) { double m = 0; for (int k = 0; k <= 100; k++) m = Math.max(m, Emotes.ease(e, k / 100.0)); return m; }
    static String E(String id) { return "{\"id\":\"" + id + "\",\"name\":\"" + id + "\",\"category\":\"Greetings\",\"duration\":1,\"loop\":false,\"keys\":{\"head\":[{\"t\":0,\"p\":5}]}}"; }
}
