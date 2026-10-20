package gg.auroras.client;

// ADAPTER mojmap — What each button of the Auroras main menu and pause menu does: exactly what vanilla's TitleScreen and
// PauseScreen buttons do (read from javap -c of each release's jar, see .github/workflows/mod-check.yml), so nothing is
// skipped: the multiplayer safety notice, the unsent-report check before leaving a server, saving the world, Realms or
// the server list after disconnecting. The few calls that differ between releases are in versions/<target>/platform/Mc.

import gg.auroras.client.platform.Mc;
import gg.auroras.core.GameMenus;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.ConnectScreen;
import net.minecraft.client.gui.screens.CreditsAndAttributionScreen;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.client.gui.screens.achievement.StatsScreen;
import net.minecraft.client.gui.screens.advancements.AdvancementsScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.multiplayer.SafetyScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.resolver.ServerAddress;
import net.minecraft.client.resources.sounds.SimpleSoundInstance;
import net.minecraft.sounds.SoundEvents;

public final class VanillaMenus {
    private VanillaMenus() {}
    static Minecraft mc() { return Minecraft.getInstance(); }

    /** Vanilla's button click. */
    public static void click() { try { mc().getSoundManager().play(SimpleSoundInstance.forUI(SoundEvents.UI_BUTTON_CLICK, 1.0F)); } catch (Throwable ignored) {} }

    // ---- main menu (TitleScreen#createNormalMenuOptions and #init) ----
    /** False when Minecraft refuses multiplayer (the same check as vanilla: a child account, or a banned name or account). */
    public static boolean multiplayerAllowed() { Minecraft m = mc(); return m.allowsMultiplayer() && !m.isNameBanned() && m.multiplayerBan() == null; }
    public static void singleplayer(Screen parent) { Mc.setScreen(mc(), new SelectWorldScreen(parent)); }
    /** The server list, after the one-time multiplayer safety notice (vanilla shows it until it is acknowledged). */
    public static void multiplayer(Screen parent) { Minecraft m = mc(); Mc.setScreen(m, m.options.skipMultiplayerWarning ? new JoinMultiplayerScreen(parent) : new SafetyScreen(parent)); }
    /** Joins VexVanilla the way the server list's Join does: Minecraft's own connect screen, nothing of ours on the network. */
    public static void joinVex(Screen parent) {
        Minecraft m = mc();
        if (!m.options.skipMultiplayerWarning) { Mc.setScreen(m, new SafetyScreen(parent)); return; } // the notice comes first, as for Multiplayer
        ConnectScreen.startConnecting(parent, m, ServerAddress.parseString(GameMenus.VEX_ADDRESS), new ServerData(GameMenus.VEX_NAME, GameMenus.VEX_ADDRESS, ServerData.Type.OTHER), false, null);
    }
    public static void options(Screen parent) { Minecraft m = mc(); Mc.setScreen(m, Mc.options(m, parent)); }
    public static void quit() { mc().stop(); }
    /** The copyright line opens Mojang's credits and attribution, as on vanilla's title screen. */
    public static void credits(Screen parent) { Mc.setScreen(mc(), new CreditsAndAttributionScreen(parent)); }
    /** The Right Shift menu. */
    public static void aurorasMenu() { Mc.setScreen(mc(), new RadialScreen()); }
    /** Vanilla's own main menu, once (Realms, Mod Menu's Mods button, language and accessibility). */
    public static void vanillaTitle() { MenuHooks.vanillaOnce = true; Mc.setScreen(mc(), new TitleScreen()); }
    /** Vanilla's own pause menu, once (a server's custom pause buttons, feedback links, player reporting). */
    public static void vanillaPause() { MenuHooks.vanillaOnce = true; Mc.setScreen(mc(), new PauseScreen(true)); }

    // ---- pause menu (PauseScreen#createPauseMenu) ----
    public static void backToGame() { Minecraft m = mc(); Mc.setScreen(m, null); m.mouseHandler.grabMouse(); }
    public static void advancements(Screen parent) { Minecraft m = mc(); if (m.player != null) Mc.setScreen(m, new AdvancementsScreen(m.player.connection.getAdvancements(), parent)); }
    public static void stats(Screen parent) { Minecraft m = mc(); if (m.player != null) Mc.setScreen(m, new StatsScreen(parent, m.player.getStats())); }
    /** Open to LAN, Multiplayer options or World options, whichever this release has (null: none here). */
    public static String worldButton() { return Mc.worldButton(mc()); }
    public static boolean worldButtonActive() { return Mc.worldButtonActive(mc()); }
    public static void world(Screen parent) { Minecraft m = mc(); if (Mc.worldButton(m) != null && Mc.worldButtonActive(m)) Mc.setScreen(m, Mc.worldScreen(m, parent)); }
    /** True in a singleplayer world (this game runs the server): the last button saves and quits. */
    public static boolean local() { return mc().isLocalServer(); }
    /** Disconnect / Save and Quit: vanilla first lets you finish an unsent player report, then leaves the world. */
    public static void disconnect(Screen parent) { Minecraft m = mc(); m.getReportingContext().draftReportHandled(m, parent, () -> m.disconnectFromWorld(ClientLevel.DEFAULT_QUIT_MESSAGE), true); }
    /** The pause menu's subtitle: the world's name in singleplayer, the server's address in multiplayer. */
    public static String place() {
        Minecraft m = mc();
        try { if (m.getSingleplayerServer() != null) return m.getSingleplayerServer().getWorldData().getLevelName(); ServerData sd = m.getCurrentServer(); if (sd != null) return sd.ip; } catch (Throwable ignored) {}
        return "";
    }
}
