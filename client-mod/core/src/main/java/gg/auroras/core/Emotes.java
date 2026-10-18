package gg.auroras.core;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Emotes: keyframed poses for the player model, a validated JSON format shared with the launcher's emote creator, and
 * the animation controller that plays, blends and cancels them. visuals/visuals.js mirrors this file and both are
 * checked against visuals/emote-golden.json. Angles use Minecraft's model convention in degrees: pitch turns about
 * the side-to-side axis (negative raises an arm forward), yaw about the vertical axis, roll about the front-to-back
 * axis (positive swings the right arm outward, negative the left). The root part only moves the whole model up or
 * down (offset in model pixels, negative is up). Emotes are drawn on your own client only; nothing is sent to servers.
 */
public final class Emotes {
    private Emotes() {}
    public static final List<String> PARTS = List.of("head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg", "root");
    public static final int N = 7, ROOT = 6, F = 4; // per part: pitch, yaw, roll, offsetY
    public static final List<String> EASINGS = List.of("linear", "easeIn", "easeOut", "easeInOut", "sine", "step", "back");
    public static final List<String> CATEGORIES = List.of("Greetings", "Celebrate", "Dance", "Reactions", "Custom");
    public static final Pattern ID = Pattern.compile("[a-z0-9_]{1,32}");
    public static final int MAX_KEYS_PER_PART = 64, MAX_KEYS = 256, SLOTS = 8;

    public record Key(double t, double p, double y, double r, double oy, int ease) {}
    public record Emote(String id, String name, String category, double duration, boolean loop, Key[][] keys) {
        public boolean animates(int part) { return keys[part].length > 0; }
    }

