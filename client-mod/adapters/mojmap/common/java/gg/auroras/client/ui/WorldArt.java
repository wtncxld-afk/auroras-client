package gg.auroras.client.ui;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). Drawing for the world overlays: glass nameplates, health bars, floating
// damage numbers and the model emblem. Callers project the world point to the screen (core WorldFx.View) and pass the
// GUI position and a size factor k; everything is drawn at the screen's real pixel size through Glass, so edges and
// Inter text stay sharp at any distance. Nothing here touches Minecraft classes, so tools/gui-preview renders it exactly
// as the game does.

import gg.auroras.client.platform.Gfx;
import gg.auroras.core.Sky;
import gg.auroras.core.UiArt;
import gg.auroras.core.WorldFx;
import net.minecraft.resources.Identifier;

public final class WorldArt {
    private WorldArt() {}
    public static final String W = "semibold";

    /** Nameplate look, filled from the module's settings when they change (one shared instance). */
    public static final class Plate {
        public int text = 0xFFFFFF, bg = 0x0C0F16, accent = 0x6FE3FF; public int bgPct = 25, radius = 4; public boolean border = true, shadow = true, vanillaFont;
        public String healthStyle = "bar";
    }
    static final double[] LAY = new double[8];
    /** Where the last plate's held-item slot went, {x, y, size} in GUI units (size 0 = none). */
    public static final double[] ITEM = new double[3];

    /** Whether the Inter atlas can draw s (it covers printable ASCII); otherwise the plate falls back to Minecraft's font. */
    public static boolean interCan(String s) { for (int i = 0; i < s.length(); i++) { char ch = s.charAt(i); if (ch < 32 || ch > 126) return false; } return true; }
    static double textW(Plate p, double size, String s) { return p.vanillaFont || !interCan(s) ? Gfx.width(s) * size / 8.0 : Glass.width(W, size, s); }
    static void text(Gfx c, Plate p, double size, String s, double x, double top, int argb) {
        if (p.vanillaFont || !interCan(s)) { c.push(); c.translate((float) x, (float) top); c.scale((float) (size / 8.0)); c.text(s, 0, 0, argb, p.shadow); c.pop(); return; }
        double g = Gfx.guiScale(); c.push(); c.scale((float) (1 / g)); AuroraFont.draw(c, W, size * g, s, Math.round(x * g), Math.round((top + size * 0.8) * g), argb, p.shadow); c.pop();
    }

