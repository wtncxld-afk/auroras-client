package gg.auroras.client.ui;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Drawing for the HUD widgets: glass cards with a soft shadow
// and a top sheen, Inter text at the screen's real pixel size (solid, chroma or gradient), the expanded style's icon chip,
// and the three keystroke looks (glass keys, creamy keycaps, classic flat boxes). Metrics are core HudSkin (tested
// there). Nothing here touches Minecraft classes, so tools/gui-preview renders it exactly as the game does.
//
// Callers pass the widget's on-screen origin (GUI units) and its scale; every size is multiplied here instead of scaling
// the pose, so text and edges stay sharp at any widget scale.

import gg.auroras.client.platform.Gfx;
import gg.auroras.core.HudKit;
import gg.auroras.core.HudSkin;
import gg.auroras.core.Keystrokes;
import gg.auroras.core.Sky;

public final class HudArt {
    private HudArt() {}
    public static final String W = "semibold", WL = "medium";

    /** One widget's look, filled from its settings each frame (one shared instance, so drawing allocates nothing). */
    public static final class Look {
        public double ox, oy, k = 1, fade = 1; public int color = 0xFFFFFF, accent = 0x6FE3FF, bgColor = 0x0C0F16, bgPct = 45, opacity = 100, radius = 2;
        public boolean bg = true, border, shadow = true; public String textMode = "solid"; public double chromaSpeed = 1, seconds;
        public double X(double x) { return ox + x * k; } public double Y(double y) { return oy + y * k; }
        /** ARGB for rgb at pct percent, times the widget's opacity and fade. */
        public int a(int rgb, double pct) { return HudKit.argb(rgb, (int) Math.round(pct * opacity / 100.0), fade); }
    }

    /** The card behind a widget, w x h GUI units at scale 1. */
    public static void card(Gfx c, Look l, double w, double h) {
        double x = l.X(0), y = l.Y(0), W = w * l.k, H = h * l.k, r = HudSkin.radius(l.radius, w, h) * l.k;
        if (l.bg && l.bgPct > 0) {
            double depth = l.bgPct / 100.0;
            Glass.shadow(c, x, y + 0.8 * l.k, W, H, r, 3.5 * l.k, l.a(0x000000, 22 * depth));
            Glass.rect(c, x, y, W, H, r, l.a(l.bgColor, l.bgPct));
            // a soft light across the top, inside the rounded part only
            if (H > 2 * r) Glass.vgrad(c, x + r * 0.6, y + 0.5, W - r * 1.2, Math.min(H * 0.55, 9 * l.k), l.a(0xFFFFFF, 7 * depth), 0);
        }
        if (l.border) Glass.outline(c, x, y, W, H, r, l.a(l.accent, 60));
        else if (l.bg && l.bgPct > 0) Glass.outline(c, x, y, W, H, r, l.a(0xFFFFFF, 9 * l.bgPct / 100.0));
    }
    /**
     * A text widget's frame: the card, then (expanded style) the icon chip and the small-caps label. Returns where the
     * first line goes: {x, top} in GUI units inside the widget. b is the card size from HudSkin.size.
     */
    public static double[] body(Gfx c, Look l, HudSkin.Card cd, int[] b, String icon, String label, int lines) {
        card(c, l, b[0], b[1]);
        double x0 = cd.padX(), block = HudSkin.textBlock(cd, lines) + (label != null ? cd.label() + cd.labelGap() : 0), y = (b[1] - block) / 2;
        if (cd.icon() > 0 && icon != null) { chip(c, l, icon, cd.padX(), (b[1] - cd.icon()) / 2.0, cd.icon()); x0 += cd.icon() + cd.iconGap(); }
        if (label != null) { label(c, l, cd.label(), label, x0, y); y += cd.label() + cd.labelGap(); }
        return new double[]{x0, y};
    }
    /** The expanded style's chip: a rounded square tinted with the accent, the widget's icon inside. */
    public static void chip(Gfx c, Look l, String icon, double x, double y, double size) {
        double X = l.X(x), Y = l.Y(y), S = size * l.k;
        Glass.rect(c, X, Y, S, S, S * 0.3, l.a(l.accent, 20)); Glass.outline(c, X, Y, S, S, S * 0.3, l.a(l.accent, 24));
        Glass.icon(c, icon, X + S * 0.22, Y + S * 0.22, S * 0.56, l.a(l.accent, 100));
    }
    /** Text width at scale 1 (GUI units). */
    public static double width(double size, String s) { return Glass.width(W, size, s); }
    public static double labelWidth(double size, String s) { return Glass.width(WL, size, s) * 1.08; }
    /**
     * A line of text with its top at y (GUI units inside the widget), in the widget's colour mode. Solid text is one
     * string; chroma and gradient colour each character, sampled at its position on screen so the wave flows across
     * neighbouring widgets the same way.
     */
    public static void text(Gfx c, Look l, double size, String s, double x, double top, int rgb, double alpha, int blendTo, double blend) {
        double px = size * l.k, X = l.X(x), base = l.Y(top) + px * 0.78, gs = Gfx.guiScale(); int pct = (int) Math.round(100 * alpha);
        c.push(); c.scale((float) (1 / gs));
        if (!HudKit.perChar(l.textMode)) {
            int col = blend > 0 ? Sky.mix(rgb, blendTo, blend) : rgb;
            AuroraFont.draw(c, W, px * gs, s, Math.round(X * gs), Math.round(base * gs), l.a(col, pct), l.shadow);
        } else {
            double cx = X * gs;
            for (int i = 0; i < s.length(); ) {
                int cp = s.codePointAt(i), n = Character.charCount(cp); String ch = s.substring(i, i + n); i += n;
                int col = HudKit.textColor(l.textMode, rgb, l.accent, cx / gs, l.seconds, l.chromaSpeed); if (blend > 0) col = Sky.mix(col, blendTo, blend);
                AuroraFont.draw(c, W, px * gs, ch, Math.round(cx), Math.round(base * gs), l.a(col, pct), l.shadow); cx += AuroraFont.width(W, px * gs, ch);
            }
        }
        c.pop();
    }
    public static void text(Gfx c, Look l, double size, String s, double x, double top, int rgb) { text(c, l, size, s, x, top, rgb, 1, 0, 0); }
    /** The expanded style's small capitals label above the value. */
    public static void label(Gfx c, Look l, double size, String s, double x, double top) {
        double px = size * l.k, gs = Gfx.guiScale(); c.push(); c.scale((float) (1 / gs));
        double cx = l.X(x) * gs, base = (l.Y(top) + px * 0.78) * gs, track = px * gs * 0.08;
        for (int i = 0; i < s.length(); i++) { String ch = s.substring(i, i + 1); AuroraFont.draw(c, WL, px * gs, ch, Math.round(cx), Math.round(base), l.a(Sky.mix(l.color, l.accent, 0.55), 70), false); cx += AuroraFont.width(WL, px * gs, ch) + track; }
        c.pop();
    }
    /** A rounded rectangle inside the widget (GUI units at scale 1). */
    public static void rect(Gfx c, Look l, double x, double y, double w, double h, double r, int argb) { Glass.rect(c, l.X(x), l.Y(y), w * l.k, h * l.k, r * l.k, argb); }

