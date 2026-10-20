package gg.auroras.client;

import gg.auroras.client.platform.Gfx;
import gg.auroras.client.ui.WorldArt;
import gg.auroras.core.*;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;

/**
 * Renders the world overlays with the adapter's real drawing code (ui/WorldArt.java and core WorldFx) over a background:
 * glass nameplates at a few distances, damage health cards, floating damage numbers at several ages, and every emblem
 * design turned at different angles. In game AurorasWorld places the same art at projected world points.
 * Args: background.png out.png [width height guiScale]
 */
public class WorldPreview {
    public static void main(String[] a) throws Exception {
        BufferedImage bg = ImageIO.read(new File(a[0])); int W = a.length > 2 ? Integer.parseInt(a[2]) : 1920, H = a.length > 3 ? Integer.parseInt(a[3]) : 1080; Gfx.GS = a.length > 4 ? Double.parseDouble(a[4]) : 3;
        int gw = (int) Math.ceil(W / Gfx.GS), gh = (int) Math.ceil(H / Gfx.GS);
        BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB); Graphics2D g = img.createGraphics(); g.drawImage(bg, 0, 0, W, H, null);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        Gfx c = new Gfx(g, gw, gh);
        WorldArt.Plate p = new WorldArt.Plate(); p.bgPct = 25; p.radius = 4; p.border = true; p.shadow = true;
        WorldFx.View v = new WorldFx.View(); v.setAngles(0, 1.62, 0, 0, 0, 70, gw, gh); double[] P = new double[3];
        // nameplates of players at 3, 7 and 15 blocks (the same scale rule as in game)
        String[] names = {"Steve_Builds", "AuroraFan", "xX_Sniper_Xx"}; double[] dist = {3, 7, 15}, xs = {-1.4, 1.6, -0.3}; double[] hp = {0.9, 0.45, 0.15};
        String[] styles = {"bar", "both", "number"}; int[] team = {0xFFFFFF, 0x55FFFF, 0xFF5555};
        for (int i = 2; i >= 0; i--) {
            v.project(xs[i], 1.8 + 0.5, dist[i], P); double k = WorldFx.plateScale(v.perBlock(P[2]), 1);
            p.healthStyle = styles[i]; WorldArt.nameplate(c, p, P[0], P[1], k, names[i], team[i], hp[i], WorldFx.formatAmount(hp[i] * 20, "hp", 1).replace("+", ""), i == 1 ? "" : (40 + i * 70) + " ms", WorldFx.pingColor(40 + i * 70), i == 0, 1);
            if (i == 0) { Glass(c, WorldArt.ITEM); }
        }
        // health cards and damage numbers over a zombie at 6 blocks
        v.project(3.2, 1.95 + 0.45, 6, P); double kk = WorldFx.plateScale(v.perBlock(P[2]), 1);
        WorldArt.healthCard(c, P[0], P[1], kk, 40, 0.55, 0.1, "11 / 20", true, 0x6FE3FF, 45, 1);
        double[] M = new double[3]; double[] ages = {0.05, 0.3, 0.7, 1.0}; String[] amt = {"7", "3.5", "+2", "12"}; int[] col = {0xFF5A6E, 0xFF5A6E, 0x6FE38A, Sky.mix(0xFF5A6E, 0xFFD166, 0.45)};
        for (int i = 0; i < ages.length; i++) {
            WorldFx.numberMotion(ages[i], 1.2, 1, M); v.project(3.2 + (i - 1.5) * 0.35, 1.75 + 0.25 + M[0], 6, P);
            WorldArt.number(c, amt[i], P[0], P[1], 9 * WorldFx.plateScale(v.perBlock(P[2]), 1) * M[2], col[i], M[1], true);
        }
        // every emblem design, turned from facing the camera to 60 degrees, as on a player's back
        int n = WorldFx.EMBLEMS.size();
        for (int i = 0; i < n; i++) {
            double ang = Math.toRadians(i * 10), cx = gw * (0.08 + 0.84 * i / (n - 1.0)), cy = gh * 0.82, half = 22;
            WorldArt.emblem(c, WorldFx.EMBLEMS.get(i), 0x6FE3FF, 0xB78CFF, true, true, cx, cy, half * Math.cos(ang), 0, 0, half, 1);
        }
        g.dispose(); ImageIO.write(img, "png", new File(a[1])); System.out.println("wrote " + a[1]);
    }
    /** Marks where the held item goes (the preview has no item renderer). */
    static void Glass(Gfx c, double[] slot) { if (slot[2] > 0) gg.auroras.client.ui.Glass.rect(c, slot[0], slot[1], slot[2], slot[2], slot[2] * 0.2, 0x806FE3FF); }
}
