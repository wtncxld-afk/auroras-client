package gg.auroras.client.platform;

// Minecraft 26.2 only (versions/26.2): the few game calls whose names change from one release to the next, so the rest of the
// mod is written once. Here the screen moved to Gui (Gui#screen(), Gui#setScreen) and the HUD to Gui#hud. Names checked with javap against this release's jar (see .github/workflows/mod-check.yml).

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public final class Mc {
    private Mc() {}
    /** The key type of keyboard keys. */
    public static final InputConstants.Type KEYBOARD = InputConstants.Type.KEYSYM;
    /** The open screen, or null in game. */
    public static Screen screen(Minecraft mc) { return mc.gui.screen(); }
    public static void setScreen(Minecraft mc, Screen screen) { mc.gui.setScreen(screen); }
    /** F1: the HUD is hidden. */
    public static boolean hudHidden(Minecraft mc) { return mc.gui.hud.isHidden(); }
    /** Adds a line to your own chat (local only, nothing is sent to the server). */
    public static void chat(Minecraft mc, Component text) { mc.gui.hud.getChat().addClientSystemMessage(text); }

    // ---- Auroras main and pause menus (names from javap of this release's TitleScreen and PauseScreen) ----
    // Options takes (parent, options, in a world); ShareToLanScreen is gone: singleplayer worlds get Multiplayer options (MultiplayerOptionsScreen).
    /** Vanilla's Options screen, opened from the main or pause menu. */
    public static Screen options(Minecraft mc, Screen parent) { return new net.minecraft.client.gui.screens.options.OptionsScreen(parent, mc.options, mc.level != null); }
    /** The label of the pause menu's world button in this release, or null when there is none here. */
    public static String worldButton(Minecraft mc) { return mc.hasSingleplayerServer() ? "Multiplayer options" : null; }
    /** Whether that button can be pressed now (vanilla greys it out the same way). */
    public static boolean worldButtonActive(Minecraft mc) { return true; }
    public static Screen worldScreen(Minecraft mc, Screen parent) { return new net.minecraft.client.gui.screens.MultiplayerOptionsScreen(parent); }
    /** The camera the world was drawn from (GameRenderer#mainCamera in this release). */
    public static net.minecraft.client.Camera camera(Minecraft mc) { return mc.gameRenderer.mainCamera(); }
    /** The world's main render target (Color Grading and Motion Blur draw their post passes into it). */
    public static com.mojang.blaze3d.pipeline.RenderTarget mainTarget(Minecraft mc) { return mc.gameRenderer.mainRenderTarget(); }
}
