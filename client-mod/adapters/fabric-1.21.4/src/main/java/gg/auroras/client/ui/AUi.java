package gg.auroras.client.ui;

// ADAPTER fabric-1.21.4 — UNCOMPILED. The in-game half of the Auroras design system: drawing primitives and widgets that
// use the same design tokens as the launcher (visuals/design-tokens.json, bundled at build time). Layout and interaction
// maths live in core UiKit, which is unit-tested; this file only draws. Minecraft's GUI is pixel based, so corners are
// cut by whole GUI pixels and icons are small pixel masks in one consistent style.

import gg.auroras.core.UiKit;
import gg.auroras.core.UiTokens;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

public final class AUi {
    private AUi() {}
    public static UiTokens T;
    /** Loads the bundled tokens once. If the file is missing or broken the built-in copy below keeps the GUI usable. */
    public static UiTokens tokens() {
        if (T != null) return T;
        try (InputStream in = AUi.class.getResourceAsStream("/assets/auroras_client/design-tokens.json")) { T = UiTokens.parse(new String(in.readAllBytes(), StandardCharsets.UTF_8)); }
        catch (Exception e) { System.out.println("[Auroras] design tokens couldn't be loaded, using defaults: " + e.getMessage()); T = UiTokens.parse(FALLBACK); }
        return T;
    }
    static final String FALLBACK = "{\"schema\":1,\"color\":{\"bg\":\"#0b0d12\",\"side\":\"#0f1218\",\"s1\":\"#141821\",\"s2\":\"#1a1f2a\",\"s3\":\"#222836\",\"line\":\"#232938\",\"lineStrong\":\"#2f3747\",\"text\":\"#e8ecf4\",\"mute\":\"#8a93a6\",\"faint\":\"#5d6577\",\"acc\":\"#8fd3ff\",\"accInk\":\"#06141f\",\"acc2\":\"#5fd0d6\",\"vio\":\"#a78bfa\",\"ok\":\"#6fcf97\",\"warn\":\"#e0b45a\",\"err\":\"#e57373\"},"
        + "\"space\":{\"1\":4,\"2\":8},\"radius\":{\"s\":6,\"m\":10,\"l\":14},\"font\":{\"md\":13},\"size\":{\"control\":32},\"motion\":{\"fast\":120,\"base\":160,\"slow\":240,\"ease\":[0.2,0.7,0.2,1]},\"game\":{\"panelAlpha\":0.92,\"scrimAlpha\":0.45,\"selectedAlpha\":0.16,\"guide\":\"#b58cff\"}}";

