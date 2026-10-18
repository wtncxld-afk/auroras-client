package gg.auroras.core;

/**
 * Anti-aliased software rasterizing for the in-game radial menu. Minecraft's GUI has no smooth shapes, so the menu's
 * glass petals are drawn here once (at the screen's real pixel size) into ARGB images, which the adapter uploads as
 * textures and draws 1:1. Coverage is exact horizontally and sampled at 4 sub-rows vertically, so edges are smooth in
 * both directions. Pure Java, allocation-free in the inner loops, unit-tested in RadialTests.
 */
public final class Raster {
    private Raster() {}
    private static final int SUB = 4;

    /**
     * Adds sign x coverage (0..1) of the closed polygon (xs, ys, n points) to acc, a w x h grid of pixels whose top-left
     * corner is at (ox, oy) in polygon coordinates. Even-odd rule.
     */
    public static void cover(float[] xs, float[] ys, int n, float ox, float oy, int w, int h, float sign, float[] acc) {
        float[] hits = new float[Math.max(4, n)];
        float q = sign / SUB;
        for (int py = 0; py < h; py++) {
            int row = py * w;
            for (int s = 0; s < SUB; s++) {
                float y = oy + py + (s + 0.5f) / SUB; int c = 0;
                for (int i = 0, j = n - 1; i < n; j = i++) {
                    float y1 = ys[j], y2 = ys[i];
                    if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) hits[c++] = xs[j] + (y - y1) / (y2 - y1) * (xs[i] - xs[j]);
                }
                for (int a = 1; a < c; a++) { float v = hits[a]; int b = a - 1; while (b >= 0 && hits[b] > v) { hits[b + 1] = hits[b]; b--; } hits[b + 1] = v; }
                for (int k = 0; k + 1 < c; k += 2) span(acc, row, w, hits[k] - ox, hits[k + 1] - ox, q);
            }
        }
    }
    /** Adds q x the exact overlap of [a, b) with each pixel of one row. */
    static void span(float[] acc, int row, int w, float a, float b, float q) {
        if (b <= 0 || a >= w || b <= a) return; if (a < 0) a = 0; if (b > w) b = w;
        int ia = (int) a, ib = (int) b;
        if (ia == ib) { acc[row + ia] += (b - a) * q; return; }
        acc[row + ia] += (ia + 1 - a) * q;
        for (int k = ia + 1; k < ib; k++) acc[row + k] += q;
        if (ib < w) acc[row + ib] += (b - ib) * q;
    }

    /** Star-shaped outline r(angle) around (cx, cy) as n points, with each radius grown by grow (an outline offset). */
    public static void star(Shape shape, float cx, float cy, float grow, int n, float[] xs, float[] ys) {
        for (int i = 0; i < n; i++) { double a = i * 2 * Math.PI / n, r = shape.radius(a) + grow; xs[i] = (float) (cx + Math.cos(a) * r); ys[i] = (float) (cy + Math.sin(a) * r); }
    }
    public interface Shape { double radius(double angle); }

    /** Even-odd point test against a polygon (hit testing petals by their real outline). */
    public static boolean inside(float[] xs, float[] ys, int n, double x, double y) {
        boolean in = false;
        for (int i = 0, j = n - 1; i < n; j = i++) if ((ys[i] > y) != (ys[j] > y) && x < (xs[j] - xs[i]) * (y - ys[i]) / (ys[j] - ys[i]) + xs[i]) in = !in;
        return in;
    }

    /** Composites a coverage layer (alpha = cov x a, color rgb) over a premultiplied ARGB float image (4 floats per pixel). */
    public static void over(float[] img, float[] cov, int rgb, float a) {
        float r = ((rgb >> 16) & 255) / 255f, g = ((rgb >> 8) & 255) / 255f, b = (rgb & 255) / 255f;
        for (int p = 0, q = 0; p < cov.length; p++, q += 4) {
            float al = Math.max(0, Math.min(1, cov[p])) * a; if (al <= 0) continue;
            float k = 1 - al; img[q] = al + img[q] * k; img[q + 1] = r * al + img[q + 1] * k; img[q + 2] = g * al + img[q + 2] * k; img[q + 3] = b * al + img[q + 3] * k;
        }
    }
    /** Composites an alpha mask (mw x mh, values 0..1) scaled into the box (x, y, s x s) with bilinear sampling. */
    public static void overMask(float[] img, int w, int h, float[] mask, int mw, int mh, float x, float y, float s, int rgb, float a) {
        float r = ((rgb >> 16) & 255) / 255f, g = ((rgb >> 8) & 255) / 255f, b = (rgb & 255) / 255f;
        int x0 = Math.max(0, (int) Math.floor(x)), y0 = Math.max(0, (int) Math.floor(y)), x1 = Math.min(w, (int) Math.ceil(x + s)), y1 = Math.min(h, (int) Math.ceil(y + s));
        for (int py = y0; py < y1; py++) for (int px = x0; px < x1; px++) {
            float u = (px + 0.5f - x) / s * mw - 0.5f, v = (py + 0.5f - y) / s * mh - 0.5f;
            float al = sample(mask, mw, mh, u, v) * a; if (al <= 0) continue;
            int q = (py * w + px) * 4; float k = 1 - al;
            img[q] = al + img[q] * k; img[q + 1] = r * al + img[q + 1] * k; img[q + 2] = g * al + img[q + 2] * k; img[q + 3] = b * al + img[q + 3] * k;
        }
    }
    static float sample(float[] m, int w, int h, float u, float v) {
        int x0 = (int) Math.floor(u), y0 = (int) Math.floor(v); float fx = u - x0, fy = v - y0;
        return lerp(lerp(at(m, w, h, x0, y0), at(m, w, h, x0 + 1, y0), fx), lerp(at(m, w, h, x0, y0 + 1), at(m, w, h, x0 + 1, y0 + 1), fx), fy);
    }
    static float at(float[] m, int w, int h, int x, int y) { return x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y * w + x]; }
    static float lerp(float a, float b, float t) { return a + (b - a) * t; }
    /** Premultiplied float image to straight ARGB ints (what Minecraft's NativeImage#setPixel takes). */
    public static int[] toArgb(float[] img) {
        int[] out = new int[img.length / 4];
        for (int p = 0; p < out.length; p++) {
            float a = img[p * 4]; if (a <= 0.002f) continue;
            int al = Math.round(Math.min(1, a) * 255), r = Math.round(Math.min(1, img[p * 4 + 1] / a) * 255), g = Math.round(Math.min(1, img[p * 4 + 2] / a) * 255), b = Math.round(Math.min(1, img[p * 4 + 3] / a) * 255);
            out[p] = (al << 24) | (r << 16) | (g << 8) | b;
        }
        return out;
    }
}
