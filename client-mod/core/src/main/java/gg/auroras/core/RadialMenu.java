package gg.auroras.core;

import java.util.List;

/**
 * The radial Auroras menu (Right Shift): five glass petals around a hub with the player's face and name. Everything
 * about it that isn't drawing lives here and is unit-tested (RadialTests): layout for any screen size, the organic
 * petal outlines, the anti-aliased artwork baked into textures, hit testing by the real outline, and the open, hover,
 * press and close animations. All sizes are real screen pixels, so the adapter can draw the baked art 1:1.
 */
public final class RadialMenu {
    /** One section. categories = the module categories it opens; Settings opens the client settings page instead. */
    public record Petal(String id, String label, String icon, List<String> categories) {}
    /** Clockwise from the top. */
    public static final List<Petal> PETALS = List.of(
        new Petal("hud", "HUD", "hud", List.of("HUD & Overlays")),
        new Petal("visuals", "Visuals", "eye", List.of("Color & Rendering", "World & Sky", "Particles & Effects")),
        new Petal("design", "Design", "palette", List.of("Cosmetics", "Totems", "Player Visuals", "Animations")),
        new Petal("settings", "Settings", "sliders", List.of()),
        new Petal("utility", "Utility", "wrench", List.of("Player", "Information")));
    public static final int N = 5, OUTLINE = 112;

    // ---- layout (screen pixels) ----
    public final int w, h; public final float cx, cy, dist, petalR, hubR;
    public RadialMenu(int w, int h) {
        this.w = w; this.h = h; cx = w / 2f; cy = h / 2f;
        dist = Math.min(w * 0.5f, h) * 0.265f; petalR = dist * 0.6f; hubR = dist * 0.38f;
    }
    public double angle(int k) { return Math.toRadians(-90 + 72 * k); }

    /** The petal's outline radius at an angle (around its own centre): round, a little wider on the outside, gently uneven like the reference. */
    public Raster.Shape shape(int k, float scale) {
        double dir = angle(k), p2 = 1.3 + k * 2.1, p3 = 0.4 + k * 1.7, r = petalR * scale;
        return a -> r * (1 + 0.10 * Math.cos(a - dir) + 0.06 * Math.sin(2 * a + p2) + 0.045 * Math.sin(3 * a + p3));
    }
    static final float MAX_SHAPE = 1.0f + 0.10f + 0.06f + 0.045f;
    public static final float HOVER = 1.06f;
    /** Side of a petal texture (room for the hover size and the glow). */
    public int side() { return 2 * (int) Math.ceil(petalR * HOVER * MAX_SHAPE + glow() + 2); }
    public int hubSide() { return 2 * (int) Math.ceil(hubR + glow() + 2); }
    float glow() { return Math.max(4, petalR * 0.09f); }
    float stroke() { return Math.max(1.5f, petalR * 0.028f); }

