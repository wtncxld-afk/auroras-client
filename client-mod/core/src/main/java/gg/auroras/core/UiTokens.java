package gg.auroras.core;

import java.util.*;

/**
 * Auroras design tokens for the in-game GUI, read from the same visuals/design-tokens.json the launcher's CSS is generated
 * from (bundled into the mod at build time). Colors are 0xRRGGBB; use argb() to add opacity.
 */
public final class UiTokens {
    public final Map<String, Integer> color, space, radius, font, size; public final int fast, base, slow;
    public final double[] ease; public final double panelAlpha, scrimAlpha, selectedAlpha; public final int guide;
    private UiTokens(Map<String, Integer> color, Map<String, Integer> space, Map<String, Integer> radius, Map<String, Integer> font, Map<String, Integer> size,
                     int fast, int base, int slow, double[] ease, double panelAlpha, double scrimAlpha, double selectedAlpha, int guide) {
        this.color = color; this.space = space; this.radius = radius; this.font = font; this.size = size; this.fast = fast; this.base = base; this.slow = slow;
        this.ease = ease; this.panelAlpha = panelAlpha; this.scrimAlpha = scrimAlpha; this.selectedAlpha = selectedAlpha; this.guide = guide;
    }
    static final List<String> REQUIRED = List.of("bg", "side", "s1", "s2", "s3", "line", "lineStrong", "text", "mute", "faint", "acc", "accInk", "vio", "ok", "warn", "err");

    public static UiTokens parse(String json) {
        Map<String, Object> r = Json.obj(Json.parse(json), "design tokens");
        if (Json.num(r, "schema") != 1) throw new IllegalArgumentException("Unsupported design tokens schema");
        Map<String, Integer> color = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : Json.obj(r.get("color"), "color").entrySet()) color.put(e.getKey(), Sky.hex((String) e.getValue()));
        for (String k : REQUIRED) if (!color.containsKey(k)) throw new IllegalArgumentException("design tokens: color." + k + " is missing");
        Map<String, Object> m = Json.obj(r.get("motion"), "motion"), g = Json.obj(r.get("game"), "game");
        List<Object> e = Json.arr(m.get("ease"), "motion.ease"); if (e.size() != 4) throw new IllegalArgumentException("motion.ease needs 4 numbers");
        double[] ease = new double[4]; for (int k = 0; k < 4; k++) ease[k] = (Double) e.get(k);
        return new UiTokens(color, ints(r, "space"), ints(r, "radius"), ints(r, "font"), ints(r, "size"), (int) Json.num(m, "fast"), (int) Json.num(m, "base"), (int) Json.num(m, "slow"),
            ease, unit(g, "panelAlpha"), unit(g, "scrimAlpha"), unit(g, "selectedAlpha"), Sky.hex(Json.str(g, "guide")));
    }
    static Map<String, Integer> ints(Map<String, Object> r, String k) { Map<String, Integer> o = new LinkedHashMap<>(); for (Map.Entry<String, Object> e : Json.obj(r.get(k), k).entrySet()) o.put(e.getKey(), (int) Math.round((Double) e.getValue())); return o; }
    static double unit(Map<String, Object> g, String k) { double v = Json.num(g, k); if (v < 0 || v > 1) throw new IllegalArgumentException("game." + k + " must be 0..1"); return v; }

    /**
     * These tokens recoloured for a menu theme: its accents, and the surfaces leaned toward its tint (by up to 35%, so
     * text contrast barely moves; UiTests checks it stays at AA or better for every theme).
     */
    public UiTokens themed(MenuTheme.Theme t) {
        Map<String, Integer> c = new LinkedHashMap<>(color); c.put("acc", t.acc()); c.put("acc2", t.acc2());
        double[] k = {0.2, 0.32, 0.3, 0.26, 0.22}; String[] s = {"bg", "side", "s1", "s2", "s3"};
        for (int i = 0; i < s.length; i++) c.put(s[i], mixRgb(color.get(s[i]), t.tint(), k[i]));
        return new UiTokens(c, space, radius, font, size, fast, base, slow, ease, panelAlpha, scrimAlpha, selectedAlpha, guide);
    }
    static int mixRgb(int a, int b, double t) {
        int r = (int) Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t), g = (int) Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t), bl = (int) Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
        return r << 16 | g << 8 | bl;
    }
    public int c(String name) { Integer v = color.get(name); if (v == null) throw new IllegalArgumentException("No color token " + name); return v; }
    /** Color token with opacity 0..1 as 0xAARRGGBB. */
    public int argb(String name, double alpha) { return ((int) Math.round(Sky.clamp(alpha, 0, 1) * 255) << 24) | c(name); }
    public int opaque(String name) { return 0xFF000000 | c(name); }
    /** The CSS cubic-bezier(x1,y1,x2,y2) easing from the tokens, evaluated at t (0..1) by bisection on x. */
    public double easeAt(double t) { return bezier(ease, Sky.clamp(t, 0, 1)); }
    static double bezier(double[] p, double x) {
        double lo = 0, hi = 1, u = x;
        for (int k = 0; k < 30; k++) { u = (lo + hi) / 2; double bx = cub(p[0], p[2], u); if (bx < x) lo = u; else hi = u; }
        return cub(p[1], p[3], u);
    }
    static double cub(double a, double b, double u) { double v = 1 - u; return 3 * v * v * u * a + 3 * v * u * u * b + u * u * u; }
}