    /** Multiplies a color's alpha by a (for fade-in/out animations). */
    public static int fade(int argb, double a) { int al = (int) Math.round(((argb >>> 24) & 255) * Math.max(0, Math.min(1, a))); return (al << 24) | (argb & 0xFFFFFF); }
    public static int mix(int a, int b, double t) {
        t = Math.max(0, Math.min(1, t)); int r = (int) (((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t), g = (int) (((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t),
            bl = (int) ((a & 255) + ((b & 255) - (a & 255)) * t), al = (int) (((a >>> 24) & 255) + (((b >>> 24) & 255) - ((a >>> 24) & 255)) * t);
        return (al << 24) | (r << 16) | (g << 8) | bl;
    }

    /** Rounded rectangle with a 1-pixel corner cut (2 at r >= 2), optional 1-pixel border. */
    public static void box(DrawContext c, int x, int y, int w, int h, int fill, int border, int r) {
        if (w <= 0 || h <= 0) return; r = Math.min(r, Math.min(w, h) / 2);
        if (r <= 0) { c.fill(x, y, x + w, y + h, fill); if (border != 0) outline(c, x, y, w, h, border); return; }
        c.fill(x + r, y, x + w - r, y + h, fill); c.fill(x, y + r, x + r, y + h - r, fill); c.fill(x + w - r, y + r, x + w, y + h - r, fill);
        if (r >= 2) { c.fill(x + 1, y + 1, x + r, y + r, fill); c.fill(x + w - r, y + 1, x + w - 1, y + r, fill); c.fill(x + 1, y + h - r, x + r, y + h - 1, fill); c.fill(x + w - r, y + h - r, x + w - 1, y + h - 1, fill); }
        if (border != 0) {
            c.fill(x + r, y, x + w - r, y + 1, border); c.fill(x + r, y + h - 1, x + w - r, y + h, border); c.fill(x, y + r, x + 1, y + h - r, border); c.fill(x + w - 1, y + r, x + w, y + h - r, border);
            if (r >= 2) { c.fill(x + 1, y + 1, x + 2, y + 2, border); c.fill(x + w - 2, y + 1, x + w - 1, y + 2, border); c.fill(x + 1, y + h - 2, x + 2, y + h - 1, border); c.fill(x + w - 2, y + h - 2, x + w - 1, y + h - 1, border); }
        }
    }
    public static void outline(DrawContext c, int x, int y, int w, int h, int col) { c.fill(x, y, x + w, y + 1, col); c.fill(x, y + h - 1, x + w, y + h, col); c.fill(x, y, x + 1, y + h, col); c.fill(x + w - 1, y, x + w, y + h, col); }
    /** 1-pixel focus ring outside a widget, in the accent color. */
    public static void focusRing(DrawContext c, int x, int y, int w, int h) { box(c, x - 2, y - 2, w + 4, h + 4, 0, tokens().opaque("acc"), 2); }

    public static void text(DrawContext c, TextRenderer tr, String s, int x, int y, int col) { c.drawText(tr, s, x, y, col, false); }
    /** Text cut to maxW with an ellipsis (never overflowing its box). */
    public static void textFit(DrawContext c, TextRenderer tr, String s, int x, int y, int maxW, int col) { c.drawText(tr, UiKit.ellipsize(s, maxW, tr::getWidth), x, y, col, false); }

    // ---- Icons: 8x8 pixel masks, one stroke weight, drawn in a single color ----
    static final Map<String, String[]> ICONS = Map.ofEntries(
        Map.entry("hud", new String[]{"########", "#......#", "#.##...#", "#......#", "#......#", "#...##.#", "#......#", "########"}),
        Map.entry("user", new String[]{"...##...", "..####..", "..####..", "...##...", "........", ".######.", "########", "########"}),
        Map.entry("droplet", new String[]{"...#....", "..###...", "..###...", ".#####..", ".#####..", "#######.", ".#####..", "..###..."}),
        Map.entry("info", new String[]{"..####..", ".#....#.", "#..##..#", "#......#", "#..##..#", "#..##..#", ".#....#.", "..####.."}),
        Map.entry("sparkles", new String[]{"...#....", "...#....", ".#####..", "...#..#.", "...#.###", "......#.", ".#......", "###....."}),
        Map.entry("moon", new String[]{"..####..", ".###....", "###.....", "###.....", "###.....", "###....#", ".######.", "..####.."}),
        Map.entry("totem", new String[]{"..####..", "..#..#..", "..####..", "########", ".######.", "..####..", "..#..#..", "..####.."}),
        Map.entry("shirt", new String[]{".##..##.", "########", "########", "..####..", "..####..", "..####..", "..####..", "..####.."}),
        Map.entry("dots", new String[]{"........", ".#...#..", "........", "...#...#", "........", ".#...#..", "........", "...#...#"}),
        Map.entry("film", new String[]{"########", "#.####.#", "########", "#.#..#.#", "#.#..#.#", "########", "#.####.#", "########"}),
        Map.entry("star", new String[]{"...##...", "...##...", "########", ".######.", "..####..", ".##..##.", ".#....#.", "........"}),
        Map.entry("lock", new String[]{"..####..", ".#....#.", ".#....#.", "########", "########", "###..###", "########", "########"}),
        Map.entry("search", new String[]{".####...", "#....#..", "#....#..", "#....#..", ".####...", ".....#..", "......#.", ".......#"}),
        Map.entry("check", new String[]{"........", ".......#", "......##", "#....##.", "##..##..", ".####...", "..##....", "........"}),
        Map.entry("gear", new String[]{"..#..#..", ".######.", "##....##", ".#.##.#.", ".#.##.#.", "##....##", ".######.", "..#..#.."}),
        Map.entry("reset", new String[]{"#.####..", "##....#.", "###....#", ".......#", ".......#", "#......#", ".#....#.", "..####.."}));
    public static void icon(DrawContext c, String name, int x, int y, int col) {
        String[] m = ICONS.getOrDefault(name, ICONS.get("gear"));
        for (int r = 0; r < 8; r++) { String row = m[r]; int run = -1; for (int k = 0; k <= 8; k++) { boolean on = k < 8 && row.charAt(k) == '#'; if (on && run < 0) run = k; if (!on && run >= 0) { c.fill(x + run, y + r, x + k, y + r + 1, col); run = -1; } } }
    }
    public static String categoryIcon(String label) {
        return switch (label) { case "HUD & Overlays" -> "hud"; case "Player" -> "user"; case "Color & Rendering" -> "droplet"; case "Information" -> "info"; case "Cosmetics" -> "sparkles";
            case "World & Sky" -> "moon"; case "Totems" -> "totem"; case "Player Visuals" -> "shirt"; case "Particles & Effects" -> "dots"; case "Animations" -> "film"; default -> "gear"; };
    }

    // ---- Widgets (sizes in GUI pixels) ----
    public static final int SWITCH_W = 18, SWITCH_H = 10, CONTROL_H = 14, ROW_H = 20;
    /** Switch; anim 0..1 is the knob position (animate it with UiKit.approach). */
    public static void toggle(DrawContext c, int x, int y, double anim, boolean hover, boolean enabled) {
        UiTokens t = tokens(); int track = mix(t.opaque("s3"), t.opaque("acc"), anim);
        if (!enabled) track = fade(track, 0.45);
        box(c, x, y, SWITCH_W, SWITCH_H, track, hover && enabled ? t.opaque("lineStrong") : t.opaque("line"), 2);
        int kx = x + 2 + (int) Math.round(anim * (SWITCH_W - 10)); int knob = mix(t.opaque("mute"), t.opaque("accInk"), anim);
        box(c, kx, y + 2, 6, 6, enabled ? knob : fade(knob, 0.5), 0, 2);
    }
    public static void slider(DrawContext c, int x, int y, int w, double min, double max, double v, boolean hover, boolean focus) {
        UiTokens t = tokens(); int cy = y + CONTROL_H / 2, kx = UiKit.sliderPos(v, x, w, min, max);
        c.fill(x, cy - 1, x + w, cy + 1, t.opaque("line")); c.fill(x, cy - 1, kx, cy + 1, t.opaque("acc"));
        box(c, kx - 3, cy - 3, 7, 7, t.opaque("text"), hover || focus ? t.opaque("acc") : t.opaque("lineStrong"), 2);
        if (focus) focusRing(c, x, y + 1, w, CONTROL_H - 2);
    }
    /** Segmented control; returns each segment's width so the screen can hit-test with UiKit.segmentAt. */
    public static int[] segmented(DrawContext c, TextRenderer tr, int x, int y, List<String> labels, int sel, int hover, boolean focus) {
        UiTokens t = tokens(); int[] ws = new int[labels.size()]; int total = 2;
        for (int k = 0; k < ws.length; k++) { ws[k] = tr.getWidth(labels.get(k)) + 10; total += ws[k]; }
        box(c, x, y, total, CONTROL_H, t.opaque("bg"), t.opaque("line"), 2); int px = x + 1;
        for (int k = 0; k < ws.length; k++) {
            if (k == sel) box(c, px, y + 1, ws[k], CONTROL_H - 2, t.opaque("s2"), t.opaque("lineStrong"), 2); else if (k == hover) box(c, px, y + 1, ws[k], CONTROL_H - 2, t.argb("s2", 0.6), 0, 2);
            text(c, tr, labels.get(k), px + 5, y + 3, k == sel ? t.opaque("text") : t.opaque("mute")); px += ws[k];
        }
        if (focus) focusRing(c, x, y, total, CONTROL_H);
        return ws;
    }
    /** Dropdown-style field: value with a chevron; click or arrow keys cycle through options. */
    public static void dropdown(DrawContext c, TextRenderer tr, int x, int y, int w, String value, boolean hover, boolean focus) {
        UiTokens t = tokens(); box(c, x, y, w, CONTROL_H, t.opaque("bg"), hover ? t.opaque("mute") : t.opaque("line"), 2);
        textFit(c, tr, value, x + 5, y + 3, w - 16, t.opaque("text"));
        int ax = x + w - 9, ay = y + 6; c.fill(ax, ay, ax + 5, ay + 1, t.opaque("mute")); c.fill(ax + 1, ay + 1, ax + 4, ay + 2, t.opaque("mute")); c.fill(ax + 2, ay + 2, ax + 3, ay + 3, t.opaque("mute"));
        if (focus) focusRing(c, x, y, w, CONTROL_H);
    }
    public static void swatch(DrawContext c, TextRenderer tr, int x, int y, int rgb, boolean hover, boolean focus) {
        UiTokens t = tokens(); box(c, x, y, CONTROL_H, CONTROL_H, 0xFF000000 | rgb, hover ? t.opaque("mute") : t.opaque("lineStrong"), 2);
        text(c, tr, String.format("%06X", rgb & 0xFFFFFF), x + CONTROL_H + 4, y + 3, t.opaque("mute"));
        if (focus) focusRing(c, x, y, CONTROL_H, CONTROL_H);
    }
    public static void button(DrawContext c, TextRenderer tr, int x, int y, int w, String label, boolean primary, boolean hover, boolean focus, boolean enabled) {
        UiTokens t = tokens(); int fill = primary ? t.opaque("acc") : t.opaque("s2"), border = primary ? 0 : hover ? t.opaque("mute") : t.opaque("line");
        if (primary && hover) fill = mix(fill, 0xFFFFFFFF, 0.08); if (!enabled) fill = fade(fill, 0.45);
        box(c, x, y, w, CONTROL_H + 2, fill, border, 2);
        int tw = tr.getWidth(label); text(c, tr, label, x + (w - tw) / 2, y + 4, primary ? t.opaque("accInk") : enabled ? t.opaque("text") : t.opaque("faint"));
        if (focus) focusRing(c, x, y, w, CONTROL_H + 2);
    }
    /** Tooltip box near the mouse, wrapped to two lines and kept on screen. */
    public static void tooltip(DrawContext c, TextRenderer tr, String s, int mx, int my, int sw, int sh) {
        if (s == null || s.isEmpty()) return; UiTokens t = tokens(); List<String> lines = UiKit.wrap(s, 180, 3, tr::getWidth);
        int w = 0; for (String l : lines) w = Math.max(w, tr.getWidth(l)); w += 10; int h = lines.size() * 10 + 6;
        int x = Math.min(mx + 10, sw - w - 4), y = Math.min(my + 12, sh - h - 4); if (y < 4) y = 4;
        c.getMatrices().push(); c.getMatrices().translate(0, 0, 400);
        box(c, x, y, w, h, t.argb("s3", 0.97), t.opaque("lineStrong"), 2);
        for (int k = 0; k < lines.size(); k++) text(c, tr, lines.get(k), x + 5, y + 4 + k * 10, t.opaque("text"));
        c.getMatrices().pop();
    }
    public static void scrollbar(DrawContext c, int x, int y, int h, double offset, int content) {
        int[] th = UiKit.thumb(offset, content, h, 12); if (th == null) return; UiTokens t = tokens();
        c.fill(x, y + th[0], x + 2, y + th[0] + th[1], t.opaque("lineStrong"));
    }
}
