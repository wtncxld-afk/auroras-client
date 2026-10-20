package gg.auroras.client;

import gg.auroras.client.platform.Gfx;
import gg.auroras.core.Head3D;

/** Preview stand-in for MenuProfile: the 3D head from AURORAS_SKIN (a 64x64 skin) through core Head3D, the same maths as in game. */
public final class MenuProfile {
    static Head3D head; static boolean tried; static final Head3D.Follow LOOK = new Head3D.Follow(); public static String NAME = "cxld";
    public static void refresh() {
        if (tried) return; tried = true; String skin = System.getenv("AURORAS_SKIN"); if (skin == null) return;
        try { java.awt.image.BufferedImage sk = javax.imageio.ImageIO.read(new java.io.File(skin)); int[] px = new int[Head3D.SKIN_W * Head3D.SKIN_H];
            for (int y = 0; y < Head3D.SKIN_H; y++) for (int x = 0; x < Head3D.SKIN_W; x++) px[y * Head3D.SKIN_W + x] = sk.getRGB(x, y); head = new Head3D(px); } catch (Exception e) { System.out.println("no skin: " + e); }
    }
    public static String name() { return NAME; }
    public static boolean draw(Gfx g, double x, double y, double size, double mx, double my, double dt, boolean reduced, float alpha) {
        if (head == null) return false; double gs = Gfx.guiScale();
        double[] aim = Head3D.Follow.target((mx - x - size / 2) * gs, (my - y - size / 2) * gs, 400); LOOK.update(dt, aim[0], aim[1], reduced);
        int px = (int) Math.round(size * 1.3 * gs / 2) * 2; net.minecraft.resources.Identifier id = net.minecraft.resources.Identifier.fromNamespaceAndPath("auroras_client", "radial/head3d_" + px);
        Gfx.register(id, head.render(px, LOOK.yaw, LOOK.pitch), px, px);
        g.push(); g.scale((float) (1 / gs)); g.texture(id, (int) Math.round((x + size / 2) * gs - px / 2.0), (int) Math.round((y + size / 2) * gs - px / 2.0), px, px, Math.round(alpha * 255) << 24 | 0xFFFFFF); g.pop(); return true;
    }
}
