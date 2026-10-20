package gg.auroras.client;
/** Preview stand-in: the buttons do nothing outside the game; the state is a sample singleplayer world on 1.21.11. */
public final class VanillaMenus {
    public static boolean MULTIPLAYER = true, LOCAL = true; public static String WORLD = "Open to LAN", PLACE = "New World";
    public static void click() {}
    public static boolean multiplayerAllowed() { return MULTIPLAYER; }
    public static void singleplayer(net.minecraft.client.gui.screens.Screen p) {} public static void multiplayer(net.minecraft.client.gui.screens.Screen p) {}
    public static void joinVex(net.minecraft.client.gui.screens.Screen p) {} public static void options(net.minecraft.client.gui.screens.Screen p) {}
    public static void quit() {} public static void credits(net.minecraft.client.gui.screens.Screen p) {} public static void aurorasMenu() {}
    public static void vanillaTitle() {} public static void vanillaPause() {} public static void backToGame() {}
    public static void advancements(net.minecraft.client.gui.screens.Screen p) {} public static void stats(net.minecraft.client.gui.screens.Screen p) {}
    public static String worldButton() { return WORLD; } public static boolean worldButtonActive() { return true; } public static void world(net.minecraft.client.gui.screens.Screen p) {}
    public static boolean local() { return LOCAL; } public static void disconnect(net.minecraft.client.gui.screens.Screen p) {} public static String place() { return PLACE; }
}
