package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). The Auroras pause menu, shown in place of vanilla's when you press Esc
// in a world while Settings > Custom pause menu is on (MenuHooks; F3+Esc still pauses without any menu). A glass card
// over the dimmed world with the theme's effect: Back to game, Advancements, Statistics, Options, the Auroras menu,
// this release's world button (Open to LAN up to 26.1, Multiplayer options in 26.2, World options from 26.3) and
// Disconnect or Save and quit. Each runs vanilla's own action (VanillaMenus). "Vanilla menu" opens vanilla's pause menu
// once (feedback links, player reporting, a server's own pause buttons). It pauses singleplayer like vanilla's does.
// Keyboard: arrows or Tab move, Enter or Space presses, Esc goes back to the game.

import gg.auroras.client.platform.AScreen;
import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Keys;
import gg.auroras.client.ui.AUi;
import gg.auroras.client.ui.Glass;
import gg.auroras.client.ui.MenuKit;
import gg.auroras.core.GameMenus;
import gg.auroras.core.UiKit;
import gg.auroras.core.UiTokens;

import java.util.ArrayList;
import java.util.List;

public class PauseMenuScreen extends AScreen {
    private GameMenus.Layout L; private final List<MenuKit.Anim> anims = new ArrayList<>();
    private double t, bgT, dt, linkV; private long last = System.nanoTime(), lastDraw; private int focus = -1; private boolean keyboard, leaving;
    private double vX, vW, vY; private int lastMx = Integer.MIN_VALUE, lastMy; private String place = "";

    public PauseMenuScreen() { super("Game paused"); }
    static boolean reduced() { return AurorasModules.reducedMotion(); }

    @Override protected void init() {
        boolean local = VanillaMenus.local();
        L = GameMenus.pause(width, height, GameMenus.pauseItems(local, VanillaMenus.worldButton(), VanillaMenus.worldButtonActive()));
        while (anims.size() < L.buttons().size()) anims.add(new MenuKit.Anim());
        if (System.nanoTime() - lastDraw > 250_000_000L) t = 0;
        place = VanillaMenus.place(); leaving = false; MenuProfile.refresh();
    }

