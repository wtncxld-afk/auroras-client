package gg.auroras.core;

import java.util.*;

/**
 * Text in the Auroras font (Inter, baked by scripts/bake-font.py into visuals/font). Picks the baked pixel size for a
 * request, measures, cuts with an ellipsis and lays glyphs out as atlas quads on whole pixels, so the adapter only
 * draws rectangles from one texture. Unit-tested in RadialTests.
 */
public final class TextKit {
    public record Glyph(int x, int y, int w, int h, int ox, int oy, float adv) {}
    public record Face(String weight, int size, int ascent, int lineHeight, Map<Integer, Glyph> glyphs) {}
    /** Receives one glyph: screen rectangle (x, y, w, h) and its place in the atlas (u, v, uw x vh). */
    public interface Sink { void glyph(int x, int y, int w, int h, int u, int v, int uw, int vh); }

    public final int atlasW, atlasH; private final Map<String, TreeMap<Integer, Face>> faces = new HashMap<>();
    public TextKit(String json) {
        Map<String, Object> root = Json.obj(Json.parse(json), "font"), atlas = Json.obj(root.get("atlas"), "atlas");
        atlasW = (int) Json.num(atlas, "w"); atlasH = (int) Json.num(atlas, "h");
        for (Map.Entry<String, Object> we : Json.obj(root.get("weights"), "weights").entrySet()) {
            TreeMap<Integer, Face> bySize = new TreeMap<>();
            for (Map.Entry<String, Object> se : Json.obj(we.getValue(), "size").entrySet()) {
                Map<String, Object> f = Json.obj(se.getValue(), "face"); Map<Integer, Glyph> gl = new HashMap<>();
                for (Map.Entry<String, Object> ge : Json.obj(f.get("glyphs"), "glyphs").entrySet()) {
                    List<Object> a = Json.arr(ge.getValue(), "glyph"); gl.put(Integer.parseInt(ge.getKey()), new Glyph(i(a, 0), i(a, 1), i(a, 2), i(a, 3), i(a, 4), i(a, 5), (float) (double) (Double) a.get(6)));
                }
                int size = Integer.parseInt(se.getKey()); bySize.put(size, new Face(we.getKey(), size, (int) Json.num(f, "ascent"), (int) Json.num(f, "lineHeight"), Map.copyOf(gl)));
            }
            faces.put(we.getKey(), bySize);
        }
    }
    static int i(List<Object> a, int k) { return (int) (double) (Double) a.get(k); }

    /** The baked face for a pixel size: exact if baked, otherwise the next larger (drawn slightly smaller), else the largest. */
    public Face face(String weight, double px) {
        TreeMap<Integer, Face> m = faces.get(weight); if (m == null) throw new IllegalArgumentException("No font weight " + weight);
        Map.Entry<Integer, Face> e = m.ceilingEntry((int) Math.round(px)); return e != null ? e.getValue() : m.lastEntry().getValue();
    }
    /** Scale that turns a face into the requested pixel size (1 when the size was baked). */
    public static double scaleFor(Face f, double px) { return Math.min(1, px / f.size()); }
    Glyph glyph(Face f, int cp) { Glyph g = f.glyphs().get(cp); return g != null ? g : f.glyphs().get((int) '?'); }

    public double width(Face f, String s, double scale) { double w = 0; for (int k = 0; k < s.length(); k++) w += glyph(f, s.charAt(k)).adv(); return w * scale; }
    /** Text cut to fit maxW with an ellipsis. */
    public String fit(Face f, String s, double scale, double maxW) {
        if (width(f, s, scale) <= maxW) return s; String dots = "…"; int n = s.length();
        while (n > 0 && width(f, s.substring(0, n).stripTrailing() + dots, scale) > maxW) n--;
        return n == 0 ? "" : s.substring(0, n).stripTrailing() + dots;
    }
    /** Lays out s with its baseline at y, starting at x. Glyphs land on whole pixels so they stay sharp. Returns the width. */
    public double draw(Face f, String s, double x, double baseline, double scale, Sink sink) {
        double pen = x;
        for (int k = 0; k < s.length(); k++) {
            Glyph g = glyph(f, s.charAt(k));
            if (g.w() > 0) sink.glyph((int) Math.round(pen + g.ox() * scale), (int) Math.round(baseline + g.oy() * scale), (int) Math.round(g.w() * scale), (int) Math.round(g.h() * scale), g.x(), g.y(), g.w(), g.h());
            pen += g.adv() * scale;
        }
        return pen - x;
    }
}
