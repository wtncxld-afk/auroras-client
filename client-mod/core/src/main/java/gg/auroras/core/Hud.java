package gg.auroras.core;

import java.util.*;

/** HUD placement maths shared by the renderer and the HUD editor. */
public final class Hud {
    private Hud() {}
    public enum Anchor { TL, TC, TR, CL, C, CR, BL, BC, BR; int ax() { return ordinal() % 3; } int ay() { return ordinal() / 3; } }
    public record Placement(Anchor anchor, int offX, int offY) {}

    public static int[] clamp(int x, int y, int w, int h, int sw, int sh) {
        return new int[]{Math.max(0, Math.min(x, Math.max(0, sw - w))), Math.max(0, Math.min(y, Math.max(0, sh - h)))};
    }
    /** Top-left pixel of an element of size w*h (already scaled) at the given placement. */
    public static int[] resolve(Placement p, int w, int h, int sw, int sh) {
        int x = p.anchor().ax() == 0 ? 0 : p.anchor().ax() == 1 ? (sw - w) / 2 : sw - w;
        int y = p.anchor().ay() == 0 ? 0 : p.anchor().ay() == 1 ? (sh - h) / 2 : sh - h;
        return clamp(x + p.offX(), y + p.offY(), w, h, sw, sh);
    }
    /** Allocation-free variant for per-frame use: writes the top-left pixel into out[0], out[1]. */
    public static void resolveInto(Anchor a, int offX, int offY, int w, int h, int sw, int sh, int[] out) {
        int x = a.ax() == 0 ? 0 : a.ax() == 1 ? (sw - w) / 2 : sw - w, y = a.ay() == 0 ? 0 : a.ay() == 1 ? (sh - h) / 2 : sh - h;
        out[0] = Math.max(0, Math.min(x + offX, Math.max(0, sw - w))); out[1] = Math.max(0, Math.min(y + offY, Math.max(0, sh - h)));
    }
    /** Converts a dragged pixel position back to the nearest anchor plus offset (what the editor saves). */
    public static Placement fromPosition(int x, int y, int w, int h, int sw, int sh) {
        int cx = x + w / 2, cy = y + h / 2;
        int ax = cx < sw / 3 ? 0 : cx < 2 * sw / 3 ? 1 : 2, ay = cy < sh / 3 ? 0 : cy < 2 * sh / 3 ? 1 : 2;
        Anchor a = Anchor.values()[ay * 3 + ax]; int[] b = resolve(new Placement(a, 0, 0), w, h, sw, sh);
        return new Placement(a, x - b[0], y - b[1]);
    }
    public static int scaled(int base, float scale) { return Math.max(1, Math.round(base * scale)); }
    /** Resize handle: dragging right by baseWidth pixels adds 1.0 scale. Result is kept in 0.5..3.0. */
    public static float scaleFromDrag(float scale, int dragDeltaPx, int baseWidth) {
        return Math.max(0.5f, Math.min(3.0f, scale + dragDeltaPx / (float) Math.max(1, baseWidth)));
    }
    private static int snap1(int pos, int len, int th, int[] targets) {
        int best = 0, bestAbs = th + 1;
        for (int e : new int[]{pos, pos + len / 2, pos + len}) for (int t : targets) { int d = t - e; if (Math.abs(d) < bestAbs) { bestAbs = Math.abs(d); best = d; } }
        return bestAbs <= th ? pos + best : pos;
    }
    /** Snaps edges and centres to the screen lines and to other elements ({x,y,w,h} each). */
    public static int[] snap(int x, int y, int w, int h, int sw, int sh, int th, List<int[]> others) {
        List<Integer> xs = new ArrayList<>(List.of(0, sw / 2, sw)), ys = new ArrayList<>(List.of(0, sh / 2, sh));
        for (int[] o : others) { xs.addAll(List.of(o[0], o[0] + o[2] / 2, o[0] + o[2])); ys.addAll(List.of(o[1], o[1] + o[3] / 2, o[1] + o[3])); }
        int nx = snap1(x, w, th, xs.stream().mapToInt(i -> i).toArray()), ny = snap1(y, h, th, ys.stream().mapToInt(i -> i).toArray());
        return clamp(nx, ny, w, h, sw, sh);
    }
}
