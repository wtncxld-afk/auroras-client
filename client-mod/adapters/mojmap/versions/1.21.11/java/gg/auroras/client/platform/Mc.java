package gg.auroras.client.platform;

// Minecraft 1.21.11 only (versions/1.21.11): the few game calls whose names change from one release to the next, so the rest of the
// mod is written once. Here the current screen is Minecraft#screen, chat lines go through ChatComponent#addMessage, key codes are InputConstants.Type.KEYSYM. Names checked with javap against this release's jar (see .github/workflows/mod-check.yml).

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class Mc {
    private Mc() {}
    /** The key type of keyboard keys. */
    public static final InputConstants.Type KEYBOARD = InputConstants.Type.KEYSYM;
    /** The open screen, or null in game. */
    public static Screen screen(Minecraft mc) { return mc.screen; }
    public static void setScreen(Minecraft mc, Screen screen) { mc.setScreen(screen); }
    /** F1: the HUD is hidden. */
    public static boolean hudHidden(Minecraft mc) { return mc.options.hideGui; }
    /** Adds a line to your own chat (local only, nothing is sent to the server). */
    public static void chat(Minecraft mc, Component text) { mc.gui.getChat().addMessage(text); }
    /** The camera the world was drawn from (GameRenderer#getMainCamera in this release). */
    public static net.minecraft.client.Camera camera(Minecraft mc) { return mc.gameRenderer.getMainCamera(); }
}