    // ---- easing ----
    public static double ease(int e, double x) {
        x = Sky.clamp(x, 0, 1);
        return switch (e) {
            case 1 -> x * x * x;
            case 2 -> 1 - Math.pow(1 - x, 3);
            case 3 -> x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
            case 4 -> -(Math.cos(Math.PI * x) - 1) / 2;
            case 5 -> x < 1 ? 0 : 1;
            case 6 -> { double c1 = 1.70158, c3 = c1 + 1; yield 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
            default -> x;
        };
    }

    // ---- parsing and validation (strict: user files are refused with a reason, never half-loaded) ----
    static IllegalArgumentException bad(String where, String why) { return new IllegalArgumentException(where + ": " + why); }
    static double num(Map<String, Object> o, String k, double def, double lo, double hi, String where) {
        Object v = o.get(k); if (v == null) return def;
        if (!(v instanceof Double d) || d.isNaN() || d < lo || d > hi) throw bad(where, k + " must be a number from " + fmt(lo) + " to " + fmt(hi));
        return d;
    }
    static String fmt(double d) { return d == Math.rint(d) ? String.valueOf((long) d) : String.valueOf(d); }
    public static Emote parse(Object json) {
        if (!(json instanceof Map)) throw bad("emote", "must be an object");
        @SuppressWarnings("unchecked") Map<String, Object> o = (Map<String, Object>) json;
        for (String k : o.keySet()) if (!List.of("id", "name", "category", "duration", "loop", "keys").contains(k)) throw bad("emote", "unknown field \"" + k + "\"");
        if (!(o.get("id") instanceof String id) || !ID.matcher(id).matches()) throw bad("emote", "id must be 1-32 lowercase letters, digits or _");
        String w = "emote " + id;
        if (!(o.get("name") instanceof String name) || name.isBlank() || name.length() > 32 || name.chars().anyMatch(c -> c < 32)) throw bad(w, "name must be 1-32 characters");
        if (!(o.get("category") instanceof String cat) || !CATEGORIES.contains(cat)) throw bad(w, "category must be one of " + CATEGORIES);
        double dur = num(o, "duration", Double.NaN, 0.1, 30, w); if (Double.isNaN(dur)) throw bad(w, "duration is required");
        if (!(o.get("loop") instanceof Boolean loop)) throw bad(w, "loop must be true or false");
        if (!(o.get("keys") instanceof Map<?, ?> km)) throw bad(w, "keys must be an object of body parts");
        Key[][] keys = new Key[N][]; int total = 0;
        for (Object pk : km.keySet()) if (!PARTS.contains(pk)) throw bad(w, "unknown body part \"" + pk + "\"");
        for (int p = 0; p < N; p++) {
            Object arr = km.get(PARTS.get(p)); if (arr == null) { keys[p] = new Key[0]; continue; }
            if (!(arr instanceof List<?> l)) throw bad(w, PARTS.get(p) + " must be a list of keyframes");
            if (l.size() > MAX_KEYS_PER_PART) throw bad(w, PARTS.get(p) + " has more than " + MAX_KEYS_PER_PART + " keyframes");
            keys[p] = new Key[l.size()]; double prev = -1;
            for (int i = 0; i < l.size(); i++) {
                String kw = w + " " + PARTS.get(p) + " keyframe " + (i + 1);
                if (!(l.get(i) instanceof Map)) throw bad(kw, "must be an object");
                @SuppressWarnings("unchecked") Map<String, Object> k = (Map<String, Object>) l.get(i);
                for (String f : k.keySet()) if (!List.of("t", "p", "y", "r", "oy", "e").contains(f)) throw bad(kw, "unknown field \"" + f + "\"");
                double t = num(k, "t", Double.NaN, 0, dur, kw); if (Double.isNaN(t)) throw bad(kw, "t (time) is required");
                if (t <= prev) throw bad(kw, "times must increase"); prev = t;
                Object e = k.getOrDefault("e", "linear"); if (!(e instanceof String es) || !EASINGS.contains(es)) throw bad(kw, "e (easing) must be one of " + EASINGS);
                double pp = num(k, "p", 0, -180, 180, kw), yy = num(k, "y", 0, -180, 180, kw), rr = num(k, "r", 0, -180, 180, kw), oy = num(k, "oy", 0, -16, 16, kw);
                if (p == ROOT && (pp != 0 || yy != 0 || rr != 0)) throw bad(kw, "the root part only moves up and down (oy)");
                if (p != ROOT && oy != 0) throw bad(kw, "only the root part has oy");
                keys[p][i] = new Key(t, pp, yy, rr, oy, EASINGS.indexOf(es));
            }
            total += l.size();
        }
        if (total == 0) throw bad(w, "needs at least one keyframe");
        if (total > MAX_KEYS) throw bad(w, "has more than " + MAX_KEYS + " keyframes");
        return new Emote(id, name, cat, dur, loop, keys);
    }
    /** The bundled library (visuals/emotes.json): {"schema":1,"emotes":[...]}. Ids must be unique. */
    public static List<Emote> parseLibrary(String text) {
        Map<String, Object> root = Json.obj(Json.parse(text), "emote library");
        if (Json.num(root, "schema") != 1) throw new IllegalArgumentException("Unsupported emote library schema");
        List<Emote> out = new ArrayList<>(); Set<String> ids = new HashSet<>();
        for (Object e : Json.arr(root.get("emotes"), "emotes")) { Emote em = parse(e); if (!ids.add(em.id())) throw bad("emote " + em.id(), "duplicate id"); out.add(em); }
        return out;
    }
    /** A single emote file as the creator exports it: {"schema":1,"emote":{...}}. Refuses files over 64 KB. */
    public static Emote parseFile(String text) {
        if (text.length() > 65536) throw new IllegalArgumentException("That file is too large to be an emote.");
        Map<String, Object> root = Json.obj(Json.parse(text), "emote file");
        if (!Objects.equals(root.get("schema"), 1.0)) throw new IllegalArgumentException("Not an Auroras emote file (schema 1).");
        return parse(root.get("emote"));
    }

    // ---- sampling ----
    /** Pose at time t (seconds, already wrapped or clamped by the caller) into out[N*F]. Parts without keys stay 0. */
    public static void pose(Emote em, double t, double[] out) {
        for (int p = 0; p < N; p++) {
            Key[] ks = em.keys()[p]; int o = p * F;
            if (ks.length == 0) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; continue; }
            if (t <= ks[0].t()) { set(out, o, ks[0]); continue; }
            if (t >= ks[ks.length - 1].t()) { set(out, o, ks[ks.length - 1]); continue; }
            int i = 1; while (ks[i].t() < t) i++;
            Key a = ks[i - 1], b = ks[i]; double x = ease(b.ease(), (t - a.t()) / (b.t() - a.t()));
            out[o] = a.p() + (b.p() - a.p()) * x; out[o + 1] = a.y() + (b.y() - a.y()) * x; out[o + 2] = a.r() + (b.r() - a.r()) * x; out[o + 3] = a.oy() + (b.oy() - a.oy()) * x;
        }
    }
    static void set(double[] out, int o, Key k) { out[o] = k.p(); out[o + 1] = k.y(); out[o + 2] = k.r(); out[o + 3] = k.oy(); }
    /** Emote-local time for elapsed seconds: wraps for looping emotes, -1 once a one-shot has finished. */
    public static double localTime(Emote em, double elapsed) {
        if (elapsed < 0) return 0;
        if (em.loop()) return elapsed % em.duration();
        return elapsed >= em.duration() ? -1 : elapsed;
    }

