package gg.auroras.client;

// ADAPTER mojmap — Which screen really opens when Minecraft asks for its main menu or pause menu (mixin/ScreenSwapMixin
// calls this at the start of setScreen). Only vanilla's own TitleScreen and PauseScreen classes are swapped, never a
// subclass another mod made, never the F3+Esc pause without a menu, and only while the setting is on. Anything that goes
// wrong here leaves vanilla's screen in place, so the game can always reach its menus.

import gg.auroras.core.Config;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;

public final class MenuHooks {
    private MenuHooks() {}
    /** Set by "Vanilla menu": the next vanilla main or pause menu is shown as it is (Realms, Mod Menu's buttons, server links). */
    static boolean vanillaOnce;

    public static Screen replace(Screen screen) {
        try {
            if (vanillaOnce && (screen instanceof TitleScreen || screen instanceof PauseScreen)) { vanillaOnce = false; return screen; }
            // setScreen(null) with no world open shows the main menu (vanilla makes a TitleScreen itself a few lines later)
            if (screen == null) return Minecraft.getInstance().level == null && on(Config.Registry.CUSTOM_TITLE) ? new TitleMenuScreen() : null;
            if (screen.getClass() == TitleScreen.class && on(Config.Registry.CUSTOM_TITLE)) return new TitleMenuScreen();
            if (screen.getClass() == PauseScreen.class && ((PauseScreen) screen).showsPauseMenu() && on(Config.Registry.CUSTOM_PAUSE)) return new PauseMenuScreen();
        } catch (Throwable t) { System.out.println("[Auroras] menu not replaced, using vanilla's: " + t); }
        return screen;
    }
    static boolean on(String key) { return AurorasClient.PM != null && !"false".equals(AurorasClient.PM.get(key)); }
}
