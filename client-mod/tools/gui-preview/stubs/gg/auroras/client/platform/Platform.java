package gg.auroras.client.platform;

import net.minecraft.resources.Identifier;

/** Preview stand-in: textures made by the menus are kept in memory for the preview Gfx to draw. */
public final class Platform {
    private Platform() {}
    public static void texture(Identifier id, int[] argb, int w, int h) { Gfx.register(id, argb, w, h); }
    public static int[] png(String resource, int[] wh) {
        try (var in = Platform.class.getResourceAsStream(resource)) { if (in == null) return null; java.awt.image.BufferedImage i = javax.imageio.ImageIO.read(in); wh[0] = i.getWidth(); wh[1] = i.getHeight(); return i.getRGB(0, 0, wh[0], wh[1], null, 0, wh[0]); } catch (Exception e) { return null; }
    }
}
