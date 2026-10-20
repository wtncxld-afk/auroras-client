package gg.auroras.client.ui;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). Drawing for the Auroras main menu and pause menu: the themed backdrop,
// the logo and wordmark, glass buttons with their hover, press, focus and entrance motion, and small text links. Only
// Gfx / Glass / AuroraFont, no Minecraft classes, so tools/gui-preview renders it exactly as the game does. Layout and
// timing come from core GameMenus (tested in UiTests).

import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Platform;
import gg.auroras.core.GameMenus;
import gg.auroras.core.MenuTheme;
import gg.auroras.core.UiArt;
import gg.auroras.core.UiTokens;
import net.minecraft.resources.Identifier;

public final class MenuKit {
    private MenuKit() {}
    static final int WHITE = 0xFFFFFFFF, BLACK = 0xFF000000;

    // ---- backdrop ----
    /**
     * The main menu's backdrop (there is no world behind it): a deep gradient in the theme's colours, two slow glows of
     * its accents, the theme's animated effect (aurora curtains, petals, stars...), and soft shading at the edges.
     * t is seconds since the menu opened (the glows drift with it), alpha the fade-in.
     */
    public static void titleBackdrop(Gfx c, double w, double h, double t, double alpha, boolean leftLayout) {
        MenuTheme.Theme th = AUi.theme(); int tint = th.tint();
        int base = AUi.mix(0xFF05070C, 0xFF000000 | tint, 0.55);
        c.fill(0, 0, (int) Math.ceil(w), (int) Math.ceil(h), base);
        // a lighter sky toward the top, in the theme's tint
        Glass.vgrad(c, 0, 0, w, h * 0.75, AUi.fade(AUi.mix(0xFF000000 | tint, WHITE, 0.10), 0.85), 0);
        // two big soft glows that drift very slowly (sizes stay fixed, so their art is baked once)
        double d = Math.sin(t * 0.07), e = Math.cos(t * 0.05);
        glow(c, w * (0.70 + 0.04 * d), h * (0.28 + 0.03 * e), h * 0.55, AUi.fade(0xFF000000 | th.acc(), 0.13 * alpha));
        glow(c, w * (0.30 - 0.03 * e), h * (0.86 + 0.02 * d), h * 0.50, AUi.fade(0xFF000000 | th.acc2(), 0.10 * alpha));
        MenuFx.draw(c, w, h, alpha);
        // shading: the bottom (footer text) and, with the column on the left, the left side so the buttons read clearly
        shadeBottom(c, w, h, h * 0.30, AUi.fade(0xFF02030A, 0.70));
        if (leftLayout) shadeLeft(c, w, h, Math.min(w * 0.55, 320), AUi.fade(0xFF02030A, 0.55));
        Glass.vgrad(c, 0, 0, w, h * 0.12, AUi.fade(0xFF02030A, 0.35), 0);
    }
    /** The pause menu's backdrop: the world dimmed and tinted toward the theme, with the theme's effect over it, softly. */
    public static void pauseBackdrop(Gfx c, double w, double h, double alpha) {
        MenuTheme.Theme th = AUi.theme();
        c.fill(0, 0, (int) Math.ceil(w), (int) Math.ceil(h), AUi.fade(AUi.mix(0xFF05070C, 0xFF000000 | th.tint(), 0.35), 0.52 * alpha));
        Glass.vgrad(c, 0, 0, w, h * 0.5, AUi.fade(0xFF05070C, 0.30 * alpha), 0);
        shadeBottom(c, w, h, h * 0.45, AUi.fade(0xFF02030A, 0.45 * alpha));
        glow(c, w * 0.5, h * 0.5, Math.min(w, h) * 0.65, AUi.fade(0xFF000000 | th.acc(), 0.07 * alpha));
        MenuFx.draw(c, w, h, alpha * 0.75);
    }
    /** A soft round glow of radius r centred on (cx, cy). */
    public static void glow(Gfx c, double cx, double cy, double r, int argb) {
        if ((argb >>> 24) == 0) return; double core = Math.max(2, Math.round(r * 0.18)); Glass.shadow(c, cx - core, cy - core, core * 2, core * 2, core, r - core, argb);
    }
    /** A shade rising from the bottom edge, height units tall (a top-down gradient turned half a turn). */
    public static void shadeBottom(Gfx c, double w, double h, double height, int argb) { c.push(); c.translate((float) w, (float) h); c.rotate((float) Math.PI); Glass.vgrad(c, 0, 0, w, height, argb, 0); c.pop(); }
    /** A shade from the left edge, width units wide (a top-down gradient turned a quarter turn). */
    public static void shadeLeft(Gfx c, double w, double h, double width, int argb) { c.push(); c.translate(0, (float) h); c.rotate((float) (-Math.PI / 2)); Glass.vgrad(c, 0, 0, h, width, argb, 0); c.pop(); }

