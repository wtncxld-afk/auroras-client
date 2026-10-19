package gg.auroras.client.platform;

import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.util.ArrayDeque;

/**
 * Preview stand-in for the adapters' Gfx: the same drawing calls, painted with Java2D at the GUI scale. Text uses a
 * stand-in font with Minecraft's character widths (Minecraft's own font isn't bundled), so text looks a little different.
 */
public final class Gfx {
    public static double GS = 3; public static BufferedImage LOGO;
    private final Graphics2D g; private final ArrayDeque<AffineTransform> stack = new ArrayDeque<>(); private final ArrayDeque<Shape> clips = new ArrayDeque<>();
    private final int gw, gh;
    public Gfx(Graphics2D g, int guiW, int guiH) { this.g = g; gw = guiW; gh = guiH; g.scale(GS, GS); g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON); }
    public void fill(int x0, int y0, int x1, int y1, int argb) { if (x1 < x0) { int t = x0; x0 = x1; x1 = t; } if (y1 < y0) { int t = y0; y0 = y1; y1 = t; } g.setColor(new Color(argb, true)); g.fillRect(x0, y0, x1 - x0, y1 - y0); }
    static final Font F = new Font(Font.SANS_SERIF, Font.BOLD, 8);
    public void text(String s, int x, int y, int argb, boolean shadow) {
        g.setFont(F); float cx = x;
        for (int i = 0; i < s.length(); i++) { String ch = s.substring(i, i + 1); int w = cw(s.charAt(i));
            if (shadow) { g.setColor(new Color((argb & 0xFCFCFC) >> 2 | (argb & 0xFF000000), true)); g.drawString(ch, cx + 1, y + 8); }
            g.setColor(new Color(argb, true)); g.drawString(ch, cx, y + 7); cx += w; }
    }
    static int cw(char c) { return switch (c) { case 'i', '!', '.', ',', ':', ';', '|', '\'' -> 2; case 'l', '`' -> 3; case 'I', 't', '[', ']', ' ' -> 4; case 'f', 'k', '<', '>', '"', '(', ')', '{', '}', '*' -> 5; case '@', '~' -> 7; default -> 6; }; }
    public static int width(String s) { int w = 0; for (int i = 0; i < s.length(); i++) w += cw(s.charAt(i)); return w; }
    public void push() { stack.push(g.getTransform()); }
    public void pop() { g.setTransform(stack.pop()); }
    public void translate(float x, float y) { g.translate(x, y); }
    public void scale(float s) { g.scale(s, s); }
    public void texture(net.minecraft.resources.Identifier id, int x, int y, int w, int h, int argb) {
        if (LOGO != null && id.path().endsWith("logo.png")) { g.drawImage(LOGO, x, y, w, h, null); return; }
        BufferedImage im = image(id); if (im != null) region(id, x, y, w, h, 0, 0, im.getWidth(), im.getHeight(), im.getWidth(), im.getHeight(), argb);
    }
    public void sprite(net.minecraft.resources.Identifier id, int x, int y, int w, int h, int argb) {}
    /** Like the game: nearest-pixel sampling, the colour multiplied by argb. */
    public void region(net.minecraft.resources.Identifier id, int x, int y, int w, int h, int u, int v, int uw, int vh, int tw, int th, int argb) {
        BufferedImage src = image(id); if (src == null || w <= 0 || h <= 0 || uw <= 0 || vh <= 0) return;
        BufferedImage sub = new BufferedImage(uw, vh, BufferedImage.TYPE_INT_ARGB);
        float ta = ((argb >>> 24) & 255) / 255f, tr = ((argb >> 16) & 255) / 255f, tg = ((argb >> 8) & 255) / 255f, tb = (argb & 255) / 255f;
        for (int j = 0; j < vh; j++) for (int i = 0; i < uw; i++) { int sx = u + i, sy = v + j; if (sx >= src.getWidth() || sy >= src.getHeight()) continue; int p = src.getRGB(sx, sy);
            sub.setRGB(i, j, Math.round(((p >>> 24) & 255) * ta) << 24 | Math.round(((p >> 16) & 255) * tr) << 16 | Math.round(((p >> 8) & 255) * tg) << 8 | Math.round((p & 255) * tb)); }
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR); g.drawImage(sub, x, y, w, h, null);
    }
    static final java.util.Map<String, BufferedImage> IMAGES = new java.util.HashMap<>();
    public static void register(net.minecraft.resources.Identifier id, int[] argb, int w, int h) { BufferedImage b = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB); b.setRGB(0, 0, w, h, argb, 0, w); IMAGES.put(id.ns() + ":" + id.path(), b); }
    static BufferedImage image(net.minecraft.resources.Identifier id) {
        return IMAGES.computeIfAbsent(id.ns() + ":" + id.path(), k -> { try (var in = Gfx.class.getResourceAsStream("/assets/" + id.ns() + "/" + id.path())) { return in == null ? null : javax.imageio.ImageIO.read(in); } catch (Exception e) { return null; } });
    }
    public static double guiScale() { return GS; }
    public void scissor(int x0, int y0, int x1, int y1) { clips.push(g.getClip() == null ? new Rectangle(-9999, -9999, 99999, 99999) : g.getClip()); g.clipRect(x0, y0, x1 - x0, y1 - y0); }
    public void noScissor() { Shape s = clips.pop(); g.setClip(s); }
    public int w() { return gw; }
    public int h() { return gh; }
}
