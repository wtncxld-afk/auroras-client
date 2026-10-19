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
        for (String id : List.of("sky", "keystrokes", "fps", "zoom", "cape", "particlefx")) if (AurorasClient.REG.get(id) != null && AurorasClient.REG.get(id).available()) AurorasClient.PM.setEnabled(id, true);
        shot(bg, W, H, ModuleScreen.section("Visuals", RadialMenu.PETALS.get(1).categories(), null), null, "visuals", out);
        shot(bg, W, H, ModuleScreen.section("HUD", RadialMenu.PETALS.get(0).categories(), null), null, "hud", out);
        shot(bg, W, H, ModuleScreen.section("All modules", null, null), null, "all-modules", out);
        shot(bg, W, H, ModuleScreen.section("Visuals", RadialMenu.PETALS.get(1).categories(), null), "sky", "sky-settings", out);
        shot(bg, W, H, ModuleScreen.section("HUD", RadialMenu.PETALS.get(0).categories(), null), "keystrokes", "keystrokes-settings", out);
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
