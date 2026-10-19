package gg.auroras.core;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Renders the radial menu exactly as the mod composes it (same baked petal and hub art, same font atlas and layout) into
 * a PNG, so the look can be reviewed without Minecraft. Run: java -cp out gg.auroras.core.RadialPreview ../../visuals out.png [w h t hover]
 * t = seconds since opening (omit for fully open); hover = petal index or -1.
 */
public class RadialPreview {
    public static void main(String[] a) throws Exception {
        Path vis = Path.of(a[0]); int W = a.length > 2 ? Integer.parseInt(a[2]) : 1600, H = a.length > 3 ? Integer.parseInt(a[3]) : 900;
        double t = a.length > 4 ? Double.parseDouble(a[4]) : 5; int hov = a.length > 5 ? Integer.parseInt(a[5]) : -1;
        BufferedImage bg = background(W, H);
        RadialMenu m = new RadialMenu(W, H); for (double s = 0; s < t; s += 1 / 60.0) m.update(1 / 60.0, hov, false);
        TextKit tk = new TextKit(Files.readString(vis.resolve("font/auroras-font.json"))); BufferedImage atlas = ImageIO.read(vis.resolve("font/auroras-font.png").toFile());
        int gs = Math.max(1, Math.min(4, Math.min(W / 320, H / 240)));
        // scrim
        fill(bg, 0, 0, W, H, (int) (0.42 * 255 * m.hubProgress()) << 24 | 0x05070C);
        int side = m.side();
        for (int k = 0; k < RadialMenu.N; k++) {
            float[] icon = mask(ImageIO.read(vis.resolve("icons/" + RadialMenu.PETALS.get(k).icon() + ".png").toFile()));
            int[] rest = m.bakePetal(k, false, icon, 128, 128), over = m.bakePetal(k, true, icon, 128, 128);
            float s = m.scale(k), al = m.alpha(k), hv = (float) m.hover[k];
            blit(bg, rest, side, m.px(k), m.py(k), s, al * (1 - hv)); blit(bg, over, side, m.px(k), m.py(k), s, al * hv);
            TextKit.Face f = tk.face("semibold", 9 * gs); String lab = RadialMenu.PETALS.get(k).label(); double tw = tk.width(f, lab, 1);
            text(bg, atlas, tk, f, lab, m.px(k) - tw / 2, m.py(k) + m.petalR * 0.42 * s, 0xFFFFFF, al);
        }
        int hs = m.hubSide(); blit(bg, m.bakeHub(), hs, m.cx, m.cy, (float) (0.9 + 0.1 * m.hubProgress()), (float) m.hubProgress());
        // the 3D head, as RadialScreen draws it (skin from AURORAS_SKIN, a 64x64 skin PNG, or the test skin), looking toward the hovered section
        int[] skin = RadialTests.testSkin(true); String sp = System.getenv("AURORAS_SKIN");
        if (sp != null) { BufferedImage si = ImageIO.read(new File(sp)); for (int y = 0; y < 16; y++) for (int x = 0; x < 64; x++) skin[y * 64 + x] = si.getRGB(x, y); }
        int hsz = Math.round(m.hubR * 1.1f / 2) * 2; double yw = hov < 0 ? 12 : Math.cos(m.angle(hov)) * Head3D.MAX_YAW * 0.8, pt = hov < 0 ? -6 : Math.sin(m.angle(hov)) * Head3D.MAX_PITCH * 0.8;
        blit(bg, new Head3D(skin).render(hsz, yw, pt), hsz, hsz, m.cx, (float) (m.cy - m.hubR * 0.34), 1, 1);
        TextKit.Face nf = tk.face("semibold", 9 * gs); String name = "Player"; text(bg, atlas, tk, nf, name, m.cx - tk.width(nf, name, 1) / 2, m.cy + m.hubR * 0.30, 0xFFFFFF, 1);
        TextKit.Face bf = tk.face("semibold", 7 * gs); String badge = "AURORAS"; int bw = (int) Math.ceil(tk.width(bf, badge, 1)) + 7 * gs * 2, bh = 11 * gs;
        int[] pill = RadialMenu.bakePill(bw, bh, 0x8FD3FF, 0.95f); blit(bg, pill, bw, bh, m.cx, m.cy + m.hubR * 0.44f + bh / 2f, 1, 1);
        text(bg, atlas, tk, bf, badge, m.cx - tk.width(bf, badge, 1) / 2, m.cy + m.hubR * 0.44f + bh / 2f + bf.ascent() * 0.5 - 1, 0x06141F, 1);
        TextKit.Face bf2 = tk.face("semibold", 11 * gs); text(bg, atlas, tk, bf2, "Auroras Client", 16 * gs + 18 * gs, 12 * gs + bf2.ascent(), 0xFFFFFF, 1);
        String lp = System.getenv("AURORAS_LOGO"); // the mod's logo.png; a plain square without it
        if (lp != null) { java.awt.Graphics2D g = bg.createGraphics(); g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR); g.drawImage(ImageIO.read(new File(lp)), 12 * gs, 10 * gs, 18 * gs, 18 * gs, null); g.dispose(); }
        else fill(bg, 12 * gs, 10 * gs, 18 * gs, 18 * gs, 0xFF8FD3FF);
        ImageIO.write(bg, "png", new File(a[1])); System.out.println("wrote " + a[1]);
    }
    static float[] mask(BufferedImage im) { float[] m = new float[im.getWidth() * im.getHeight()]; for (int y = 0; y < im.getHeight(); y++) for (int x = 0; x < im.getWidth(); x++) { int p = im.getRGB(x, y); m[y * im.getWidth() + x] = ((p >>> 24) == 0 ? 0 : (p & 255)) / 255f * ((p >>> 24) / 255f); } return m; }
    static BufferedImage background(int W, int H) {
        BufferedImage b = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB);
        String bgp = System.getenv("AURORAS_BG"); // optional backdrop image (e.g. a sky preview), scaled to fill
        if (bgp != null) try { java.awt.Graphics2D g = b.createGraphics(); g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR); g.drawImage(ImageIO.read(new File(bgp)), 0, 0, W, H, null); g.dispose(); return b; } catch (Exception e) { throw new RuntimeException(e); }
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) { int c = ((x / 64 + y / 64) % 2 == 0) ? 0x3E7B3A : 0x4E8C45; if (y < H / 3) c = 0x6C8FBF + ((x / 32 + y / 32) % 2) * 0x050505; b.setRGB(x, y, 0xFF000000 | c); }
        return b;
    }
    static void fill(BufferedImage b, int x, int y, int w, int h, int argb) { for (int j = Math.max(0, y); j < Math.min(b.getHeight(), y + h); j++) for (int i = Math.max(0, x); i < Math.min(b.getWidth(), x + w); i++) b.setRGB(i, j, mix(b.getRGB(i, j), argb, ((argb >>> 24) & 255) / 255f)); }
    static void blit(BufferedImage b, int[] img, int s, float cx, float cy, float scale, float alpha) { blit(b, img, s, s, cx, cy, scale, alpha); }
    /** Nearest-neighbour scaled draw, like Minecraft's GUI textures. */
    static void blit(BufferedImage b, int[] img, int w, int h, float cx, float cy, float scale, float alpha) {
        if (alpha <= 0) return; int dw = Math.round(w * scale), dh = Math.round(h * scale), x0 = Math.round(cx - dw / 2f), y0 = Math.round(cy - dh / 2f);
        for (int j = 0; j < dh; j++) for (int i = 0; i < dw; i++) {
            int X = x0 + i, Y = y0 + j; if (X < 0 || Y < 0 || X >= b.getWidth() || Y >= b.getHeight()) continue;
            int p = img[Math.min(h - 1, (int) (j / scale)) * w + Math.min(w - 1, (int) (i / scale))]; float al = ((p >>> 24) / 255f) * alpha; if (al <= 0) continue;
            b.setRGB(X, Y, mix(b.getRGB(X, Y), p, al));
        }
    }
    static void text(BufferedImage b, BufferedImage atlas, TextKit tk, TextKit.Face f, String s, double x, double base, int rgb, float alpha) {
        tk.draw(f, s, x + 1, base + 1, 1, (gx, gy, w, h, u, v, uw, vh) -> glyph(b, atlas, gx, gy, w, h, u, v, 0x000000, alpha * 0.35f));
        tk.draw(f, s, x, base, 1, (gx, gy, w, h, u, v, uw, vh) -> glyph(b, atlas, gx, gy, w, h, u, v, rgb, alpha));
    }
    static void glyph(BufferedImage b, BufferedImage atlas, int x, int y, int w, int h, int u, int v, int rgb, float alpha) {
        for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) { int X = x + i, Y = y + j; if (X < 0 || Y < 0 || X >= b.getWidth() || Y >= b.getHeight()) continue; float al = ((atlas.getRGB(u + i, v + j) >>> 24) / 255f) * alpha; if (al > 0) b.setRGB(X, Y, mix(b.getRGB(X, Y), rgb, al)); }
    }
    static int mix(int dst, int src, float a) {
        int r = (int) (((dst >> 16) & 255) * (1 - a) + ((src >> 16) & 255) * a), g = (int) (((dst >> 8) & 255) * (1 - a) + ((src >> 8) & 255) * a), bl = (int) ((dst & 255) * (1 - a) + (src & 255) * a);
        return 0xFF000000 | (r << 16) | (g << 8) | bl;
    }
}
