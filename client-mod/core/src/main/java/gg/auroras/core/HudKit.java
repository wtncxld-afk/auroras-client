package gg.auroras.core;

import java.util.*;

/**
 * HUD text, styles, animation and layouts shared by the in-game renderer and the launcher's HUD editor.
 * visuals/visuals.js mirrors the formatters and the layout maths; visuals/hud-golden.json checks they agree.
 * The formatters allocate a String, so callers cache them with Perf.CachedText and only rebuild when inputs change.
 */
public final class HudKit {
    private HudKit() {}

    /** Visual style of a HUD element: padding around the text, whether the label is shown, corner accent width. */
    public enum Style {
        MINIMAL(3, 2, false, 0), COMPACT(2, 1, false, 0), EXPANDED(5, 3, true, 2);
        public final int padX, padY, accent; public final boolean label;
        Style(int px, int py, boolean label, int accent) { padX = px; padY = py; this.label = label; this.accent = accent; }
        public static Style of(String s) { return switch (s) { case "compact" -> COMPACT; case "expanded" -> EXPANDED; default -> MINIMAL; }; }
    }
    /** Box size for text of width tw and height th in a style. */
    public static int[] box(Style st, int tw, int th) { return new int[]{tw + st.padX * 2 + st.accent, th + st.padY * 2}; }
    /** ARGB for a 0xRRGGBB color at an opacity percentage, multiplied by a fade alpha (0..1). */
    public static int argb(int rgb, int opacityPct, double fade) { int a = (int) Math.round(255 * Sky.clamp(opacityPct / 100.0, 0, 1) * Sky.clamp(fade, 0, 1)); return (a << 24) | (rgb & 0xFFFFFF); }