    @Override protected void draw(Gfx c, int mx, int my, float delta) {
        long now = System.nanoTime(); dt = Math.min(0.1, (now - last) / 1e9); last = now; lastDraw = now;
        if (lastMx != Integer.MIN_VALUE && (mx != lastMx || my != lastMy)) keyboard = false; lastMx = mx; lastMy = my;
        boolean rm = reduced(); t += dt * AurorasModules.menuSpeed(); bgT += dt;
        UiTokens tk = AUi.tokens(); double fade = GameMenus.fadeIn(bgT, rm), e = GameMenus.entrance(t, 0, rm);
        MenuKit.pauseBackdrop(c, width, height, fade);
        // the card rises and fades in, then the buttons arrive one after another
        GameMenus.Rect p = L.panel(); double rise = (1 - e) * 10, x = p.x(), y = p.y() + rise, w = p.w(), h = p.h(); int acc = tk.opaque("acc");
        Glass.shadow(c, x, y + 8, w, h, 16, 26, AUi.fade(0xFF000000, 0.55 * e));
        MenuKit.glow(c, x + w / 2, y + 18, w * 0.42, AUi.fade(acc, 0.06 * e));
        Glass.rect(c, x, y, w, h, 12, AUi.fade(tk.argb("s1", 0.86), e));
        MenuKit.sheen(c, x, y, w, h, 12, AUi.fade(0xFFFFFFFF, 0.05 * e), Math.min(0.3, 48.0 / h), false);
        Glass.outline(c, x, y, w, h, 12, AUi.fade(0xFFFFFFFF, 0.11 * e));
        // header: emblem, title, and the world or server you're on
        GameMenus.Rect hd = L.header(); double hy = hd.y() + rise;
        if (!MenuKit.emblem(c, hd.x() - 3, hy - 2, 22, e)) c.texture(HudRenderer.LOGO, hd.x(), (int) Math.round(hy), 16, 16, AUi.fade(0xFFFFFFFF, e));
        double ts = MenuKit.snap(11); Glass.text(c, MenuKit.display(ts), ts, "Game paused", hd.x() + 23, hy + 9.5, AUi.fade(tk.opaque("text"), e));
        String sub = place.isEmpty() ? "Auroras Client" : place;
        Glass.text(c, "medium", 6.5, Glass.fit("medium", 6.5, sub, hd.w() - 26), hd.x() + 23, hy + 18.5, AUi.fade(tk.opaque("mute"), e));
        Glass.rect(c, hd.x(), hd.bottom() + rise, hd.w(), 0.5, 0, AUi.fade(0xFFFFFFFF, 0.07 * e));
        int hov = keyboard ? -1 : L.hit(mx, my);
        for (int k = 0; k < L.buttons().size(); k++) {
            GameMenus.Placed b = L.buttons().get(k); MenuKit.Anim a = anims.get(k);
            a.hover = ease(a.hover, k == hov || (keyboard && k == focus) ? 1 : 0, 0.05); a.press = ease(a.press, 0, 0.08); a.focus = ease(a.focus, keyboard && k == focus ? 1 : 0, 0.05);
            MenuKit.button(c, b, a, GameMenus.entrance(t, k + 1, rm), false, b.item().id().equals("disconnect"));
        }
        // under the card: how to resume, and vanilla's pause menu
        double fy = p.bottom() + 13, ea = GameMenus.entrance(t, L.buttons().size() + 1, rm);
        String hint = "Back to game"; String v = "Vanilla menu"; vW = Glass.width("medium", 6.5, v);
        double kw = Glass.width("semibold", 5.5, "Esc") + 7, hw = kw + 4 + Glass.width("medium", 6.5, hint), total = hw + 14 + vW; double hx = width / 2.0 - total / 2; vX = hx + hw + 14; vY = fy;
        if (fy + 4 < height) {
            // a little key cap for Esc, then what it does
            Glass.rect(c, hx, fy - 7, kw, 9.5, 3, AUi.fade(0xFFFFFFFF, 0.08 * ea)); Glass.outline(c, hx, fy - 7, kw, 9.5, 3, AUi.fade(0xFFFFFFFF, 0.14 * ea));
            Glass.labelCentred(c, "semibold", 5.5, "Esc", hx + kw / 2, fy - 2.25, AUi.fade(tk.opaque("mute"), ea));
            Glass.text(c, "medium", 6.5, hint, hx + kw + 4, fy, AUi.fade(tk.opaque("faint"), ea));
            Glass.circle(c, hx + hw + 7, fy - 2.3, 0.9, AUi.fade(tk.opaque("faint"), ea));
            linkV = ease(linkV, overVanilla(mx, my) ? 1 : 0, 0.05);
            MenuKit.link(c, v, vX, fy, 6.5, linkV, tk.opaque("mute"), ea);
        }
    }
    private double ease(double cur, double target, double tau) { return reduced() ? target : UiKit.approach(cur, target, dt, AurorasModules.tau(tau)); }
    private boolean overVanilla(double x, double y) { return vY + 4 < height && x >= vX - 2 && x <= vX + vW + 2 && y >= vY - 8 && y <= vY + 3; }

    private void press(int k) {
        if (leaving || k < 0 || k >= L.buttons().size() || !L.buttons().get(k).item().enabled()) return;
        anims.get(k).press = 1; VanillaMenus.click();
        switch (L.buttons().get(k).item().id()) {
            case "back" -> VanillaMenus.backToGame();
            case "advancements" -> VanillaMenus.advancements(this);
            case "stats" -> VanillaMenus.stats(this);
            case "options" -> VanillaMenus.options(this);
            case "auroras" -> VanillaMenus.aurorasMenu();
            case "world" -> VanillaMenus.world(this);
            case "disconnect" -> { leaving = true; VanillaMenus.disconnect(this); } // pressed once, like vanilla's (it greys out)
            default -> {}
        }
    }
    @Override protected boolean click(double x, double y, int button) {
        keyboard = false; if (button != 0) return true;
        int k = L.hit(x, y); if (k >= 0) { press(k); return true; }
        if (overVanilla(x, y)) { VanillaMenus.click(); VanillaMenus.vanillaPause(); return true; }
        return true;
    }
    @Override protected boolean key(int key) {
        if (key == Keys.ESCAPE) { VanillaMenus.backToGame(); return true; }
        if (key == Keys.DOWN || key == Keys.RIGHT || (key == Keys.TAB && !shift())) { keyboard = true; focus = GameMenus.step(L, focus, 1); return true; }
        if (key == Keys.UP || key == Keys.LEFT || key == Keys.TAB) { keyboard = true; focus = GameMenus.step(L, focus, -1); return true; }
        if ((key == Keys.ENTER || key == Keys.SPACE) && keyboard && focus >= 0) { press(focus); return true; }
        return false;
    }
    @Override protected boolean drag(double x, double y, int button, double dx, double dy) { keyboard = false; return true; }
    /** Pauses a singleplayer world, as vanilla's pause menu does. */
    @Override public boolean isPauseScreen() { return true; }
    @Override public void onClose() { VanillaMenus.backToGame(); }
}