    // ----- keystrokes -----
    /**
     * One key. glow 0..1 is how pressed it looks (lit at once, fading on release). label may be "" (the slim space bar
     * draws a bar instead); sub is the optional CPS line. pressedPct / pressedText are the widget's pressed settings.
     */
    public static void key(Gfx c, Look l, String style, Keystrokes.Key key, double x0, double y0, double glow, String label, String sub, boolean bar, int pressedPct, int pressedText) {
        double x = x0 + key.x(), y = y0 + key.y(), w = key.w(), h = key.h(), p = HudSkin.press(glow);
        if (HudSkin.CREAMY.equals(style)) { creamy(c, l, x, y, w, h, glow, label, sub, bar); return; }
        double r = Math.min(HudSkin.radius(l.radius, w, h) + 1, h / 2);
        if (HudSkin.CLASSIC.equals(style)) {
            int rest = l.bg ? l.bgPct : 0, pct = (int) Math.round(rest + (pressedPct - rest) * glow);
            if (pct > 0) rect(c, l, x, y, w, h, HudSkin.radius(l.radius, w, h), l.a(Sky.mix(l.bgColor, l.accent, glow), pct));
            if (l.border) Glass.outline(c, l.X(x), l.Y(y), w * l.k, h * l.k, HudSkin.radius(l.radius, w, h) * l.k, l.a(l.accent, 55));
            keyLabel(c, l, x, y, w, h, label, sub, bar, l.color, pressedText, glow); return;
        }
        // glass: squishes toward its centre when pressed, fills with the accent and glows
        double s = HudSkin.squish(glow), gx = x + w * (1 - s) / 2, gy = y + h * (1 - s) / 2, gw = w * s, gh = h * s;
        if (p > 0.01) Glass.shadow(c, l.X(gx), l.Y(gy), gw * l.k, gh * l.k, r * l.k, 4 * l.k, l.a(l.accent, 38 * p));
        else if (l.bg) Glass.shadow(c, l.X(gx), l.Y(gy) + 0.6 * l.k, gw * l.k, gh * l.k, r * l.k, 2.5 * l.k, l.a(0x000000, 20 * l.bgPct / 100.0));
        int rest = l.bg ? l.bgPct : 0, pct = (int) Math.round(rest + (pressedPct - rest) * p);
        if (pct > 0) rect(c, l, gx, gy, gw, gh, r * s, l.a(Sky.mix(l.bgColor, l.accent, p), pct));
        if (gh > 2 * r) Glass.vgrad(c, l.X(gx + r * 0.6), l.Y(gy) + 0.5, (gw - r * 1.2) * l.k, Math.min(gh * 0.5, 7) * l.k, l.a(0xFFFFFF, 9 + 10 * p), 0);
        Glass.outline(c, l.X(gx), l.Y(gy), gw * l.k, gh * l.k, r * s * l.k, l.border ? l.a(l.accent, 60 + 30 * p) : l.a(Sky.mix(0xFFFFFF, l.accent, p), 10 + 30 * p));
        keyLabel(c, l, gx, gy, gw, gh, label, sub, bar, l.color, pressedText, p);
    }
    /** A creamy keycap: lip below, warm face on top that travels down over the lip when pressed. */
    static void creamy(Gfx c, Look l, double x, double y, double w, double h, double glow, String label, String sub, boolean bar) {
        HudSkin.Cap cap = HudSkin.CREAM; double lip = Math.min(cap.lip(), h * 0.2), t = Math.min(lip, HudSkin.travel(cap, glow)), r = Math.min(HudSkin.radius(Math.max(l.radius, 2), w, h) + 1, h / 2), p = HudSkin.press(glow);
        Glass.shadow(c, l.X(x), l.Y(y) + (1.2 - 0.6 * p) * l.k, w * l.k, h * l.k, r * l.k, (3 - 1.2 * p) * l.k, l.a(0x1A1008, 34 - 12 * p));
        rect(c, l, x, y + lip * 0.6, w, h - lip * 0.6, r, l.a(cap.side(), 100));                         // the lip (front edge of the cap)
        double fy = y + t, fh = h - lip; int face = Sky.mix(cap.top(), cap.topPressed(), p);
        rect(c, l, x, fy, w, fh, r, l.a(face, 100));                                                       // the face
        rect(c, l, x + w * 0.12, fy + 0.6, w * 0.76, Math.min(fh * 0.38, 4), Math.min(r, 2), l.a(cap.shine(), 45 - 25 * p)); // shine on the face
        if (glow > 0.01) Glass.outline(c, l.X(x), l.Y(fy), w * l.k, fh * l.k, r * l.k, l.a(l.accent, 40 * glow));
        // cocoa legends that darken when pressed; chroma and gradient text modes still apply
        keyLabel(c, l, x, fy, w, fh, label, sub, bar, cap.text(), 0x3A2A1C, p);
    }
    static void keyLabel(Gfx c, Look l, double x, double y, double w, double h, String label, String sub, boolean bar, int rgb, int pressedText, double g) {
        if (bar) { double lw = Math.max(4, w * 0.4), lh = h >= 12 ? 1.6 : 1.1; rect(c, l, x + (w - lw) / 2, y + (h - lh) / 2, lw, lh, lh / 2, l.a(Sky.mix(rgb, pressedText, g), 100)); return; }
        double ts = HudSkin.keyText(Math.min(h, w * 1.4)); String s = label;
        double tw = width(ts, s); if (tw > w - 4) { ts = Math.max(4, ts * (w - 4) / tw); tw = width(ts, s); }
        double block = ts * 0.74 + (sub != null ? ts * 0.62 + 1.5 : 0), top = y + (h - block) / 2 - ts * 0.04;
        boolean keepShadow = l.shadow; l.shadow = false; // a shadow inside a key reads as blur
        text(c, l, ts, s, x + (w - tw) / 2, top - ts * 0.04, rgb, 1, pressedText, g);
        if (sub != null) { double ss = ts * 0.62, sw = width(ss, sub); text(c, l, ss, sub, x + (w - sw) / 2, top + ts * 0.74 + 1.5, Sky.mix(rgb, l.bgColor, 0.3), 0.8, pressedText, g); }
        l.shadow = keepShadow;
    }
}