    // ----- formatters -----
    public static String fps(int fps, double avg, double frameMs, boolean showAvg, boolean showMs, Style st) {
        StringBuilder b = new StringBuilder(st == Style.COMPACT ? "" : "FPS ").append(fps);
        if (showAvg) b.append(st == Style.COMPACT ? " / " : " · avg ").append(Math.round(avg));
        if (showMs) b.append(" · ").append(String.format(Locale.ROOT, "%.1f", frameMs)).append(" ms");
        return st == Style.COMPACT ? b.append(" fps").toString() : b.toString();
    }
    public static String coords(double x, double y, double z, int dec, boolean sx, boolean sy, boolean sz, String dir) {
        StringBuilder b = new StringBuilder();
        if (sx) b.append("X ").append(Calc.num(x, dec)); if (sy) b.append(b.length() > 0 ? "  " : "").append("Y ").append(Calc.num(y, dec)); if (sz) b.append(b.length() > 0 ? "  " : "").append("Z ").append(Calc.num(z, dec));
        if (dir != null) b.append(b.length() > 0 ? "  " : "").append(dir);
        return b.length() == 0 ? "—" : b.toString();
    }
    public static String cps(int left, int right, boolean showRight, Style st) {
        if (st == Style.COMPACT) return showRight ? left + " | " + right : String.valueOf(left);
        return showRight ? "CPS " + left + " | " + right : "CPS " + left;
    }
    /** Latency in ms. -1 means unknown (singleplayer, or the server hasn't reported it): shown as "n/a", never as 0. */
    public static String ping(int ms) { return ms < 0 ? "Ping n/a" : "Ping " + ms + " ms"; }
    /** 0 good, 1 ok, 2 bad, -1 unknown. */
    public static int pingLevel(int ms, int good, int ok) { return ms < 0 ? -1 : ms <= good ? 0 : ms <= ok ? 1 : 2; }
    public static final int[] PING_COLORS = {0x6FCF97, 0xE0B45A, 0xE57373, 0x9AA3B2};
    /** Potion time from ticks; -1 (infinite) shows ∞; under an hour shows m:ss. */
    public static String potionTime(int ticks) {
        if (ticks < 0) return "∞"; int s = ticks / 20, h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
        return h > 0 ? String.format(Locale.ROOT, "%d:%02d:%02d", h, m, sec) : String.format(Locale.ROOT, "%d:%02d", m, sec);
    }
    /** "Speed II", amplifier 0 = level I. Levels above 10 use digits. */
    public static String potionName(String name, int amplifier) {
        String[] r = {"", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"}; return name + (amplifier >= 0 && amplifier < r.length ? r[amplifier] : " " + (amplifier + 1));
    }
    /** Sorts potion indices by remaining time (shortest first, infinite last) or by name. Returns a new order array. */
    public static int[] potionOrder(String[] names, int[] ticks, String mode) {
        Integer[] idx = new Integer[names.length]; for (int i = 0; i < idx.length; i++) idx[i] = i;
        Comparator<Integer> byTime = Comparator.comparingLong(i -> ticks[i] < 0 ? Long.MAX_VALUE : ticks[i]);
        Arrays.sort(idx, mode.equals("name") ? Comparator.<Integer, String>comparing(i -> names[i]).thenComparing(byTime) : byTime.thenComparing(i -> names[i]));
        int[] out = new int[idx.length]; for (int i = 0; i < out.length; i++) out[i] = idx[i]; return out;
    }
    /** percent "45%", numeric "163/363", or bar: 1 to 6 blocks for what is left (the launcher's HUD editor draws the same). */
    public static String durability(int max, int damage, String format) {
        int pct = Calc.armorPercent(max, damage); if (pct < 0) return "";
        if (format.equals("bar")) { int left = Math.max(0, Math.min(max, max - damage)); return "█".repeat((int) Math.max(1, Math.round(left * 6.0 / max))); }
        return format.equals("numeric") ? (Math.max(0, max - damage)) + "/" + max : pct + "%";
    }
    public static String session(long millis) { long s = Math.max(0, millis / 1000); return String.format(Locale.ROOT, "%d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60); }
    /** Joins the session parts that are switched on and present, e.g. "1.21.4 · Fabric · Survival · 0:12:03". */
    public static String sessionInfo(String version, String loader, String instance, String server, long millis, boolean v, boolean l, boolean i, boolean sv, boolean d) {
        List<String> p = new ArrayList<>();
        if (v && version != null) p.add(version); if (l && loader != null) p.add(loader); if (i && instance != null && !instance.isBlank()) p.add(instance);
        if (sv && server != null && !server.isBlank()) p.add(server); if (d) p.add(session(millis));
        return p.isEmpty() ? "—" : String.join(" · ", p);
    }
    /** Target line: name, health as "12.5 / 20" when known (health < 0 = unknown, omitted), distance when wanted. */
    public static String target(String name, double health, double maxHealth, double distance, boolean showHealth, boolean showDistance) {
        StringBuilder b = new StringBuilder(name == null ? "" : name);
        if (showHealth && health >= 0 && maxHealth > 0) b.append("  ").append(Calc.num(Math.round(health * 2) / 2.0, health % 1 == 0 ? 0 : 1)).append(" / ").append(Calc.num(maxHealth, maxHealth % 1 == 0 ? 0 : 1)).append(" ♥");
        if (showDistance && distance >= 0) b.append("  ").append(Calc.num(distance, 1)).append(" m");
        return b.toString();
    }
    /** Spotify line from what the integration actually supplied. Missing data shows the reason instead of guessing. */
    /** On-screen elements: every module with a position (HUD, information readouts, the logo), whatever its menu category. */
    public static boolean positionable(Config.Module m) { return m != null && m.setting("anchor") != null; }
    public static String spotify(String title, String artist, boolean playing, int progressMs, int durationMs, boolean showProgress, String status) {
        if (status != null && !status.isBlank()) return "Spotify: " + status;
        if (title == null || title.isBlank()) return "Spotify: nothing playing";
        StringBuilder b = new StringBuilder(playing ? "▶ " : "❚❚ ").append(title); if (artist != null && !artist.isBlank()) b.append(" — ").append(artist);
        if (showProgress && durationMs > 0) b.append("  ").append(mmss(progressMs)).append(" / ").append(mmss(durationMs));
        return b.toString();
    }
    /**
     * Spotify card geometry (GUI pixels). Fixed width so the card doesn't jump around as titles change.
     * compact: one line "Title · Artist" beside a 16 px cover, thin progress line underneath.
     * expanded: 32 px cover, title, artist, progress bar with elapsed and total time.
     * Without a cover (turned off or not downloaded) the text starts where the cover would be and a note glyph is drawn instead.
     */
    public record SpotifyCard(int w, int h, int art, int pad, int textX, int textW, int titleY, int artistY, int barY, int barH, boolean expanded) {}
    public static SpotifyCard spotifyCard(String layout, boolean showArt, boolean showProgress) {
        boolean ex = "expanded".equals(layout); int pad = ex ? 6 : 4, art = ex ? 32 : 16, w = ex ? 176 : 148;
        int textX = pad + (showArt ? art + (ex ? 7 : 5) : (ex ? 0 : 0)), textW = w - textX - pad;
        if (ex) { int h = pad * 2 + art + (showProgress ? 0 : 0); return new SpotifyCard(w, h, showArt ? art : 0, pad, textX, textW, pad + 2, pad + 13, pad + art - 6, 2, true); }
        int h = pad * 2 + art + (showProgress ? 3 : 0); return new SpotifyCard(w, h, showArt ? art : 0, pad, textX, textW, pad + (art - 8) / 2, -1, h - 2, 1, false);
    }
    /**
     * Marquee offset for text wider than its box: holds at the start for pauseS seconds, scrolls left at pxPerS until the
     * end has passed by a gap, then starts over. Text that fits never moves. Reduced motion never scrolls (callers ellipsize).
     */
    public static double marquee(int textW, int boxW, double seconds, double pxPerS, double pauseS, boolean reducedMotion) {
        if (textW <= boxW || reducedMotion || pxPerS <= 0) return 0;
        double travel = textW - boxW + 12, scrollS = travel / pxPerS, cycle = pauseS * 2 + scrollS, t = ((seconds % cycle) + cycle) % cycle;
        if (t < pauseS) return 0; if (t < pauseS + scrollS) return Math.round((t - pauseS) * pxPerS * 2) / 2.0; return travel;
    }
    /** Playback position 0..1 for the progress bar (0 when the length is unknown). */
    public static double progressFrac(int progressMs, int durationMs) { return durationMs <= 0 ? 0 : Sky.clamp(progressMs / (double) durationMs, 0, 1); }

    static String mmss(int ms) { int s = Math.max(0, ms / 1000); return (s / 60) + ":" + String.format(Locale.ROOT, "%02d", s % 60); }

    // ----- animation (time-based, so speed is the same at any frame rate) -----
    /** Value that eases toward its target: 1 - e^(-dt/tau). Snaps when within eps. Reduced motion jumps straight there. */
    public static final class Smooth {
        public double value; private boolean init;
        public double update(double target, double dtSeconds, double tauSeconds, boolean reducedMotion) {
            if (!init || reducedMotion || tauSeconds <= 0) { value = target; init = true; return value; }
            value += (target - value) * (1 - Math.exp(-Math.max(0, dtSeconds) / tauSeconds)); if (Math.abs(target - value) < 1e-3) value = target; return value;
        }
    }
    /** 0..1 visibility that fades in and out over durationSeconds. */
    public static final class Fade {
        public double alpha;
        public double update(boolean visible, double dtSeconds, double durationSeconds, boolean reducedMotion) {
            if (reducedMotion || durationSeconds <= 0) return alpha = visible ? 1 : 0;
            double step = Math.max(0, dtSeconds) / durationSeconds; alpha = visible ? Math.min(1, alpha + step) : Math.max(0, alpha - step); return alpha;
        }
    }
    /** Key highlight that lights instantly when pressed and fades over 120 ms when released. */
    public static double keyGlow(double current, boolean pressed, double dt, boolean animate) { return keyGlow(current, pressed, dt, animate ? 0.12 : 0); }
    /** Same, with the release fade length in seconds (0 = no fade). */
    public static double keyGlow(double current, boolean pressed, double dt, double fadeSeconds) { return pressed ? 1 : fadeSeconds > 0 ? Math.max(0, current - Math.max(0, dt) / fadeSeconds) : 0; }

    // ----- text colour modes (every HUD element: solid, chroma, gradient) -----
    /** RGB from hue (turns, any value), saturation and value (0..1). */
    public static int hsv(double hue, double sat, double val) {
        double h = ((hue % 1) + 1) % 1 * 6, c = val * sat, x = c * (1 - Math.abs(h % 2 - 1)), m = val - c, r, g, b; int i = (int) h;
        switch (i) { case 0 -> { r = c; g = x; b = 0; } case 1 -> { r = x; g = c; b = 0; } case 2 -> { r = 0; g = c; b = x; } case 3 -> { r = 0; g = x; b = c; } case 4 -> { r = x; g = 0; b = c; } default -> { r = c; g = 0; b = x; } }
        return (int) Math.round((r + m) * 255) << 16 | (int) Math.round((g + m) * 255) << 8 | (int) Math.round((b + m) * 255);
    }
    /**
     * Colour of the text at horizontal position px (GUI pixels from the element's left edge) at time seconds.
     * solid: the element's colour. chroma: a rainbow that flows sideways, one full cycle every 160 px and every 4 s / speed.
     * gradient: the colour and the accent, blended in a wave that slides across the text.
     */
    public static int textColor(String mode, int color, int accent, double px, double seconds, double speed) {
        if ("chroma".equals(mode)) return hsv(px / 160.0 - seconds * speed / 4.0, 0.62, 1.0);
        if ("gradient".equals(mode)) return Sky.mix(color, accent, 0.5 + 0.5 * Math.sin(px / 24.0 - seconds * speed * 2.0));
        return color;
    }
    /** Solid text is drawn as one string; the other modes colour each character. */
    public static boolean perChar(String mode) { return "chroma".equals(mode) || "gradient".equals(mode); }

    // ----- rounded boxes, drawn as a few rectangles so the game and the launcher get the same pixels -----
    /** How far row i (0 = the outermost) of a corner of radius r is pulled in. */
    public static int cornerInset(int r, int i) { return i >= r ? 0 : r - (int) Math.floor(Math.sqrt(r * r - (double) (r - i) * (r - i))); }
    /** Radius actually used for a w x h box: at most a third of the shorter side, so small boxes stay boxes. */
    public static int fitRadius(int r, int w, int h) { return Math.max(0, Math.min(r, Math.min(w, h) / 3)); }
    /**
     * Fills: rectangles {x0, y0, x1, y1} covering a w x h box with rounded corners, written to out (4 ints each, at least
     * (2r + 1) * 4 long). Returns the number of rectangles. Nothing overlaps, so translucent fills stay even.
     */
    public static int roundRect(int w, int h, int r, int[] out) {
        r = fitRadius(r, w, h); int n = 0;
        if (r == 0) { out[0] = 0; out[1] = 0; out[2] = w; out[3] = h; return 1; }
        for (int i = 0; i < r; i++) { int in = cornerInset(r, i); n = put(out, n, in, i, w - in, i + 1); n = put(out, n, in, h - 1 - i, w - in, h - i); }
        return put(out, n, 0, r, w, h - r);
    }
    /** A 1 px outline of the same rounded box (at most (4r + 4) * 4 ints). Returns the number of rectangles. */
    public static int roundOutline(int w, int h, int r, int[] out) {
        r = fitRadius(r, w, h); int n = 0;
        if (w <= 2 || h <= 2) return put(out, 0, 0, 0, w, h);
        if (r == 0) { n = put(out, n, 0, 0, w, 1); n = put(out, n, 0, h - 1, w, h); n = put(out, n, 0, 1, 1, h - 1); return put(out, n, w - 1, 1, w, h - 1); }
        int top = cornerInset(r, 0); n = put(out, n, top, 0, w - top, 1); n = put(out, n, top, h - 1, w - top, h);
        for (int i = 1; i < r; i++) { int in = cornerInset(r, i), prev = cornerInset(r, i - 1), x1 = Math.max(in + 1, prev);
            n = put(out, n, in, i, x1, i + 1); n = put(out, n, w - x1, i, w - in, i + 1); n = put(out, n, in, h - 1 - i, x1, h - i); n = put(out, n, w - x1, h - 1 - i, w - in, h - i); }
        int last = cornerInset(r, r - 1); if (last > 1) { n = put(out, n, 0, r, last, r + 1); n = put(out, n, w - last, r, w, r + 1); n = put(out, n, 0, h - 1 - r, last, h - r); n = put(out, n, w - last, h - 1 - r, w, h - r); }
        int y0 = last > 1 ? r + 1 : r, y1 = last > 1 ? h - r - 1 : h - r; n = put(out, n, 0, y0, 1, y1); return put(out, n, w - 1, y0, w, y1);
    }
    private static int put(int[] o, int n, int x0, int y0, int x1, int y1) { if (x1 <= x0 || y1 <= y0) return n; int k = n * 4; o[k] = x0; o[k + 1] = y0; o[k + 2] = x1; o[k + 3] = y1; return n + 1; }
    /** Buffer big enough for roundRect / roundOutline at the largest radius the settings allow. */
    public static int[] rectBuffer() { return new int[(4 * MAX_RADIUS + 8) * 4]; }
    public static final int MAX_RADIUS = 6;

    // ----- module list -----
    public record Entry(String id, String name, String category, int width) {}
    public static List<Entry> moduleList(List<Entry> enabled, String sort) {
        List<Entry> l = new ArrayList<>(enabled);
        Comparator<Entry> byName = Comparator.comparing(Entry::name, String.CASE_INSENSITIVE_ORDER);
        l.sort(switch (sort) { case "name" -> byName; case "category" -> Comparator.comparing(Entry::category).thenComparing(byName); default -> Comparator.comparingInt(Entry::width).reversed().thenComparing(byName); });
        return l;
    }
    /** X of a module-list line inside a column of width colW: right-aligned lines hug the right edge. */
    public static int lineX(int colX, int colW, int lineW, boolean right) { return right ? colX + colW - lineW : colX; }

    // ----- layout presets -----
    /** Setting keys a HUD layout stores for each element. */
    public static final List<String> LAYOUT_KEYS = List.of("enabled", "anchor", "offX", "offY", "scale", "style", "color", "accent", "background", "bgOpacity", "border", "shadow", "opacity", "bgColor", "radius", "textMode", "chromaSpeed");
    /** Snapshot of the HUD part of a profile. */
    public static Map<String, String> captureLayout(Config.Registry reg, Config.ProfileManager pm) {
        Map<String, String> out = new TreeMap<>();
        for (Config.Module m : reg.modules()) if (positionable(m)) for (String k : LAYOUT_KEYS) if (m.setting(k) != null) out.put(m.id() + "." + k, pm.get(m.id() + "." + k));
        return out;
    }
    public static String exportLayout(String name, Map<String, String> layout) {
        StringBuilder b = new StringBuilder("auroras-hudlayout=1\nname=").append(name).append('\n'); for (Map.Entry<String, String> e : new TreeMap<>(layout).entrySet()) b.append(e.getKey()).append('=').append(e.getValue()).append('\n');
        return b.toString();
    }
    /** Parses and validates a layout file. Only HUD layout keys are accepted; everything is checked before anything is applied. */
    public static Map<String, String> importLayout(Config.Registry reg, String text) {
        if (text == null || text.length() > 65536) throw new IllegalArgumentException("File is too large or empty");
        String[] lines = text.split("\\r?\\n"); if (lines.length < 2 || !lines[0].equals("auroras-hudlayout=1") || !lines[1].startsWith("name=")) throw new IllegalArgumentException("Not an Auroras HUD layout");
        Map<String, String> out = new TreeMap<>();
        for (int i = 2; i < lines.length; i++) {
            if (lines[i].isBlank()) continue; int eq = lines[i].indexOf('='); if (eq < 1) throw new IllegalArgumentException("Line " + (i + 1) + " is malformed");
            String k = lines[i].substring(0, eq), v = lines[i].substring(eq + 1); int dot = k.indexOf('.');
            Config.Module m = dot > 0 ? reg.get(k.substring(0, dot)) : null;
            if (m == null || !positionable(m) || !LAYOUT_KEYS.contains(k.substring(dot + 1))) throw new IllegalArgumentException("Line " + (i + 1) + ": not a HUD layout setting");
            String err = reg.validate(k, v); if (err != null) throw new IllegalArgumentException("Line " + (i + 1) + ": " + err); out.put(k, v);
        }
        return out;
    }
    public static void applyLayout(Config.ProfileManager pm, Map<String, String> layout) { for (Map.Entry<String, String> e : layout.entrySet()) pm.set(e.getKey(), e.getValue()); }
    /** Layout presets live in <config>/hud-layouts/<name>.txt, one file each, shared with the launcher's HUD editor. */
    public static void saveLayout(java.nio.file.Path configDir, String name, Map<String, String> layout) throws java.io.IOException {
        if (name == null || !name.matches("[A-Za-z0-9][A-Za-z0-9 ._-]{0,31}")) throw new IllegalArgumentException("Layout names are 1-32 letters, numbers, spaces, dots, dashes or underscores");
        java.nio.file.Path d = configDir.resolve("hud-layouts"); java.nio.file.Files.createDirectories(d);
        java.nio.file.Path tmp = d.resolve(name.replace(' ', '_') + ".txt.tmp"); java.nio.file.Files.writeString(tmp, exportLayout(name, layout));
        java.nio.file.Files.move(tmp, d.resolve(name.replace(' ', '_') + ".txt"), java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE);
    }
    /** All valid layout presets by name. Invalid files are skipped. */
    public static Map<String, Map<String, String>> loadLayouts(Config.Registry reg, java.nio.file.Path configDir) throws java.io.IOException {
        Map<String, Map<String, String>> out = new TreeMap<>(); java.nio.file.Path d = configDir.resolve("hud-layouts"); if (!java.nio.file.Files.isDirectory(d)) return out;
        try (java.nio.file.DirectoryStream<java.nio.file.Path> ds = java.nio.file.Files.newDirectoryStream(d, "*.txt")) {
            for (java.nio.file.Path f : ds) { try { String t = java.nio.file.Files.readString(f); out.put(t.split("\\r?\\n")[1].substring(5), importLayout(reg, t)); } catch (RuntimeException e) { /* skipped */ } }
        }
        return out;
    }
    /** Default placement of one element (the editor's "reset position"). */
    public static Map<String, String> resetElement(Config.Registry reg, String id) {
        Map<String, String> out = new TreeMap<>(); Config.Module m = reg.get(id); if (m == null || !positionable(m)) throw new IllegalArgumentException("Not a HUD element");
        for (String k : List.of("anchor", "offX", "offY", "scale")) out.put(id + "." + k, m.setting(k).def()); return out;
    }
}
