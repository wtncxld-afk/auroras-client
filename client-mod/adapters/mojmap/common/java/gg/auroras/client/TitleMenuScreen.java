package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). The Auroras main menu, shown in place of vanilla's title screen while
// Settings > Custom main menu is on (MenuHooks). The menu theme's animated backdrop, the Auroras emblem and wordmark,
// glass buttons that slide in one after another, your head (turning toward the mouse) and name, the game and client
// versions, and Mojang's copyright line (which opens the credits, as in vanilla). Every button runs vanilla's own action
// (VanillaMenus). "Vanilla menu" shows vanilla's title screen once, for Realms, Mod Menu's Mods button and the like.
// Layout, motion timing and keyboard focus are core GameMenus (tested in UiTests); reduced motion shows everything at once.
// Keyboard: arrows or Tab move, Enter or Space presses.

import gg.auroras.client.platform.AScreen;
import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Keys;
import gg.auroras.client.ui.AUi;
import gg.auroras.client.ui.Glass;
import gg.auroras.client.ui.MenuKit;
import gg.auroras.core.Config;
import gg.auroras.core.GameMenus;
import gg.auroras.core.UiKit;
import gg.auroras.core.UiTokens;

import java.util.ArrayList;
import java.util.List;

public class TitleMenuScreen extends AScreen {
    static final String COPYRIGHT = "Copyright Mojang AB. Do not distribute!";
    private GameMenus.Layout L; private final List<MenuKit.Anim> anims = new ArrayList<>();
    private double t, bgT, dt, linkV, linkC; private long last = System.nanoTime(), lastDraw; private int focus = -1; private boolean keyboard;
    private double vX, vW, cX, cW, footY; private int lastMx = Integer.MIN_VALUE, lastMy; // footer links, for hit testing; the mouse, to leave keyboard mode

    public TitleMenuScreen() { super("Auroras Client"); }
    static boolean reduced() { return AurorasModules.reducedMotion(); }
    static String layout() { try { return AurorasClient.PM.get(Config.Registry.TITLE_LAYOUT); } catch (Exception e) { return "left"; } }

    @Override protected void init() {
        L = GameMenus.title(width, height, GameMenus.titleItems(VanillaMenus.multiplayerAllowed()), layout());
        while (anims.size() < L.buttons().size()) anims.add(new MenuKit.Anim());
        // a resize keeps everything where it is; coming back from another screen replays the buttons' entrance
        if (System.nanoTime() - lastDraw > 250_000_000L) t = 0;
        MenuProfile.refresh();
    }

    @Override protected void draw(Gfx c, int mx, int my, float delta) {
        long now = System.nanoTime(); dt = Math.min(0.1, (now - last) / 1e9); last = now; lastDraw = now;
        if (lastMx != Integer.MIN_VALUE && (mx != lastMx || my != lastMy)) keyboard = false; lastMx = mx; lastMy = my;
        boolean rm = reduced(); t += dt * AurorasModules.menuSpeed(); bgT += dt;
        UiTokens tk = AUi.tokens(); boolean left = !L.centred();
        double fade = GameMenus.fadeIn(bgT, rm);
        MenuKit.titleBackdrop(c, width, height, bgT, fade, left);
        // logo, then each button a moment after the one above
        MenuKit.brand(c, L.logo(), GameMenus.entrance(t, 0, rm), L.centred(), HudRenderer.LOGO);
        int hov = keyboard ? -1 : L.hit(mx, my);
        for (int k = 0; k < L.buttons().size(); k++) {
            GameMenus.Placed p = L.buttons().get(k); MenuKit.Anim a = anims.get(k);
            a.hover = ease(a.hover, k == hov || (keyboard && k == focus) ? 1 : 0, 0.05); a.press = ease(a.press, 0, 0.08); a.focus = ease(a.focus, keyboard && k == focus ? 1 : 0, 0.05);
            String id = p.item().id();
            MenuKit.button(c, p, a, GameMenus.entrance(t, k + 1, rm), left, id.equals("quit"));
        }
        drawProfile(c, mx, my, fade, tk);
        drawFooter(c, mx, my, fade, tk);
    }
    private double ease(double cur, double target, double tau) { return reduced() ? target : UiKit.approach(cur, target, dt, AurorasModules.tau(tau)); }

