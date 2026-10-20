package gg.auroras.core;

import java.util.Map;

/**
 * The look of the in-game HUD widgets: smooth glass cards with Inter text drawn at the screen's real pixel size, an
 * icon chip in the expanded style, and keystrokes as glass keys, soft "creamy" keycaps, or the old flat boxes. Sizes are
 * GUI units at scale 1 (doubles; the adapter converts to screen pixels). Placement still uses whole GUI pixels, so the
 * HUD editor's maths (Hud) is unchanged. Unit-tested in HudTests.
 */
public final class HudSkin {
    private HudSkin() {}

    /** Card metrics for one HudKit style: padding, text size and line pitch, the expanded label, the icon chip. */
    public record Card(double padX, double padY, double text, double line, double label, double labelGap, double icon, double iconGap) {}
    public static final Card MINIMAL = new Card(5, 3, 8, 10.5, 0, 0, 0, 0), COMPACT = new Card(4, 2, 7.5, 9.5, 0, 0, 0, 0),
        EXPANDED = new Card(6, 5.5, 8, 10.5, 5.5, 3, 17, 6);
    public static Card card(HudKit.Style st) { return switch (st) { case COMPACT -> COMPACT; case EXPANDED -> EXPANDED; default -> MINIMAL; }; }

    /** Height of the text block: n lines, the last one only as tall as the text itself. */
    public static double textBlock(Card c, int lines) { return lines <= 0 ? 0 : (lines - 1) * c.line() + c.text(); }
    /**
     * Whole-GUI-pixel card size for text whose widest line is textW, with lines lines, an optional label (labelW, 0 for
     * none) and the icon chip when the style has one. Never smaller than a square of the card's height, so one-digit
     * readouts don't look pinched.
     */
    public static int[] size(Card c, double textW, int lines, double labelW, boolean icon) {
        double body = Math.max(textW, labelW), lab = c.label() > 0 && labelW > 0 ? c.label() + c.labelGap() : 0, ic = icon && c.icon() > 0 ? c.icon() + c.iconGap() : 0;
        double h = Math.max(textBlock(c, lines) + lab, ic > 0 ? c.icon() : 0) + c.padY() * 2, w = body + ic + c.padX() * 2;
        int H = (int) Math.ceil(h - 1e-9); return new int[]{(int) Math.max(H, Math.ceil(w - 1e-9)), H};
    }
    /** Corner radius in GUI units: the setting (0..6) scaled up for the new cards, never more than a pill. */
    public static double radius(int setting, double w, double h) { return Math.max(0, Math.min(setting * 1.5, Math.min(w, h) / 2)); }

    /** Icon for each HUD widget (visuals/icons, drawn by scripts/draw-icons.py). */
    static final Map<String, String> ICONS = Map.ofEntries(Map.entry("fps", "gauge"), Map.entry("coords", "pin"), Map.entry("cps", "mouse"), Map.entry("clock", "clock"),
        Map.entry("ping", "signal"), Map.entry("potions", "flask"), Map.entry("armor", "shield"), Map.entry("direction", "compass"), Map.entry("target", "target"),
        Map.entry("memory", "chip"), Map.entry("biome", "leaf"), Map.entry("session", "hourglass"), Map.entry("sessioninfo", "hourglass"), Map.entry("serverinfo", "server"),
        Map.entry("frametime", "pulse"), Map.entry("spotify", "music"), Map.entry("modulelist", "list"), Map.entry("keystrokes", "keys"), Map.entry("freelookstatus", "eye"),
        Map.entry("brandinghud", "sparkles"));
    public static String icon(String id) { return ICONS.getOrDefault(id, "info"); }

    // ----- keystrokes -----
    public static final String GLASS = "glass", CREAMY = "creamy", CLASSIC = "classic";
    public static final java.util.List<String> KEY_STYLES = java.util.List.of(GLASS, CREAMY, CLASSIC);

    /**
     * A creamy keycap: a warm off-white top face sitting on a darker lip, like a cream PBT keycap seen slightly from the
     * front. Pressing pushes the face down over the lip. Colours are RGB.
     */
    public record Cap(double lip, int top, int topPressed, int side, int text, int shine) {}
    public static final Cap CREAM = new Cap(2.5, 0xF6EEE2, 0xEADCC7, 0xCDB696, 0x5A4532, 0xFFFFFF);

    /** Ease-out of a key's press glow (0..1): the key snaps down fast and settles, instead of moving linearly. */
    public static double press(double glow) { double g = Math.max(0, Math.min(1, glow)); return 1 - (1 - g) * (1 - g) * (1 - g); }
    /** How far a creamy key's face sits below its rest position (GUI units), 0 at rest, the full lip when held. */
    public static double travel(Cap c, double glow) { return c.lip() * press(glow); }
    /** Glass keys shrink a little toward their centre when pressed (1 at rest). */
    public static double squish(double glow) { return 1 - 0.06 * press(glow); }
    /** Label size for a key of height h (GUI units): about 45% of the key, between 5 and 11. */
    public static double keyText(double h) { return Math.max(5, Math.min(11, h * 0.45)); }
}