    /**
     * Petal artwork as straight ARGB, side() x side(), centred: frosted fill, bright rim, soft outer glow and inner
     * light, and the icon (an alpha mask, mw x mh) in the middle. hover bakes the larger, brighter variant.
     */
    public int[] bakePetal(int k, boolean hover, float[] icon, int mw, int mh) {
        int s = side(); float c = s / 2f; Raster.Shape shape = shape(k, hover ? HOVER : 1f);
        float[] img = new float[s * s * 4];
        glass(img, s, c, c, shape, hover ? 1f : 0f);
        if (icon != null) { float is = petalR * 0.40f * (hover ? HOVER : 1f); Raster.overMask(img, s, s, icon, mw, mh, c - is / 2, c - is / 2 - petalR * 0.14f, is, 0xFFFFFF, 0.96f); }
        return Raster.toArgb(img);
    }
    public int[] bakeHub() { int s = hubSide(); float c = s / 2f, r = hubR; float[] img = new float[s * s * 4]; glass(img, s, c, c, a -> r, 0.35f); return Raster.toArgb(img); }
    /** A pill (rounded rectangle) for the name badge, w x h, straight ARGB. */
    public static int[] bakePill(int w, int h, int rgb, float alpha) {
        int n = 48; float[] xs = new float[n], ys = new float[n]; float r = h / 2f;
        for (int i = 0; i < n; i++) { double a = i * 2 * Math.PI / n; float ex = Math.cos(a) >= 0 ? w - r : r; xs[i] = (float) (ex + Math.cos(a) * r); ys[i] = (float) (r + Math.sin(a) * r); }
        float[] cov = new float[w * h]; Raster.cover(xs, ys, n, 0, 0, w, h, 1, cov); float[] img = new float[w * h * 4]; Raster.over(img, cov, rgb, alpha); return Raster.toArgb(img);
    }
    /** The glass look shared by petals and hub. lift 0..1 brightens it (hover). */
    void glass(float[] img, int s, float cx, float cy, Raster.Shape shape, float lift) {
        int n = OUTLINE; float[] xs = new float[n], ys = new float[n]; float g = glow(), t = stroke();
        float[] base = cov(s, cx, cy, shape, 0, xs, ys), inner = cov(s, cx, cy, shape, -t, xs, ys);
        float[] g1 = cov(s, cx, cy, shape, g * 0.3f, xs, ys), g2 = cov(s, cx, cy, shape, g * 0.6f, xs, ys), g3 = cov(s, cx, cy, shape, g, xs, ys), in2 = cov(s, cx, cy, shape, -t - g * 0.5f, xs, ys);
        Raster.over(img, minus(g3, g2), 0xFFFFFF, 0.05f + 0.04f * lift);
        Raster.over(img, minus(g2, g1), 0xFFFFFF, 0.12f + 0.08f * lift);
        Raster.over(img, minus(g1, base), 0xFFFFFF, 0.26f + 0.14f * lift);
        Raster.over(img, base, 0xE9F2FF, 0.24f + 0.10f * lift);
        Raster.over(img, minus(inner, in2), 0xFFFFFF, 0.14f + 0.06f * lift);
        Raster.over(img, minus(base, inner), 0xFFFFFF, 0.86f + 0.12f * lift);
    }
    static float[] cov(int s, float cx, float cy, Raster.Shape shape, float grow, float[] xs, float[] ys) {
        Raster.star(shape, cx, cy, grow, xs.length, xs, ys); float[] c = new float[s * s]; Raster.cover(xs, ys, xs.length, 0, 0, s, s, 1, c); return c;
    }
    static float[] minus(float[] a, float[] b) { float[] o = new float[a.length]; for (int i = 0; i < a.length; i++) o[i] = Math.max(0, a[i] - b[i]); return o; }

    // ---- animation ----
    public enum Phase { OPENING, OPEN, CLOSING, CLOSED }
    public Phase phase = Phase.OPENING; public double t; public int chosen = -1, focus = -1; private int pressed = -1;
    public final double[] hover = new double[N], press = new double[N];
    public static final double OPEN_S = 0.34, STAGGER_S = 0.035, CLOSE_S = 0.2, CLOSE_STAGGER_S = 0.018;

    /** Advances the animation. hovered = petal under the mouse (or keyboard focus), -1 for none. */
    public void update(double dt, int hovered, boolean reduced) {
        dt = Math.max(0, Math.min(dt, 0.1)); t += dt;
        if (reduced) { if (phase == Phase.OPENING) phase = Phase.OPEN; if (phase == Phase.CLOSING) phase = Phase.CLOSED; }
        if (phase == Phase.OPENING && t >= OPEN_S + STAGGER_S * (N - 1)) phase = Phase.OPEN;
        if (phase == Phase.CLOSING && t >= CLOSE_S + CLOSE_STAGGER_S * (N - 1)) phase = Phase.CLOSED;
        int hv = phase == Phase.CLOSING || phase == Phase.CLOSED ? -1 : hovered;
        for (int k = 0; k < N; k++) {
            hover[k] = reduced ? (k == hv ? 1 : 0) : UiKit.approach(hover[k], k == hv ? 1 : 0, dt, 0.06);
            press[k] = reduced ? (k == pressed ? 1 : 0) : UiKit.approach(press[k], k == pressed ? 1 : 0, dt, 0.035);
        }
    }
    public void press(int k) { pressed = k; }
    public void release() { pressed = -1; }
    /** Starts closing. choice = the petal that was picked (it stays and fades), or -1 to just close. */
    public void close(int choice) { if (phase == Phase.CLOSING || phase == Phase.CLOSED) return; chosen = choice; phase = Phase.CLOSING; t = 0; pressed = -1; }
    public boolean done() { return phase == Phase.CLOSED; }