    /** Your head and name, top right. */
    private void drawProfile(Gfx c, int mx, int my, double a, UiTokens tk) {
        String name = MenuProfile.name(); double e = GameMenus.entrance(t, 2, reduced()) * a; if (e <= 0.01 || width < 260) return;
        String sub = "Profile · " + AurorasClient.PM.active();
        double nw = Math.max(Glass.width("semibold", 8, name), Glass.width("medium", 6, sub)), cw = 34 + nw + 12, ch = 30, x = width - 12 - cw, y = 12 - (1 - e) * 6;
        Glass.shadow(c, x, y + 2, cw, ch, 9, 8, AUi.fade(0xFF000000, 0.35 * e));
        Glass.rect(c, x, y, cw, ch, 9, AUi.fade(tk.argb("s1", 0.78), e));
        MenuKit.sheen(c, x, y, cw, ch, 9, AUi.fade(0xFFFFFFFF, 0.05 * e), 0.5, false);
        Glass.outline(c, x, y, cw, ch, 9, AUi.fade(0xFFFFFFFF, 0.10 * e));
        double hs = 20, hx = x + 6, hy = y + 5;
        Glass.rect(c, hx - 1, hy - 1, hs + 2, hs + 2, 6, AUi.fade(tk.opaque("acc"), 0.12 * e));
        if (!MenuProfile.draw(c, hx, hy, hs, mx, my, dt, reduced(), (float) e)) Glass.labelCentred(c, "semibold", 10, name.isEmpty() ? "?" : name.substring(0, 1).toUpperCase(), hx + hs / 2, hy + hs / 2, AUi.fade(tk.opaque("acc"), e));
        Glass.label(c, "semibold", 8, name, x + 32, y + 11.5, nw + 4, AUi.fade(tk.opaque("text"), e));
        Glass.label(c, "medium", 6, sub, x + 32, y + 20.5, nw + 4, AUi.fade(tk.opaque("mute"), e));
    }
    /** Versions bottom left; "Vanilla menu" and Mojang's copyright line bottom right. */
    private void drawFooter(Gfx c, int mx, int my, double a, UiTokens tk) {
        double base = height - 7; footY = base;
        Glass.text(c, "semibold", 6.5, "Auroras Client " + AurorasClient.modVersion, 8, base - 9, AUi.fade(tk.opaque("mute"), 0.95 * a));
        Glass.text(c, "medium", 6, "Minecraft " + AurorasClient.mcVersion + " · Fabric", 8, base, AUi.fade(tk.opaque("faint"), a));
        cW = Glass.width("medium", 6.5, COPYRIGHT); cX = width - 8 - cW;
        linkC = ease(linkC, overCopyright(mx, my) ? 1 : 0, 0.05);
        MenuKit.link(c, COPYRIGHT, cX, base, 6.5, linkC, AUi.mix(tk.opaque("mute"), 0xFFFFFFFF, 0.25), a);
        String v = "Vanilla menu"; vW = Glass.width("medium", 6.5, v); vX = width - 8 - vW;
        linkV = ease(linkV, overVanilla(mx, my) ? 1 : 0, 0.05);
        MenuKit.link(c, v, vX, base - 10, 6.5, linkV, tk.opaque("faint"), a);
    }
    private boolean overCopyright(double x, double y) { return x >= cX - 2 && x <= cX + cW + 2 && y >= footY - 8 && y <= footY + 3; }
    private boolean overVanilla(double x, double y) { return x >= vX - 2 && x <= vX + vW + 2 && y >= footY - 18 && y <= footY - 7; }

    private void press(int k) {
        if (k < 0 || k >= L.buttons().size() || !L.buttons().get(k).item().enabled()) return;
        anims.get(k).press = 1; VanillaMenus.click();
        switch (L.buttons().get(k).item().id()) {
            case "singleplayer" -> VanillaMenus.singleplayer(this);
            case "multiplayer" -> VanillaMenus.multiplayer(this);
            case "vexvanilla" -> VanillaMenus.joinVex(this);
            case "auroras" -> VanillaMenus.aurorasMenu();
            case "options" -> VanillaMenus.options(this);
            case "quit" -> VanillaMenus.quit();
            default -> {}
        }
    }
    @Override protected boolean click(double x, double y, int button) {
        keyboard = false; if (button != 0) return true;
        int k = L.hit(x, y); if (k >= 0) { press(k); return true; }
        if (overCopyright(x, y)) { VanillaMenus.click(); VanillaMenus.credits(this); return true; }
        if (overVanilla(x, y)) { VanillaMenus.click(); VanillaMenus.vanillaTitle(); return true; }
        return true;
    }
    @Override protected boolean key(int key) {
        if (key == Keys.ESCAPE) return true; // the main menu has nothing to close to, as in vanilla
        if (key == Keys.DOWN || key == Keys.RIGHT || (key == Keys.TAB && !shift())) { keyboard = true; focus = GameMenus.step(L, focus, 1); return true; }
        if (key == Keys.UP || key == Keys.LEFT || key == Keys.TAB) { keyboard = true; focus = GameMenus.step(L, focus, -1); return true; }
        if ((key == Keys.ENTER || key == Keys.SPACE) && keyboard && focus >= 0) { press(focus); return true; }
        return false;
    }
    @Override protected boolean drag(double x, double y, int button, double dx, double dy) { keyboard = false; return true; }
    @Override public boolean shouldCloseOnEsc() { return false; }
    @Override public void onClose() {}
}
