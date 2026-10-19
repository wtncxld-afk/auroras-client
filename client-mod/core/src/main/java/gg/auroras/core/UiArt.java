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
    static int white(double a) { int al = (int) Math.round(Math.max(0, Math.min(1, a)) * 255); return al == 0 ? 0 : al << 24 | 0xFFFFFF; }
}
