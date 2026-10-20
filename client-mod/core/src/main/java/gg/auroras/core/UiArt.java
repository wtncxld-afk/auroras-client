package gg.auroras.core;

/**
 * Smooth shapes for the in-game menus. Minecraft's GUI only fills hard-edged rectangles, so the menus draw rounded
 * corners, circles, soft shadows, gradients and icons from small white textures baked here at the screen's real pixel
 * size and tinted when drawn. Rounded rectangles of any size are drawn nine-slice from one circle texture: the four
 * quarters for the corners and its middle row and column stretched for the edges. Everything is straight ARGB, white,
 * with the shape in the alpha channel. Unit-tested in UiTests.
 */
public final class UiArt {
    private UiArt() {}

    /** A filled circle of radius r in a 2r x 2r image, edges anti-aliased (exact coverage within half a pixel). */
    public static int[] disk(int r) {
        int s = 2 * r; int[] o = new int[s * s];
        for (int y = 0; y < s; y++) for (int x = 0; x < s; x++) o[y * s + x] = white(cover(dist(x, y, r) - r));
        return o;
    }
    /** A ring (outline of the disk above), stroke pixels wide on the inside of radius r. */
    public static int[] ring(int r, double stroke) {
        int s = 2 * r; int[] o = new int[s * s];
        for (int y = 0; y < s; y++) for (int x = 0; x < s; x++) { double d = dist(x, y, r) - r; o[y * s + x] = white(cover(d) - cover(d + stroke)); }
        return o;
    }
    /**
     * A soft shadow for a rounded rectangle of corner radius r, blurred over blur pixels: a 2(r + blur) square whose
     * middle row and column stretch for the edges, like disk(). Opaque inside, fading smoothly to 0 at the edge.
     */
    public static int[] shadow(int r, int blur) {
        int R = r + blur, s = 2 * R; int[] o = new int[s * s];
        for (int y = 0; y < s; y++) for (int x = 0; x < s; x++) {
            double d = dist(x, y, R) - r, t = Math.max(0, Math.min(1, (d + blur * 0.5) / (blur * 1.5)));
            o[y * s + x] = white(1 - t * t * (3 - 2 * t));
        }
        return o;
    }
    /**
     * A sakura petal in a size x size square, pointing right: an oval, fuller toward its tip, with the small notch real
     * cherry petals have, and a soft vein of extra light down its middle.
     */
    public static int[] petal(int size) {
        int[] o = new int[size * size]; double c = size / 2.0, a = size * 0.46, b = size * 0.27;
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
            double px = x + 0.5 - c, py = y + 0.5 - c, u = px / a, bw = b * (0.75 + 0.25 * (u + 1) / 2), v = py / bw, e = Math.sqrt(u * u + v * v);
            double edge = (1 - e) * Math.min(a, bw), cov = Math.max(0, Math.min(1, edge + 0.5));
            double nx = px - a * 0.98, notch = Math.max(0, Math.min(1, Math.sqrt(nx * nx + py * py * 2.2) - size * 0.09 + 0.5));
            double vein = 0.82 + 0.18 * Math.max(0, 1 - Math.abs(py) / (b * 0.35));
            o[y * size + x] = white(cov * notch * vein);
        }
        return o;
    }
    /** 1 x n vertical ramp, opaque at the top to clear at the bottom (gradients, sheen). */
    public static int[] ramp(int n) { int[] o = new int[n]; for (int i = 0; i < n; i++) o[i] = white(1 - (i + 0.5) / n); return o; }

    /**
     * An icon mask (mw x mh, 0..1) resampled to size x size by area averaging, so a 128-pixel icon stays smooth and
     * sharp at 16 or 24 screen pixels (the GUI draws textures without filtering).
     */
    public static int[] icon(float[] mask, int mw, int mh, int size) {
        int[] o = new int[size * size]; if (mask == null || size <= 0) return o;
        double sx = (double) mw / size, sy = (double) mh / size;
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
            double x0 = x * sx, x1 = x0 + sx, y0 = y * sy, y1 = y0 + sy, sum = 0;
            for (int v = (int) y0; v < Math.min(mh, Math.ceil(y1)); v++) { double wy = Math.min(y1, v + 1) - Math.max(y0, v);
                for (int u = (int) x0; u < Math.min(mw, Math.ceil(x1)); u++) sum += mask[v * mw + u] * wy * (Math.min(x1, u + 1) - Math.max(x0, u)); }
            o[y * size + x] = white(sum / (sx * sy));
        }
        return o;
    }

    /** Pixel centre's distance from the centre of a 2r square. */
    static double dist(int x, int y, int r) { double dx = x + 0.5 - r, dy = y + 0.5 - r; return Math.sqrt(dx * dx + dy * dy); }
    /** Coverage of a pixel whose centre is d pixels outside an edge (negative = inside). */
    static double cover(double d) { return Math.max(0, Math.min(1, 0.5 - d)); }
    /**
     * A colour image (straight ARGB, sw x sh) resized to dw x dh by area averaging in premultiplied alpha, so a picture
     * drawn smaller than its file stays smooth (Minecraft samples GUI textures without filtering) and transparent edges
     * never darken. Larger sizes are bilinear.
     */
    public static int[] resize(int[] src, int sw, int sh, int dw, int dh) {
        int[] o = new int[dw * dh]; double fx = sw / (double) dw, fy = sh / (double) dh;
        for (int y = 0; y < dh; y++) for (int x = 0; x < dw; x++) {
            double a = 0, r = 0, g = 0, b = 0, wsum = 0;
            if (fx <= 1 && fy <= 1) { // enlarging: bilinear
                double sx = Math.max(0, Math.min(sw - 1, (x + 0.5) * fx - 0.5)), sy = Math.max(0, Math.min(sh - 1, (y + 0.5) * fy - 0.5));
                int x0 = (int) sx, y0 = (int) sy, x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1); double tx = sx - x0, ty = sy - y0;
                int[][] px = {{x0, y0}, {x1, y0}, {x0, y1}, {x1, y1}}; double[] wt = {(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty};
                for (int k = 0; k < 4; k++) { int p = src[px[k][1] * sw + px[k][0]]; double al = (p >>> 24) / 255.0, w = wt[k] * al; a += wt[k] * al; r += w * ((p >> 16) & 255); g += w * ((p >> 8) & 255); b += w * (p & 255); }
                wsum = 1;
            } else { // shrinking: the exact area each output pixel covers
                double x0 = x * fx, x1 = x0 + fx, y0 = y * fy, y1 = y0 + fy;
                for (int sy = (int) y0; sy < Math.min(sh, Math.ceil(y1)); sy++) { double cy = Math.min(y1, sy + 1) - Math.max(y0, sy); if (cy <= 0) continue;
                    for (int sx = (int) x0; sx < Math.min(sw, Math.ceil(x1)); sx++) { double cw = (Math.min(x1, sx + 1) - Math.max(x0, sx)) * cy; if (cw <= 0) continue;
                        int p = src[sy * sw + sx]; double al = (p >>> 24) / 255.0, w = cw * al; a += w; r += w * ((p >> 16) & 255); g += w * ((p >> 8) & 255); b += w * (p & 255); wsum += cw; } }
            }
            double A = wsum > 0 ? a / wsum : 0; if (A <= 0.002 || a <= 0) continue;
            o[y * dw + x] = (int) Math.round(A * 255) << 24 | ch(r / a) << 16 | ch(g / a) << 8 | ch(b / a);
        }
        return o;
    }
    private static int ch(double v) { return (int) Math.max(0, Math.min(255, Math.round(v))); }
    static int white(double a) { int al = (int) Math.round(Math.max(0, Math.min(1, a)) * 255); return al == 0 ? 0 : al << 24 | 0xFFFFFF; }
}
