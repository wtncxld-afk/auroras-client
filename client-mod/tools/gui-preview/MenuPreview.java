package gg.auroras.client;

import gg.auroras.client.platform.AScreen;
import gg.auroras.client.platform.Gfx;
import gg.auroras.core.*;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;

/**
 * Renders the real Auroras main menu and pause menu (TitleMenuScreen, PauseMenuScreen and ui/MenuKit, compiled against
 * the stand-ins in stubs/) to PNGs, frame by frame on real time like the game, so their look and motion can be checked
 * without Minecraft. The pause menu is drawn over background.png (a world screenshot or any picture).
 * Args: background.png outDir [width height guiScale]. AURORAS_SKIN=<64x64 skin> shows your 3D head.
 */
public class MenuPreview {
    public static void main(String[] a) throws Exception {
        BufferedImage bg = ImageIO.read(new File(a[0])); File out = new File(a[1]); out.mkdirs();
        int W = a.length > 2 ? Integer.parseInt(a[2]) : 1920, H = a.length > 3 ? Integer.parseInt(a[3]) : 1080; Gfx.GS = a.length > 4 ? Double.parseDouble(a[4]) : 4;
        try (var in = MenuPreview.class.getResourceAsStream("/assets/auroras_client/textures/gui/logo.png")) { if (in != null) Gfx.LOGO = ImageIO.read(in); }
        int gw = (int) Math.ceil(W / Gfx.GS), gh = (int) Math.ceil(H / Gfx.GS);
        String only = System.getenv("AURORAS_ONLY");
        // main menu: both layouts, the mouse on Singleplayer, then resting on Join VexVanilla
        shot(null, W, H, new TitleMenuScreen(), 3.0, gw * 0.13, gh * 0.5, "title-left", out);
        AurorasClient.PM.set(Config.Registry.TITLE_LAYOUT, "centre");
        shot(null, W, H, new TitleMenuScreen(), 3.0, gw / 2.0, gh * 0.55, "title-centre", out);
        AurorasClient.PM.set(Config.Registry.TITLE_LAYOUT, "left");
        shot(null, W, H, new TitleMenuScreen(), 0.26, -50, -50, "title-entrance", out);
        if (only == null) for (String th : new String[]{"sakura", "midnight", "ember", "void"}) {
            AurorasClient.PM.set(Config.Registry.MENU_THEME, th); shot(null, W, H, new TitleMenuScreen(), 3.0, -50, -50, "title-" + th, out); }
        AurorasClient.PM.set(Config.Registry.MENU_THEME, "aurora");
        // pause menu: singleplayer (Open to LAN, Save and quit), then on a server
        shot(bg, W, H, new PauseMenuScreen(), 3.0, gw / 2.0, gh / 2.0 - 30, "pause", out);
        VanillaMenus.LOCAL = false; VanillaMenus.WORLD = null; VanillaMenus.PLACE = "vexvanilla.net";
        shot(bg, W, H, new PauseMenuScreen(), 3.0, -50, -50, "pause-server", out);
        // a small window (854 x 480 at GUI scale 2) still fits
        Gfx.GS = 2; VanillaMenus.LOCAL = true; VanillaMenus.WORLD = "Open to LAN"; VanillaMenus.PLACE = "New World";
        shot(null, 854, 480, new TitleMenuScreen(), 3.0, -50, -50, "title-small", out);
        shot(bg, 854, 480, new PauseMenuScreen(), 3.0, -50, -50, "pause-small", out);
    }
    /** Draws frames on real time for secs seconds (so motion runs as in game) and saves the last one. */
    static void shot(BufferedImage bg, int W, int H, AScreen s, double secs, double mx, double my, String name, File dir) throws Exception {
        int gw = (int) Math.ceil(W / Gfx.GS), gh = (int) Math.ceil(H / Gfx.GS); s.setup(gw, gh);
        long end = System.nanoTime() + (long) (secs * 1e9); BufferedImage img = null;
        while (System.nanoTime() < end || img == null) {
            img = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB); Graphics2D g = img.createGraphics();
            if (bg != null) g.drawImage(bg, 0, 0, W, H, null); else { g.setColor(Color.BLACK); g.fillRect(0, 0, W, H); }
            s.frame(new Gfx(g, gw, gh), (int) mx, (int) my); g.dispose(); Thread.sleep(8);
        }
        ImageIO.write(img, "png", new File(dir, name + ".png")); System.out.println("wrote " + name);
    }
}
