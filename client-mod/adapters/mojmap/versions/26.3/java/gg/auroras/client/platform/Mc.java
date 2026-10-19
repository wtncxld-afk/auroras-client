package gg.auroras.client.platform;

// Minecraft 26.3 only (versions/26.3): the few game calls whose names change from one release to the next, so the rest of the
// mod is written once. Here like 26.2 (screen in Gui, HUD in Gui#hud); the keyboard key type is InputConstants.Type.KEYBOARD (was KEYSYM). Names checked with javap against this release's jar (see .github/workflows/mod-check.yml).

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class Mc {
    private Mc() {}
    /** The key type of keyboard keys. */
    public static final InputConstants.Type KEYBOARD = InputConstants.Type.KEYBOARD;
    /** The open screen, or null in game. */
    public static Screen screen(Minecraft mc) { return mc.gui.screen(); }
    public static void setScreen(Minecraft mc, Screen screen) { mc.gui.setScreen(screen); }
    /** F1: the HUD is hidden. */
    public static boolean hudHidden(Minecraft mc) { return mc.gui.hud.isHidden(); }
    /** Adds a line to your own chat (local only, nothing is sent to the server). */
    public static void chat(Minecraft mc, Component text) { mc.gui.hud.getChat().addClientSystemMessage(text); }
}