    /** How far petal k is open, 0..1 (eased). */
    public double progress(int k) {
        return switch (phase) {
            case OPENING -> ease(clamp((t - STAGGER_S * k) / OPEN_S));
            case OPEN -> 1;
            case CLOSING -> 1 - ease(clamp((t - CLOSE_STAGGER_S * (N - 1 - k)) / CLOSE_S));
            case CLOSED -> 0;
        };
    }
    public double hubProgress() { return phase == Phase.CLOSING ? 1 - ease(clamp(t / (CLOSE_S + CLOSE_STAGGER_S * 2))) : phase == Phase.CLOSED ? 0 : ease(clamp(t / 0.26)); }
    /** Petal centre and scale now. The chosen petal stays in place while closing and grows a little as it fades. */
    public float px(int k) { return (float) (cx + Math.cos(angle(k)) * dist * travel(k)); }
    public float py(int k) { return (float) (cy + Math.sin(angle(k)) * dist * travel(k)); }
    double travel(int k) { return k == chosen && phase != Phase.OPENING ? 1 : 0.35 + 0.65 * progress(k); }
    public float scale(int k) {
        double base = k == chosen && phase == Phase.CLOSING ? 1 + 0.05 * ease(clamp(t / CLOSE_S)) : 0.82 + 0.18 * progress(k);
        return (float) (base * (1 - 0.035 * press[k]));
    }
    public float alpha(int k) { return (float) (k == chosen && phase == Phase.CLOSING ? 1 - ease(clamp(t / (CLOSE_S + 0.05))) : progress(k)); }

    /** Which petal (by its real outline at its current place and size) is at a screen point, or -1. */
    public int hit(double x, double y) {
        if (phase != Phase.OPEN && phase != Phase.OPENING) return -1;
        float[] xs = new float[64], ys = new float[64];
        for (int k = 0; k < N; k++) { if (alpha(k) < 0.5) continue; Raster.star(shape(k, scale(k) * (float) (1 + (HOVER - 1) * hover[k])), px(k), py(k), 0, 64, xs, ys); if (Raster.inside(xs, ys, 64, x, y)) return k; }
        return -1;
    }
    public boolean onHub(double x, double y) { double dx = x - cx, dy = y - cy; return dx * dx + dy * dy <= hubR * hubR; }
    /** Keyboard: next petal clockwise (dir 1) or counter-clockwise (-1). */
    public int step(int cur, int dir) { return cur < 0 ? (dir > 0 ? 0 : N - 1) : Math.floorMod(cur + dir, N); }

    static double clamp(double v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
    /** cubic-bezier(0.2, 0.8, 0.2, 1): quick start, long soft landing, no overshoot. */
    public static double ease(double x) {
        if (x <= 0) return 0; if (x >= 1) return 1;
        double lo = 0, hi = 1, u = x;
        for (int i = 0; i < 24; i++) { u = (lo + hi) / 2; double bx = bez(u, 0.2, 0.2); if (bx < x) lo = u; else hi = u; }
        return bez(u, 0.8, 1.0);
    }
    static double bez(double u, double p1, double p2) { double v = 1 - u; return 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u; }
}
