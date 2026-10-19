package gg.auroras.core;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;

/** The 3D menu head at several angles in one PNG, for checking by eye. Run: java -cp out gg.auroras.core.HeadPreview out.png [skin-64x64.png] */
public class HeadPreview {
    public static void main(String[] a) throws Exception {
        int[] skin;
        if (a.length > 1) { BufferedImage s = ImageIO.read(new File(a[1])); skin = new int[64 * 16]; for (int y = 0; y < 16; y++) for (int x = 0; x < 64; x++) skin[y * 64 + x] = s.getRGB(x, y); }
        else skin = RadialTests.testSkin(true);
        Head3D h = new Head3D(skin); int S = 160; double[][] ang = {{-40, 0}, {-20, -15}, {0, 0}, {20, 15}, {40, 0}, {0, 26}, {0, -26}, {30, -20}};
        BufferedImage out = new BufferedImage(S * ang.length, S, BufferedImage.TYPE_INT_ARGB);
        for (int i = 0; i < ang.length; i++) {
            int[] px = h.render(S, ang[i][0], ang[i][1]);
            for (int y = 0; y < S; y++) for (int x = 0; x < S; x++) { int c = px[y * S + x], al = c >>> 24, bg = ((x / 8 + y / 8) & 1) == 0 ? 0x1A2233 : 0x222C40;
                int r = (((c >> 16) & 255) * al + ((bg >> 16) & 255) * (255 - al)) / 255, g = (((c >> 8) & 255) * al + ((bg >> 8) & 255) * (255 - al)) / 255, b = ((c & 255) * al + (bg & 255) * (255 - al)) / 255;
                out.setRGB(i * S + x, y, 0xFF000000 | r << 16 | g << 8 | b); }
        }
        ImageIO.write(out, "png", new File(a[0]));
    }
}