    // ---- brand ----
    /** The baked sizes (px) of the display face and the regular SemiBold under it (scripts/bake-font.py). */
    static final int[] BAKED = {96, 80, 64, 48, 44, 36, 33, 32, 28, 27, 24, 22, 21, 20, 18, 16, 14, 12};
    /**
     * A text size near want (GUI units) that lands on a baked pixel size at this GUI scale, so big titles are drawn 1:1
     * and stay sharp instead of being scaled down with Minecraft's unfiltered sampling.
     */
    public static double snap(double want) { double gs = Gfx.guiScale(), px = want * gs; for (int b : BAKED) if (b <= px + 0.5) return b / gs; return want; }
    /** Display text: the large baked Inter (sharp up to 96 px), or the regular weight where that would be scaled down too far. */
    public static String display(double size) { return size * Gfx.guiScale() >= 44 ? "display" : "semibold"; }
    /**
     * The logo block inside box r: the Auroras logo with a glow, the wordmark and "CLIENT" spaced out in the accent.
     * e is the entrance (0..1), centred puts the block in the middle of the box.
     */
    public static void brand(Gfx c, GameMenus.Rect r, double e, boolean centred, Identifier logo) {
        if (e <= 0.003) return; UiTokens t = AUi.tokens(); int acc = t.opaque("acc");
        double ls = Math.min(40, r.h() - 6), ws = snap(ls * 0.62), gap = ls * 0.28; String wf = display(ws);
        double wordW = Glass.width(wf, ws, "Auroras"), total = ls + gap + Math.max(wordW, Glass.width("semibold", 6.5, "C L I E N T"));
        double x = centred ? r.cx() - total / 2 : r.x(), y = r.y() + (r.h() - ls) / 2 + (1 - e) * 6;
        glow(c, x + ls / 2, y + ls / 2, ls * 1.15, AUi.fade(acc, 0.30 * e));
        if (!emblem(c, x - ls * 0.08, y - ls * 0.08, ls * 1.16, e)) { c.push(); c.translate((float) x, (float) y); c.scale((float) (ls / 32.0)); c.texture(logo, 0, 0, 32, 32, AUi.fade(WHITE, e)); c.pop(); }
        double tx = x + ls + gap, base = y + ls * 0.60;
        Glass.text(c, wf, ws, "Auroras", tx, base, AUi.fade(t.opaque("text"), e));
        spaced(c, "CLIENT", tx + 1, base + 9.5, 6.5, 2.2, AUi.fade(acc, 0.95 * e));
    }
    private static int[] emblemPx; private static int emW, emH; private static boolean emTried;
    private static final java.util.Map<Integer, Identifier> EMBLEM = new java.util.HashMap<>();
    /**
     * The Auroras "A" emblem (textures/gui/emblem.png, cut from the launcher icon by scripts/make-emblem.py) in a
     * size x size GUI-unit box, resized smoothly to the screen's real pixels once per size. False if it couldn't load.
     */
    public static boolean emblem(Gfx c, double x, double y, double size, double alpha) {
        if (!emTried) { emTried = true; int[] wh = new int[2]; emblemPx = Platform.png("/assets/auroras_client/textures/gui/emblem.png", wh); emW = wh[0]; emH = wh[1]; }
        if (emblemPx == null || alpha <= 0.003) return emblemPx != null;
        double gs = Gfx.guiScale(); int S = Math.max(4, (int) Math.round(size * gs));
        Identifier id = EMBLEM.computeIfAbsent(S, k -> { Identifier i = Identifier.fromNamespaceAndPath("auroras_client", "ui/emblem_" + k); Platform.texture(i, UiArt.resize(emblemPx, emW, emH, k, k), k, k); return i; });
        c.push(); c.scale((float) (1 / gs)); c.texture(id, (int) Math.round(x * gs), (int) Math.round(y * gs), S, S, AUi.fade(WHITE, alpha)); c.pop();
        return true;
    }
    /** Letter-spaced small caps (spacing in GUI units between letters). */
    public static void spaced(Gfx c, String s, double x, double baseline, double size, double spacing, int argb) {
        double px = x; for (int i = 0; i < s.length(); i++) { String ch = s.substring(i, i + 1); Glass.text(c, "semibold", size, ch, px, baseline, argb); px += Glass.width("semibold", size, ch) + spacing; }
    }

