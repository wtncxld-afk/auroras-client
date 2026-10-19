package gg.auroras.client.ui;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. The animated background behind the Auroras menus for the
// chosen menu theme (core MenuTheme simulates it and is tested there): sakura petals, aurora curtains, stars, embers,
// snow or void motes. One effect is shared by every menu screen, so it carries on smoothly from the Right Shift menu
// into the module screens. Off when Background effects is off; still (but shown) with reduced motion.

import gg.auroras.client.AurorasClient;
import gg.auroras.client.AurorasModules;
import gg.auroras.client.platform.Gfx;
import gg.auroras.core.Config;
import gg.auroras.core.MenuTheme;

public final class MenuFx {
    private MenuFx() {}
    private static MenuTheme.Effect fx; private static long last;

    /** Draws the effect over the whole w x h (GUI units) screen, faded by alpha (the menu's open animation). */
    public static void draw(Gfx c, double w, double h, double alpha) {
        if (alpha <= 0.01 || !on()) return;
        MenuTheme.Theme th = AUi.theme();
        if (fx == null || fx.theme != th) { fx = new MenuTheme.Effect(th, 1, 1234); last = 0; }
        long now = System.nanoTime(); double dt = last == 0 ? 0 : (now - last) / 1e9; last = now;
        fx.update(dt, AurorasModules.reducedMotion());
        if (th.fx() == MenuTheme.Fx.AURORA) curtains(c, w, h, alpha, th);
        for (MenuTheme.P p : fx.ps) {
            double b = fx.brightness(p) * alpha; if (b <= 0.01) continue;
            double x = p.x * w, y = p.y * h, s = p.size * h; int col = AUi.fade(0xFF000000 | p.color, b);
            switch (th.fx()) {
                case PETALS -> Glass.petal(c, x, y, s * 2.2, p.rot, col);
                case EMBERS, MOTES -> { Glass.circle(c, x, y, s * 2.5, AUi.fade(0xFF000000 | p.color, b * 0.18)); Glass.circle(c, x, y, s, col); }
                default -> Glass.circle(c, x, y, s, col);
            }
        }
    }
    /** Aurora: three ribbons of light, each a row of thin curtains that fade downward, drifting slowly. */
    private static void curtains(Gfx c, double w, double h, double alpha, MenuTheme.Theme th) {
        int[] cols = {th.acc(), th.acc2(), th.acc()}; double step = 3;
        for (int k = 0; k < 3; k++) for (double x = 0; x < w; x += step) {
            double y = fx.ribbon(k, x / w) * h, len = h * (0.16 + 0.06 * Math.sin(x / w * 9 + fx.t * 0.5 + k)), a = alpha * (0.26 - 0.06 * k) * (0.6 + 0.4 * Math.sin(x / w * 13 + fx.t * 0.7 + k * 2));
            if (a > 0.005) Glass.vgrad(c, x, y, step, len, AUi.fade(0xFF000000 | cols[k], a), 0);
        }
    }
    static boolean on() { try { return !"false".equals(AurorasClient.PM.get(Config.Registry.MENU_FX)); } catch (Exception e) { return true; } }
}
