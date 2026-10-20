package gg.auroras.client;

import gg.auroras.client.platform.Gfx;
import gg.auroras.core.*;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.Field;
import java.util.List;

/**
 * Renders the real in-game ModuleScreen (the adapter's own ModuleScreen.java and AUi.java, compiled against preview
 * stand-ins) over a background image, so the in-game GUI can be seen without Minecraft. See README.md next to this file.
 * Args: background.png outDir [width height guiScale]
 */
public class GuiPreview {
    public static void main(String[] a) throws Exception {
        BufferedImage bg = ImageIO.read(new File(a[0])); File out = new File(a[1]); out.mkdirs();
        int W = a.length > 2 ? Integer.parseInt(a[2]) : 1920, H = a.length > 3 ? Integer.parseInt(a[3]) : 1080; Gfx.GS = a.length > 4 ? Double.parseDouble(a[4]) : 3;
        try (var in = GuiPreview.class.getResourceAsStream("/assets/auroras_client/textures/gui/logo.png")) { if (in != null) Gfx.LOGO = ImageIO.read(in); }
        String skin = System.getenv("AURORAS_SKIN"); // optional 64x64 skin: its face shows in the profile card
        if (skin != null) { BufferedImage sk = ImageIO.read(new File(skin)); int[] face = new int[64]; for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) { int hat = sk.getRGB(40 + x, 8 + y); face[y * 8 + x] = (hat >>> 24) > 128 ? hat : sk.getRGB(8 + x, 8 + y); }
            net.minecraft.resources.Identifier fid = net.minecraft.resources.Identifier.fromNamespaceAndPath("auroras_client", "radial/face"); gg.auroras.client.platform.Platform.texture(fid, face, 8, 8); gg.auroras.client.ui.Glass.face = fid; gg.auroras.client.ui.Glass.player = "cxld"; }
        for (String id : List.of("sky", "keystrokes", "fps", "zoom", "cape", "particlefx")) if (AurorasClient.REG.get(id) != null && AurorasClient.REG.get(id).available()) AurorasClient.PM.setEnabled(id, true);
        String themes = System.getenv("AURORAS_THEMES"); // optional: a folder of backdrops named <theme>.png; renders the Visuals page in every menu theme
        if (themes != null) { for (MenuTheme.Theme th : MenuTheme.THEMES) { AurorasClient.PM.set(Config.Registry.MENU_THEME, th.id()); File f = new File(themes, th.id() + ".png");
                shot(f.exists() ? ImageIO.read(f) : bg, W, H, ModuleScreen.section("Visuals", RadialMenu.PETALS.get(1).categories(), null), null, "theme-" + th.id(), out); }
            AurorasClient.PM.set(Config.Registry.MENU_THEME, "aurora"); return; }
        shot(bg, W, H, ModuleScreen.section("Visuals", RadialMenu.PETALS.get(1).categories(), null), null, "visuals", out);
        shot(bg, W, H, ModuleScreen.section("HUD", RadialMenu.PETALS.get(0).categories(), null), null, "hud", out);
        shot(bg, W, H, ModuleScreen.section("All modules", null, null), null, "all-modules", out);
        shot(bg, W, H, ModuleScreen.section("Visuals", RadialMenu.PETALS.get(1).categories(), null), "sky", "sky-settings", out);
        shot(bg, W, H, ModuleScreen.section("HUD", RadialMenu.PETALS.get(0).categories(), null), "keystrokes", "keystrokes-settings", out);
        shot(bg, W, H, ModuleScreen.section("Player Visuals", java.util.List.of("Player Visuals"), null), null, "player-visuals", out);
        shot(bg, W, H, ModuleScreen.section("Player Visuals", java.util.List.of("Player Visuals"), null), "nameplate", "nameplate-settings", out);
        shot(bg, W, H, ModuleScreen.section("Visuals", RadialMenu.PETALS.get(1).categories(), null), "particlefx", "particlefx-settings", out);
        shot(bg, W, H, ModuleScreen.settings(null), null, "client-settings", out);
    }
    static void shot(BufferedImage bg, int W, int H, ModuleScreen s, String open, String name, File dir) throws Exception {
        int gw = (int) Math.ceil(W / Gfx.GS), gh = (int) Math.ceil(H / Gfx.GS); s.setup(gw, gh);
        if (open != null) { Field f = ModuleScreen.class.getDeclaredField("menu"); f.setAccessible(true); ((ModuleMenu) f.get(s)).openSettings(open); }
        // let the open animation finish, with the mouse resting over the second card / row
        long end = System.nanoTime() + 700_000_000L; BufferedImage img = null;
        while (System.nanoTime() < end || img == null) {
            img = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB); Graphics2D g = img.createGraphics(); g.drawImage(bg, 0, 0, W, H, null);
            s.frame(new Gfx(g, gw, gh), gw / 2, gh / 2 - 30); g.dispose(); Thread.sleep(16);
        }
        ImageIO.write(img, "png", new File(dir, name + ".png")); System.out.println("wrote " + name);
    }
}
