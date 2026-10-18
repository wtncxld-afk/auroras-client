package gg.auroras.core;

import java.util.*;

/**
 * Keystrokes widget: key layout, labels and press animation, shared by the in-game renderer and the launcher's HUD editor
 * (visuals/visuals.js mirrors it; visuals/hud-golden.json checks they agree). Sizes are GUI pixels at scale 1.
 */
public final class Keystrokes {
    private Keystrokes() {}
    /** The inputs a key can show, in the order the renderer reads them. */
    public static final int FORWARD = 0, LEFT = 1, BACK = 2, RIGHT = 3, ATTACK = 4, USE = 5, JUMP = 6, SNEAK = 7, SPRINT = 8, INPUTS = 9;
    public record Key(int input, int x, int y, int w, int h) {}
    public record Layout(List<Key> keys, int w, int h) {}

    /** Space bar height: a slim bar, or a full key when it shows the word "Space". */
    public static int spaceHeight(int size, String spaceStyle) { return "text".equals(spaceStyle) ? size : Math.max(6, Math.round(size * 0.5f)); }

    /**
     * W on top, A S D below, then the optional rows: mouse buttons, sneak and sprint, the space bar. Every row spans the
     * same width (three keys and two gaps), so half-width keys split it with the right one taking any odd pixel.
     */
    public static Layout layout(int size, int gap, boolean mouse, boolean modifiers, boolean space, String spaceStyle) {
        size = Math.max(8, size); gap = Math.max(0, gap);
        int w = size * 3 + gap * 2, half = (w - gap) / 2, y = 0; List<Key> k = new ArrayList<>();
        k.add(new Key(FORWARD, size + gap, y, size, size)); y += size + gap;
        k.add(new Key(LEFT, 0, y, size, size)); k.add(new Key(BACK, size + gap, y, size, size)); k.add(new Key(RIGHT, (size + gap) * 2, y, size, size)); y += size + gap;
        if (mouse) { k.add(new Key(ATTACK, 0, y, half, size)); k.add(new Key(USE, half + gap, y, w - half - gap, size)); y += size + gap; }
        if (modifiers) { int mh = Math.max(8, Math.round(size * 0.75f)); k.add(new Key(SNEAK, 0, y, half, mh)); k.add(new Key(SPRINT, half + gap, y, w - half - gap, mh)); y += mh + gap; }
        if (space) { int sh = spaceHeight(size, spaceStyle); k.add(new Key(JUMP, 0, y, w, sh)); y += sh + gap; }
        return new Layout(List.copyOf(k), w, y - gap);
    }

    private static final String[] WASD = {"W", "A", "S", "D", "LMB", "RMB", "Space", "Sneak", "Sprint"}, ARROWS = {"▲", "◀", "▼", "▶", "LMB", "RMB", "Space", "Sneak", "Sprint"};
    /**
     * What a key shows. mode "bound" uses the key the player actually bound (bound = Minecraft's key name, shortened);
     * "wasd" always shows W A S D; "arrows" shows arrows for movement. The space bar shows nothing when it is a slim bar.
     */
    public static String label(String mode, int input, String bound, String spaceStyle) {
        if (input == JUMP && !"text".equals(spaceStyle)) return "";
        if ("bound".equals(mode) && bound != null && !bound.isBlank()) { String s = shortName(bound); if (input == JUMP && s.equals("Space")) return "Space"; return s; }
        return ("arrows".equals(mode) ? ARROWS : WASD)[input];
    }
    private static final Map<String, String> SHORT = Map.ofEntries(Map.entry("left button", "LMB"), Map.entry("right button", "RMB"), Map.entry("middle button", "MMB"),
        Map.entry("left shift", "LShift"), Map.entry("right shift", "RShift"), Map.entry("left control", "LCtrl"), Map.entry("right control", "RCtrl"), Map.entry("left ctrl", "LCtrl"), Map.entry("right ctrl", "RCtrl"),
        Map.entry("left alt", "LAlt"), Map.entry("right alt", "RAlt"), Map.entry("caps lock", "Caps"), Map.entry("space", "Space"), Map.entry("not bound", "—"), Map.entry("up arrow", "▲"), Map.entry("down arrow", "▼"),
        Map.entry("left arrow", "◀"), Map.entry("right arrow", "▶"), Map.entry("up", "▲"), Map.entry("down", "▼"), Map.entry("left", "◀"), Map.entry("right", "▶"), Map.entry("enter", "Enter"), Map.entry("tab", "Tab"), Map.entry("backspace", "Bksp"));
    /** Minecraft key names shortened to fit a key: "Left Shift" -> "LShift", "Button 4" -> "M4", "Keypad 5" -> "Num5". Single characters are upper-cased. */
    public static String shortName(String name) {
        String n = name.trim(), low = n.toLowerCase(Locale.ROOT);
        if (SHORT.containsKey(low)) return SHORT.get(low);
        if (low.startsWith("button ")) return "M" + n.substring(7).trim();
        if (low.startsWith("mouse button ")) return "M" + n.substring(13).trim();
        if (low.startsWith("keypad ")) return "Num" + n.substring(7).trim();
        if (n.codePointCount(0, n.length()) == 1) return n.toUpperCase(Locale.ROOT);
        return n.length() <= 6 ? n : n.substring(0, 5) + "…";
    }
    /** Text scale that makes a label of width textW fit inside a key of width keyW with 2 px either side (never above 1). */
    public static float fitScale(int textW, int keyW) { return textW <= 0 ? 1f : Math.min(1f, Math.max(0.4f, (keyW - 4) / (float) textW)); }
    /** Whether a mouse key has room for a second, smaller CPS line under its label. */
    public static boolean cpsLine(int keyH) { return keyH >= 16; }
}