    // ---- buttons ----
    /** One button's live state, eased by the screen on real frame time. */
    public static final class Anim { public double hover, press, focus; }
    /**
     * A glass button. e is its entrance (0..1: slides in and fades up); slideX the distance it slides from (left
     * layout slides in from the left, centred layouts rise). danger tints the hover red (Quit, Disconnect).
     */
    public static void button(Gfx c, GameMenus.Placed p, Anim a, double e, boolean slideX, boolean danger) {
        if (e <= 0.003) return; UiTokens t = AUi.tokens(); GameMenus.Item it = p.item(); GameMenus.Rect r = p.r();
        boolean en = it.enabled(), primary = it.size() == GameMenus.Size.LARGE, small = it.size() == GameMenus.Size.SMALL;
        double hv = en ? a.hover : 0, pr = en ? a.press : 0, al = e * (en ? 1 : 0.5);
        double x = r.x() - (slideX ? (1 - e) * 18 : 0) + (slideX ? hv * 2 : 0), y = r.y() + (slideX ? 0 : (1 - e) * 10) - (slideX ? 0 : hv * 1) + pr * 0.8, w = r.w(), h = r.h(), rad = Math.min(8, h / 2.6);
        int acc = t.opaque("acc"), acc2 = AUi.theme().acc2() | 0xFF000000, err = t.opaque("err"), hot = danger ? err : acc;
        if (primary) {
            Glass.shadow(c, x, y + 2, w, h, rad, 7 + 5 * hv, AUi.fade(acc, (0.30 + 0.25 * hv) * al));
            Glass.rect(c, x, y, w, h, rad, AUi.fade(AUi.mix(acc, WHITE, 0.10 * hv - 0.06 * pr), al));
            // a gentle shift toward the second accent along the bottom, and light across the top
            sheen(c, x, y, w, h, rad, AUi.fade(WHITE, (0.22 + 0.08 * hv) * al), 0.6, false);
            sheen(c, x, y, w, h, rad, AUi.fade(acc2, 0.32 * al), 0.5, true);
            Glass.outline(c, x, y, w, h, rad, AUi.fade(WHITE, (0.22 + 0.15 * hv) * al));
        } else if (small) {
            if (hv > 0.01) Glass.rect(c, x, y, w, h, rad, AUi.fade(hot, 0.10 * hv * al));
            Glass.outline(c, x, y, w, h, rad, AUi.fade(AUi.mix(WHITE, hot, hv), (0.10 + 0.30 * hv) * al));
        } else {
            Glass.shadow(c, x, y + 1.5, w, h, rad, 5 + 3 * hv, AUi.fade(BLACK, (0.32 + 0.10 * hv) * al));
            Glass.rect(c, x, y, w, h, rad, AUi.fade(AUi.mix(t.argb("s2", 0.80), AUi.fade(hot, 0.85), 0.06 + 0.16 * hv), al));
            sheen(c, x, y, w, h, rad, AUi.fade(WHITE, (0.05 + 0.03 * hv) * al), 0.6, false);
            Glass.outline(c, x, y, w, h, rad, AUi.mix(AUi.fade(WHITE, 0.10 * al), AUi.fade(hot, 0.65 * al), hv));
            if (hv > 0.01) Glass.rect(c, x + 3, y + h / 2 - h * 0.28 * hv, 1.6, h * 0.56 * hv, 0.8, AUi.fade(hot, hv * al)); // accent bar
        }
        int ink = primary ? t.opaque("accInk") : small ? AUi.mix(t.opaque("mute"), AUi.mix(t.opaque("text"), hot, 0.4), hv) : AUi.mix(t.opaque("text"), AUi.mix(WHITE, hot, 0.35), hv);
        if (!en) ink = t.opaque("faint");
        double ts = primary ? 9 : small ? 7 : 8, is = primary ? 10 : small ? 7.5 : 8.5;
        boolean centreLabel = !slideX || it.size() == GameMenus.Size.HALF || small;
        double tw = Glass.width("semibold", ts, it.label()), iw = is + 5;
        double lx = centreLabel ? x + (w - tw - iw) / 2 : x + (primary ? 12 : 11), cy = y + h / 2;
        Glass.icon(c, it.icon(), lx, cy - is / 2, is, AUi.fade(primary ? ink : AUi.mix(ink, hot, en ? 0.55 + 0.45 * hv : 0), al));
        Glass.label(c, "semibold", ts, it.label(), lx + iw, cy, w - (lx - x) - iw - 6, AUi.fade(ink, al));
        if (!it.hint().isEmpty() && !centreLabel) Glass.labelRight(c, "medium", 6.5, it.hint(), x + w - 9 - hv * 2, cy, AUi.fade(primary ? ink : t.opaque("mute"), (0.85) * al));
        if (a.focus > 0.01) Glass.outline(c, x - 2, y - 2, w + 4, h + 4, rad + 2, AUi.fade(acc, 0.9 * a.focus * al));
    }
    /**
     * Light (or a tint) across the top of a rounded shape, fading out over frac of its height (fromBottom: rising from
     * its bottom). Drawn as the shape itself clipped to thin bands of falling strength, so it follows the rounded
     * corners exactly instead of showing straight edges inside them.
     */
    public static void sheen(Gfx c, double x, double y, double w, double h, double r, int argb, double frac, boolean fromBottom) {
        int a0 = argb >>> 24; if (a0 == 0 || h <= 0) return; double span = h * frac; int n = Math.max(1, Math.min(8, (int) Math.ceil(span / 1.5))); double bh = span / n;
        int x0 = (int) Math.floor(x) - 2, x1 = (int) Math.ceil(x + w) + 2;
        for (int k = 0; k < n; k++) {
            double f = 1 - (k + 0.5) / n; f = f * f; if (f <= 0.01) continue;
            int t0 = (int) Math.round(fromBottom ? y + h - (k + 1) * bh : y + k * bh), t1 = (int) Math.round(fromBottom ? y + h - k * bh : y + (k + 1) * bh); if (t1 <= t0) continue;
            c.scissor(x0, t0, x1, t1); Glass.rect(c, x, y, w, h, r, AUi.fade(argb, f)); c.noScissor();
        }
    }
    /** A quiet text link (footer): underlined on hover. Returns its width so the caller can hit-test it. */
    public static double link(Gfx c, String s, double x, double baseline, double size, double hover, int argb, double alpha) {
        UiTokens t = AUi.tokens(); double w = Glass.width("medium", size, s);
        int col = AUi.mix(argb, t.opaque("text"), hover);
        Glass.text(c, "medium", size, s, x, baseline, AUi.fade(col, alpha));
        if (hover > 0.01) Glass.rect(c, x, baseline + 1.6, w * hover, 0.6, 0, AUi.fade(col, 0.8 * alpha));
        return w;
    }
}