    /**
     * Plays one emote at a time. Starting an emote while another plays cross-fades from the current pose; cancelling or
     * reaching the end of a one-shot fades back to the normal animation. sample() writes a pose and a weight per part
     * (0 = normal animation, 1 = fully the emote) so the game can mix: angle = vanilla * (1 - w) + pose * w.
     * Fixed arrays, no allocation per frame.
     */
    public static final class Controller {
        private Emote cur; private double start, speed = 1, blend = 0.2;
        private final double[] from = new double[N * F], fromW = new double[N], tmp = new double[N * F]; private double fromAt = -1;
        public String lastEnd = "";
        public void setSpeed(double s) { speed = Sky.clamp(s, 0.25, 3); }
        public void setBlend(double b) { blend = Sky.clamp(b, 0, 1); }
        public Emote current() { return cur; }
        public boolean playing() { return cur != null; }
        /** True while anything still shows: an emote, or the fade back after one. */
        public boolean active(double now) { return cur != null || (fromAt >= 0 && now - fromAt < blend); }
        public void play(Emote em, double now) { snapshot(now); cur = em; start = now; lastEnd = ""; }
        /** Stops with a fade. reason is kept for the UI (e.g. "moved", "cancelled", "finished"). */
        public void cancel(double now, String reason) { if (cur == null) return; snapshot(now); cur = null; lastEnd = reason; }
        private void snapshot(double now) { sampleInto(now, from, fromW); fromAt = now; }
        /** Also ends a finished one-shot; call once per frame before drawing. */
        public void update(double now) { if (cur != null && localTime(cur, (now - start) * speed) < 0) { snapshot(now); cur = null; lastEnd = "finished"; } }
        public void sample(double now, double[] pose, double[] weight) { sampleInto(now, pose, weight); }
        private void sampleInto(double now, double[] pose, double[] weight) {
            double wf = fromAt < 0 || blend <= 0 ? 0 : 1 - Sky.clamp((now - fromAt) / blend, 0, 1);
            double wc = 0; if (cur != null) { double lt = localTime(cur, (now - start) * speed); pose(cur, lt < 0 ? cur.duration() : lt, tmp); wc = blend <= 0 ? 1 : Sky.clamp((now - start) / blend, 0, 1); }
            for (int p = 0; p < N; p++) {
                double a = cur != null && cur.animates(p) ? wc : 0, b = fromW[p] * wf, sum = a + b; int o = p * F;
                if (sum <= 1e-9) { pose[o] = pose[o + 1] = pose[o + 2] = pose[o + 3] = 0; weight[p] = 0; continue; }
                for (int f = 0; f < F; f++) pose[o + f] = (tmp[o + f] * a + from[o + f] * b) / sum;
                weight[p] = Sky.clamp(sum, 0, 1);
            }
        }
    }

    // ---- emote wheel and custom emote files (config/auroras/emotes/) ----
    /** wheel.txt: "auroras-wheel=1" then "slotN=id" lines (N 1..8). Unknown ids and junk lines are skipped. */
    public static String[] parseWheel(String text, Set<String> known) {
        String[] slots = new String[SLOTS]; if (text == null) return slots;
        for (String line : text.split("\\R")) {
            int eq = line.indexOf('='); if (!line.startsWith("slot") || eq < 0) continue;
            try { int n = Integer.parseInt(line.substring(4, eq).trim()); String id = line.substring(eq + 1).trim(); if (n >= 1 && n <= SLOTS && known.contains(id)) slots[n - 1] = id; } catch (NumberFormatException ignored) {}
        }
        return slots;
    }
    public static String writeWheel(String[] slots) {
        StringBuilder b = new StringBuilder("auroras-wheel=1\n"); for (int k = 0; k < SLOTS; k++) if (slots[k] != null) b.append("slot").append(k + 1).append('=').append(slots[k]).append('\n'); return b.toString();
    }
    /** Which slot (0..7, clockwise from the top) the mouse points at, or -1 inside the dead zone. */
    public static int wheelSlot(double dx, double dy, double deadZone) {
        if (dx * dx + dy * dy < deadZone * deadZone) return -1;
        double a = Math.atan2(dx, -dy); if (a < 0) a += Math.PI * 2;
        return (int) Math.floor((a + Math.PI / SLOTS) / (Math.PI * 2 / SLOTS)) % SLOTS;
    }
    /** Loads custom emotes from dir/*.json. Bad files are skipped and reported in errors, never half-loaded. */
    public static List<Emote> loadCustom(Path dir, List<String> errors) {
        List<Emote> out = new ArrayList<>(); if (!Files.isDirectory(dir)) return out;
        try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir, "*.json")) {
            List<Path> files = new ArrayList<>(); ds.forEach(files::add); files.sort(null);
            for (Path f : files) {
                try { if (Files.size(f) > 65536) throw new IllegalArgumentException("too large"); Emote e = parseFile(Files.readString(f, StandardCharsets.UTF_8)); if (!e.category().equals("Custom")) e = new Emote(e.id(), e.name(), "Custom", e.duration(), e.loop(), e.keys()); out.add(e); }
                catch (Exception ex) { errors.add(f.getFileName() + ": " + ex.getMessage()); }
            }
        } catch (IOException ex) { errors.add(ex.getMessage()); }
        return out;
    }
}