    /**
     * A glass nameplate centred on cx with its bottom edge at bottom (GUI units), k GUI units per plate unit. hp is the
     * health fraction (negative = no health shown), hpText the number ("" = none), ping "" for none.
     */
    public static void nameplate(Gfx c, Plate p, double cx, double bottom, double k, String name, int nameRgb, double hp, String hpText, String ping, int pingRgb, boolean item, double alpha) {
        double row = 7, ts = 6.6; boolean bar = hp >= 0 && !"number".equals(p.healthStyle), num = hp >= 0 && !hpText.isEmpty() && !"bar".equals(p.healthStyle);
        String right = num ? (ping.isEmpty() ? hpText : hpText + "  " + ping) : ping;
        double nameW = textW(p, ts, name), rightW = right.isEmpty() ? 0 : textW(p, ts * 0.86, right) + (num ? 6 : 0);
        double[] L = WorldFx.plateLayout(nameW, rightW, item, bar, row, LAY);
        double w = L[0] * k, h = L[1] * k, x = cx - w / 2, y = bottom - h, r = Math.min(p.radius * k, h / 2);
        if (p.bgPct > 0) {
            Glass.shadow(c, x, y + 0.6 * k, w, h, r, 3 * k, argb(0x000000, 0.22 * p.bgPct / 100.0 * alpha));
            Glass.rect(c, x, y, w, h, r, argb(p.bg, p.bgPct / 100.0 * alpha));
            if (h > 2 * r) Glass.vgrad(c, x + r * 0.6, y + 0.4, w - r * 1.2, Math.min(h * 0.5, 6 * k), argb(0xFFFFFF, 0.07 * alpha), 0);
        }
        if (p.border) Glass.outline(c, x, y, w, h, r, argb(p.accent, 0.55 * alpha));
        double top = y + 2 * k + (row - ts) * k / 2;
        text(c, p, ts * k, name, x + L[2] * k, top, argb(nameRgb, alpha));
        if (!right.isEmpty()) {
            double rx = x + L[3] * k, rs = ts * 0.86 * k, rt = top + (ts - ts * 0.86) * k / 2;
            if (num) { heart(c, rx, rt + rs * 0.08, rs * 0.85, argb(WorldFx.healthColor(hp), alpha)); rx += 6 * k; }
            if (num && !ping.isEmpty()) {
                text(c, p, rs, hpText, rx, rt, argb(0xFFFFFF, 0.9 * alpha)); rx += textW(p, rs, hpText + "  ");
                text(c, p, rs, ping, rx, rt, argb(pingRgb, alpha));
            } else text(c, p, rs, right, rx, rt, argb(num ? 0xFFFFFF : pingRgb, (num ? 0.9 : 1) * alpha));
        }
        if (bar) bar(c, x + 4.5 * k, y + L[5] * k, L[6] * k, 2.5 * k, hp, 0, argb(0x000000, 0.35 * alpha), alpha, true, 0);
        ITEM[0] = x + L[4] * k; ITEM[1] = y + 1.5 * k; ITEM[2] = item ? (row + 1) * k : 0;
    }
    /** A rounded health bar: track, the health fill (gradient by health or one colour) and absorption in gold. */
    public static void bar(Gfx c, double x, double y, double w, double h, double frac, double absorb, int track, double alpha, boolean gradient, int rgb) {
        double r = h / 2, f = Sky.clamp(frac, 0, 1), ab = Sky.clamp(absorb, 0, 1);
        Glass.rect(c, x, y, w, h, r, track);
        int col = gradient ? WorldFx.healthColor(f) : rgb;
        if (f > 0) Glass.rect(c, x, y, Math.max(h, w * f), h, r, argb(col, alpha));
        if (ab > 0) Glass.rect(c, x, y, Math.max(h, w * ab), h * 0.45, r * 0.45, argb(0xFFD166, 0.9 * alpha));
    }
    /** A health bar card above an entity: centred on cx, bottom at bottom; k sizes it. */
    public static void healthCard(Gfx c, double cx, double bottom, double k, double widthUnits, double frac, double absorb, String label, boolean gradient, int rgb, int bgPct, double alpha) {
        double w = widthUnits * k, h = (label.isEmpty() ? 6 : 13) * k, x = cx - w / 2, y = bottom - h, r = Math.min(3 * k, h / 2);
        if (bgPct > 0) { Glass.shadow(c, x, y + 0.5 * k, w, h, r, 2.5 * k, argb(0, 0.2 * alpha * bgPct / 100.0)); Glass.rect(c, x, y, w, h, r, argb(0x0C0F16, bgPct / 100.0 * alpha)); }
        if (!label.isEmpty()) { double ts = 5.6 * k; Glass.text(c, W, ts, label, cx - Glass.width(W, ts, label) / 2, y + 2 * k + ts * 0.8, argb(0xFFFFFF, 0.92 * alpha)); }
        bar(c, x + 2 * k, y + h - 4 * k, w - 4 * k, 2 * k, frac, absorb, argb(0xFFFFFF, 0.12 * alpha), alpha, gradient, rgb);
    }
    /** A floating number centred on (cx, cy), size in GUI units, with an optional soft dark halo for legibility. */
    public static void number(Gfx c, String s, double cx, double cy, double size, int rgb, double alpha, boolean shadow) {
        double g = Gfx.guiScale(), w = Glass.width(W, size, s);
        if (shadow) Glass.shadow(c, cx - w / 2 - size * 0.15, cy - size * 0.35, w + size * 0.3, size * 0.7, size * 0.35, size * 0.45, argb(0x000000, 0.28 * alpha));
        c.push(); c.scale((float) (1 / g)); AuroraFont.draw(c, W, size * g, s, Math.round((cx - w / 2) * g), Math.round((cy + size * 0.36) * g), argb(rgb, alpha), shadow); c.pop();
    }
    /** A small heart (core WorldFx emblem art), size GUI units square. */
    public static void heart(Gfx c, double x, double y, double size, int argb) {
        int S = Math.max(4, (int) Math.round(size * Gfx.guiScale()));
        Identifier id = Glass.art("heart", S, 0, () -> WorldFx.emblemArt("heart", S, 0xFFFFFF, 0xFFFFFF, false), S, S);
        double g = Gfx.guiScale(); c.push(); c.scale((float) (1 / g)); c.texture(id, (int) Math.round(x * g), (int) Math.round(y * g), S, S, argb); c.pop();
    }

    /**
     * The emblem as a decal: centre (px, py) and the screen vectors of its half-width (ax, ay) and half-height downwards
     * (bx, by), so it foreshortens and turns with the body. glow adds a soft halo in the accent colour behind it.
     */
    public static void emblem(Gfx c, String design, int top, int bottom, boolean rim, boolean glow, double px, double py, double ax, double ay, double bx, double by, double alpha) {
        double half = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by)); if (half < 0.4 || alpha <= 0) return;
        int S = Math.max(16, Math.min(128, (int) Math.round(half * 2 * Gfx.guiScale() / 8) * 8));
        if (glow) {
            int G = 32; Identifier gid = Glass.art("emblemglow", G, 0, () -> UiArt.shadow(0, G / 2), G, G);
            c.push(); c.translate((float) px, (float) py); c.affine((float) (ax * 2 * 1.7 / G), (float) (ay * 2 * 1.7 / G), (float) (bx * 2 * 1.7 / G), (float) (by * 2 * 1.7 / G));
            c.texture(gid, -G / 2, -G / 2, G, G, argb(bottom, 0.45 * alpha)); c.pop();
        }
        Identifier id = Glass.art("emblem_" + design + (rim ? "_r" : ""), S, ((top & 0xFFFFFF) * 31 ^ (bottom & 0xFFFFFF)) & 0xFFFFFF, () -> WorldFx.emblemArt(design, S, top, bottom, rim), S, S);
        c.push(); c.translate((float) px, (float) py); c.affine((float) (ax * 2 / S), (float) (ay * 2 / S), (float) (bx * 2 / S), (float) (by * 2 / S));
        c.texture(id, -S / 2, -S / 2, S, S, argb(0xFFFFFF, alpha)); c.pop();
    }

    static int argb(int rgb, double a) { int al = (int) Math.round(255 * Sky.clamp(a, 0, 1)); return al << 24 | (rgb & 0xFFFFFF); }
}
