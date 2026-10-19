package gg.auroras.client.ui;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. The in-game half of the Auroras design system: drawing primitives and widgets that
// use the same design tokens as the launcher (visuals/design-tokens.json, bundled at build time). Layout and interaction
// maths live in core UiKit, which is unit-tested; this file only draws. Minecraft's GUI is pixel based, so corners are
// cut by whole GUI pixels and icons are small pixel masks in one consistent style.

import gg.auroras.core.UiKit;
import gg.auroras.core.UiTokens;
import gg.auroras.client.platform.Gfx;

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

    /** Rounded rectangle (smooth corners, radius r x 2 GUI units) with an optional hairline border. */
    public static void box(Gfx c, double x, double y, double w, double h, int fill, int border, int r) {
        if (w <= 0 || h <= 0) return; double R = Math.min(r * 2, Math.min(w, h) / 2);
        Glass.rect(c, x, y, w, h, R, fill); if (border != 0) Glass.outline(c, x, y, w, h, R, border);
    }
    public static void outline(Gfx c, int x, int y, int w, int h, int col) { Glass.outline(c, x, y, w, h, 0.5, col); }
    /** Focus ring just outside a widget, in the accent color. */
    public static void focusRing(Gfx c, double x, double y, double w, double h) { Glass.outline(c, x - 2, y - 2, w + 4, h + 4, Math.min(8, (h + 4) / 2), fade(tokens().opaque("acc"), 0.9)); }

    /** UI text size (GUI units) and weight: the Auroras font (Inter), sharp at the screen's real resolution. */
    public static final double TEXT = 7.5; public static final String W = "medium";
    /** Text with its top at y (the old Minecraft-font convention: 8 units tall line). */
    public static void text(Gfx c, String s, double x, double y, int col) { Glass.text(c, W, TEXT, s, x, y + 6.6, col); }
    /** Text cut to maxW with an ellipsis (never overflowing its box). */
    public static void textFit(Gfx c, String s, double x, double y, double maxW, int col) { text(c, Glass.fit(W, TEXT, s, maxW), x, y, col); }
    public static double width(String s) { return Glass.width(W, TEXT, s); }

    // ---- Icons: smooth line icons (visuals/icons), drawn at 8 GUI units unless sized ----
    public static void icon(Gfx c, String name, double x, double y, int col) { Glass.icon(c, name, x, y, 8, col); }
    public static String categoryIcon(String label) {
        return switch (label) { case "All" -> "grid"; case "HUD & Overlays" -> "hud"; case "Player" -> "user"; case "Color & Rendering" -> "droplet"; case "Information" -> "info"; case "Cosmetics" -> "sparkles";
            case "World & Sky" -> "moon"; case "Totems" -> "totem"; case "Player Visuals" -> "shirt"; case "Particles & Effects" -> "dots"; case "Animations" -> "film"; default -> "gear"; };
    }

    // ---- Widgets (sizes in GUI units; drawn smooth by Glass) ----
    public static final int SWITCH_W = 22, SWITCH_H = 12, CONTROL_H = 14, ROW_H = 24;
    static final int WHITE = 0xFFFFFFFF, BLACK = 0xFF000000;
    /** Switch; anim 0..1 is the knob position (animate it with UiKit.approach). */
    public static void toggle(Gfx c, double x, double y, double anim, boolean hover, boolean enabled) {
        UiTokens t = tokens(); double a = enabled ? 1 : 0.45;
        int track = mix(fade(WHITE, hover ? 0.16 : 0.11), t.opaque("acc"), anim);
        Glass.rect(c, x, y, SWITCH_W, SWITCH_H, SWITCH_H / 2.0, fade(track, a));
        if (anim > 0.02) Glass.shadow(c, x, y, SWITCH_W, SWITCH_H, SWITCH_H / 2.0, 4, fade(t.opaque("acc"), 0.28 * anim * a));
        double kx = x + SWITCH_H / 2.0 + anim * (SWITCH_W - SWITCH_H), ky = y + SWITCH_H / 2.0;
        Glass.circle(c, kx, ky + 0.4, 4.6, fade(BLACK, 0.25 * a));
        Glass.circle(c, kx, ky, 4.4, fade(mix(0xFFD9DEE8, WHITE, anim), a));
    }
    public static void slider(Gfx c, double x, double y, double w, double min, double max, double v, boolean hover, boolean focus) {
        UiTokens t = tokens(); double cy = y + CONTROL_H / 2.0 - 2, f = max > min ? Math.max(0, Math.min(1, (v - min) / (max - min))) : 0, kx = x + f * w;
        Glass.rect(c, x, cy - 2, w, 4, 2, fade(WHITE, 0.1));
        if (kx - x > 0.5) { Glass.rect(c, x, cy - 2, kx - x, 4, 2, t.opaque("acc")); Glass.shadow(c, x, cy - 2, kx - x, 4, 2, 3, fade(t.opaque("acc"), 0.25)); }
        if (hover || focus) Glass.circle(c, kx, cy, 8, fade(t.opaque("acc"), focus ? 0.28 : 0.18));
        Glass.circle(c, kx, cy + 0.6, 5.4, fade(BLACK, 0.3)); Glass.circle(c, kx, cy, 5, WHITE);
        Glass.circle(c, kx, cy, 1.8, t.opaque("acc"));
    }
    /** Each segment's width for these labels (drawing and hit testing use the same numbers). */
    public static int[] segWidths(List<String> labels) { int[] ws = new int[labels.size()]; for (int k = 0; k < ws.length; k++) ws[k] = (int) Math.ceil(Glass.width(W, 7, labels.get(k))) + 12; return ws; }
    public static int segTotal(List<String> labels) { int total = 2; for (int v : segWidths(labels)) total += v; return total; }
    /** Segmented control; returns each segment's width so the screen can hit-test with UiKit.segmentAt. */
    public static int[] segmented(Gfx c, double x, double y, List<String> labels, int sel, int hover, boolean focus) {
        UiTokens t = tokens(); int[] ws = segWidths(labels); int total = segTotal(labels);
        Glass.rect(c, x, y, total, CONTROL_H, 6, t.argb("bg", 0.6)); Glass.outline(c, x, y, total, CONTROL_H, 6, fade(WHITE, 0.07)); double px = x + 1;
        for (int k = 0; k < ws.length; k++) {
            if (k == sel) { Glass.rect(c, px, y + 1, ws[k], CONTROL_H - 2, 5, mix(t.opaque("s3"), t.opaque("acc"), 0.22)); Glass.outline(c, px, y + 1, ws[k], CONTROL_H - 2, 5, fade(t.opaque("acc"), 0.45)); }
            else if (k == hover) Glass.rect(c, px, y + 1, ws[k], CONTROL_H - 2, 5, fade(WHITE, 0.05));
            Glass.labelCentred(c, W, 7, labels.get(k), px + ws[k] / 2.0, y + CONTROL_H / 2.0, k == sel ? t.opaque("text") : t.opaque("mute")); px += ws[k];
        }
        if (focus) focusRing(c, x, y, total, CONTROL_H);
        return ws;
    }
    /** Dropdown-style field: value with a chevron; click or arrow keys cycle through options. */
    public static void dropdown(Gfx c, double x, double y, double w, String value, boolean hover, boolean focus) {
        UiTokens t = tokens(); Glass.rect(c, x, y, w, CONTROL_H, 6, t.argb("bg", 0.6)); Glass.outline(c, x, y, w, CONTROL_H, 6, fade(WHITE, hover ? 0.18 : 0.08));
        Glass.label(c, W, 7.5, value, x + 7, y + CONTROL_H / 2.0, w - 22, t.opaque("text"));
        Glass.icon(c, "chevron", x + w - 13, y + 3.5, 7, t.opaque("mute"));
        if (focus) focusRing(c, x, y, w, CONTROL_H);
    }
    public static void swatch(Gfx c, double x, double y, int rgb, boolean hover, boolean focus) {
        UiTokens t = tokens(); Glass.shadow(c, x, y, CONTROL_H, CONTROL_H, 5, 3, fade(0xFF000000 | rgb, 0.35));
        Glass.rect(c, x, y, CONTROL_H, CONTROL_H, 5, 0xFF000000 | rgb); Glass.outline(c, x, y, CONTROL_H, CONTROL_H, 5, fade(WHITE, hover ? 0.5 : 0.22));
        Glass.label(c, W, 7, "#" + String.format("%06X", rgb & 0xFFFFFF), x + CONTROL_H + 5, y + CONTROL_H / 2.0, 0, t.opaque("mute"));
        if (focus) focusRing(c, x, y, CONTROL_H, CONTROL_H);
    }
    public static void button(Gfx c, double x, double y, double w, String label, boolean primary, boolean hover, boolean focus, boolean enabled) { button(c, x, y, w, CONTROL_H + 2, null, label, primary, hover, focus, enabled); }
    /** Button with an optional icon before the label. */
    public static void button(Gfx c, double x, double y, double w, double h, String icon, String label, boolean primary, boolean hover, boolean focus, boolean enabled) {
        UiTokens t = tokens(); double a = enabled ? 1 : 0.45; int acc = t.opaque("acc");
        if (primary) { Glass.shadow(c, x, y, w, h, 6, 5, fade(acc, (hover ? 0.4 : 0.25) * a)); Glass.rect(c, x, y, w, h, 6, fade(hover ? mix(acc, WHITE, 0.12) : acc, a)); }
        else { Glass.rect(c, x, y, w, h, 6, fade(mix(t.opaque("s2"), acc, hover ? 0.2 : 0.1), a)); Glass.outline(c, x, y, w, h, 6, fade(acc, (hover ? 0.5 : 0.28) * a)); }
        int ink = primary ? t.opaque("accInk") : enabled ? mix(t.opaque("text"), acc, 0.35) : t.opaque("faint");
        double tw = Glass.width("semibold", 7.5, label), iw = icon == null ? 0 : 10, lx = x + (w - tw - iw) / 2;
        if (icon != null) Glass.icon(c, icon, lx, y + h / 2.0 - 4, 8, ink);
        Glass.label(c, "semibold", 7.5, label, lx + iw, y + h / 2.0, 0, ink);
        if (focus) focusRing(c, x, y, w, h);
    }
    /** Tooltip card near the mouse, wrapped to three lines and kept on screen. */
    public static void tooltip(Gfx c, String s, int mx, int my, int sw, int sh) {
        if (s == null || s.isEmpty()) return; UiTokens t = tokens(); List<String> lines = UiKit.wrap(s, 170, 3, q -> (int) Math.ceil(Glass.width("medium", 7, q)));
        double w = 0; for (String l : lines) w = Math.max(w, Glass.width("medium", 7, l)); w += 14; double h = lines.size() * 10 + 8;
        double x = Math.min(mx + 10, sw - w - 4), y = Math.min(my + 12, sh - h - 4); if (y < 4) y = 4;
        Glass.shadow(c, x, y + 2, w, h, 6, 8, fade(BLACK, 0.45)); Glass.rect(c, x, y, w, h, 6, t.argb("s3", 0.97)); Glass.outline(c, x, y, w, h, 6, fade(WHITE, 0.1));
        for (int k = 0; k < lines.size(); k++) Glass.label(c, "medium", 7, lines.get(k), x + 7, y + 9 + k * 10, 0, t.opaque("text"));
    }
    public static void scrollbar(Gfx c, double x, double y, double h, double offset, int content) {
        int[] th = UiKit.thumb(offset, content, (int) h, 16); if (th == null) return;
        Glass.rect(c, x, y + th[0], 3, th[1], 1.5, fade(WHITE, 0.18));
    }
}
