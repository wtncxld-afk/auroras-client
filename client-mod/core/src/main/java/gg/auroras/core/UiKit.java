package gg.auroras.core;

import java.util.*;
import java.util.function.ToIntFunction;

/**
 * Layout and interaction maths for the in-game Auroras GUI widgets (switch, slider, segmented control, option cycling,
 * scrolling lists, text fitting, card grids). Pure Java, no Minecraft classes, so it is unit-tested here; the adapter only
 * draws. Mirrors how the launcher's controls behave.
 */
public final class UiKit {
    private UiKit() {}

    /** How many cards of at least minW fit in width with gap between them (at least 1). */
    public static int columns(int width, int minW, int gap) { return Math.max(1, (width + gap) / (minW + gap)); }
    /** Width of each card when cols cards share width with gap between them. */
    public static int cardWidth(int width, int cols, int gap) { return (width - gap * (cols - 1)) / cols; }

    /** Shortens text with an ellipsis so it fits maxW, using the font's width function. Never returns wider text than maxW unless even "…" doesn't fit. */
    public static String ellipsize(String s, int maxW, ToIntFunction<String> width) {
        if (s == null) return ""; if (width.applyAsInt(s) <= maxW) return s;
        String dots = "…"; int lo = 0, hi = s.length();
        while (lo < hi) { int mid = (lo + hi + 1) / 2; if (width.applyAsInt(s.substring(0, mid).stripTrailing() + dots) <= maxW) lo = mid; else hi = mid - 1; }
        return lo == 0 ? dots : s.substring(0, lo).stripTrailing() + dots;
    }
    /** Splits text into at most maxLines lines of maxW, the last one ellipsized. */
    public static List<String> wrap(String s, int maxW, int maxLines, ToIntFunction<String> width) {
        List<String> out = new ArrayList<>(); String[] words = s.split(" "); StringBuilder line = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String w = words[i], tryLine = line.length() == 0 ? w : line + " " + w;
            if (width.applyAsInt(tryLine) <= maxW) { line.setLength(0); line.append(tryLine); continue; }
            if (line.length() > 0) { out.add(line.toString()); line.setLength(0); line.append(w); } else { out.add(ellipsize(w, maxW, width)); line.setLength(0); }
            if (out.size() == maxLines) { String rest = String.join(" ", Arrays.copyOfRange(words, i, words.length)); out.set(maxLines - 1, ellipsize(out.get(maxLines - 1) + " " + rest, maxW, width)); return out; }
        }
        if (line.length() > 0) out.add(line.toString());
        return out;
    }

    /** Slider: value for a mouse x over a track starting at x with width w, snapped to step and clamped. */
    public static double sliderValue(double mouseX, int x, int w, double min, double max, double step) {
        double t = Sky.clamp((mouseX - x) / Math.max(1, w), 0, 1), v = min + t * (max - min);
        if (step > 0) v = min + Math.round((v - min) / step) * step;
        return Sky.clamp(round6(v), min, max);
    }
    /** Slider: knob x for a value. */
    public static int sliderPos(double v, int x, int w, double min, double max) { return x + (int) Math.round(Sky.clamp((v - min) / (max - min == 0 ? 1 : max - min), 0, 1) * w); }
    /** Keyboard nudge on a slider: one step, or 10 steps with shift. */
    public static double sliderNudge(double v, double min, double max, double step, int dir, boolean big) { return Sky.clamp(round6(v + dir * step * (big ? 10 : 1)), min, max); }
    static double round6(double v) { return Math.round(v * 1e6) / 1e6; }
    /** Setting step used by the launcher: integers step 1, doubles 10^floor(log10(range/50)). */
    public static double stepFor(Config.SettingDef d) { return d.type() == Config.Type.INT || d.type() == Config.Type.KEY ? 1 : Math.pow(10, Math.floor(Math.log10((d.max() - d.min()) / 50))); }
    /** The game's number format for a setting value, as the launcher writes it. */
    public static String formatSetting(Config.SettingDef d, double v) { if (d.type() == Config.Type.INT || d.type() == Config.Type.KEY) return String.valueOf(Math.round(v)); String s = String.valueOf(round6(v)); return s; }

    /** Segmented control: which segment (0-based) the mouse is over, given each segment's width, or -1. */
    public static int segmentAt(double mouseX, int x, int[] widths) { double p = mouseX - x; if (p < 0) return -1; for (int k = 0; k < widths.length; k++) { if (p < widths[k]) return k; p -= widths[k]; } return -1; }
    /** Next option in a list (wraps), for dropdown-style cycling with clicks, scroll or arrow keys. */
    public static String cycle(List<String> options, String current, int dir) { int i = options.indexOf(current); if (i < 0) return options.get(0); return options.get(Math.floorMod(i + dir, options.size())); }
    /** Focus order for keyboard navigation through n focusable widgets. */
    public static int nextFocus(int current, int n, int dir) { if (n <= 0) return -1; if (current < 0) return dir > 0 ? 0 : n - 1; return Math.floorMod(current + dir, n); }

    /** Scroll offset clamped so content never scrolls past its end. */
    public static double clampScroll(double offset, int content, int view) { return Sky.clamp(offset, 0, Math.max(0, content - view)); }
    /** Scroll offset that brings an item [top, top+h) fully into view. */
    public static double scrollTo(double offset, int top, int h, int view) { if (top < offset) return top; if (top + h > offset + view) return top + h - view; return offset; }
    /** Scrollbar thumb [y, height] for a track of the view's height, or null when everything fits. */
    public static int[] thumb(double offset, int content, int view, int minThumb) {
        if (content <= view) return null; int h = Math.max(minThumb, (int) Math.round(view * (double) view / content));
        return new int[]{(int) Math.round((view - h) * offset / (content - view)), h};
    }

    /** Modules for a category ("All" or a category label) and a search query (name, category or note, case-insensitive). */
    public static List<Config.Module> filter(Collection<Config.Module> mods, String category, String query) {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT); List<Config.Module> out = new ArrayList<>();
        for (Config.Module m : mods) {
            if (!"All".equals(category) && !m.cat().label.equals(category)) continue;
            if (!q.isEmpty() && !(m.name() + " " + m.cat().label + " " + m.note()).toLowerCase(Locale.ROOT).contains(q)) continue;
            out.add(m);
        }
        return out;
    }
    /** The category list shown in the menu: All, then each category that has modules, in registry order. */
    public static List<String> categories(Collection<Config.Module> mods) { LinkedHashSet<String> c = new LinkedHashSet<>(); c.add("All"); for (Config.Module m : mods) c.add(m.cat().label); return new ArrayList<>(c); }

    /** Friendly labels for setting option values, matching the launcher. */
    public static String optionLabel(String o) {
        return switch (o) { case "off" -> "Off (vanilla)"; case "auto" -> "Auto"; case "LOW" -> "Low"; case "BALANCED" -> "Balanced"; case "HIGH" -> "High";
            case "TL" -> "Top left"; case "TC" -> "Top centre"; case "TR" -> "Top right"; case "CL" -> "Centre left"; case "C" -> "Centre"; case "CR" -> "Centre right";
            case "BL" -> "Bottom left"; case "BC" -> "Bottom centre"; case "BR" -> "Bottom right"; default -> o.isEmpty() ? o : Character.toUpperCase(o.charAt(0)) + o.substring(1).replaceAll("([A-Z])", " $1").toLowerCase(Locale.ROOT); };
    }
    /** Which control a setting gets, the same rule as the launcher: segmented for up to 4 options, cycling dropdown above that. */
    public enum Control { SWITCH, SLIDER, SEGMENTED, DROPDOWN, COLOR, KEY }
    public static Control controlFor(Config.SettingDef d) {
        return switch (d.type()) { case BOOL -> Control.SWITCH; case COLOR -> Control.COLOR; case KEY -> Control.KEY; case ENUM -> d.options().size() <= 4 ? Control.SEGMENTED : Control.DROPDOWN; default -> Control.SLIDER; };
    }

    /** Time-based ease toward a target (frame-rate independent), for hover and open/close animations. */
    public static double approach(double cur, double target, double dt, double tauSeconds) { if (tauSeconds <= 0) return target; return cur + (target - cur) * (1 - Math.exp(-dt / tauSeconds)); }
}
