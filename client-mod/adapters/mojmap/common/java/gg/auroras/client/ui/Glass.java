package gg.auroras.client.ui;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Smooth drawing for the Auroras menus: rounded rectangles,
// circles, soft shadows, gradients, icons and Inter text, all drawn at the screen's real pixel size so edges are
// anti-aliased and text is sharp at any GUI scale. Callers work in GUI units (doubles, so animations never step); every
// call converts to screen pixels itself. The shapes are small white textures baked by core UiArt (tested there), made
// on first use for each size and tinted when drawn.

import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Platform;
import gg.auroras.core.UiArt;
import net.minecraft.resources.Identifier;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public final class Glass {
    private Glass() {}
    private static final Map<String, Identifier> TEX = new HashMap<>();
    /** The player's 8x8 face texture and name, when the radial menu has loaded them (shown in the menu's profile card). */
    public static Identifier face; public static String player = "Player";

    static double gs() { return Gfx.guiScale(); }
    static int px(double v) { return (int) Math.round(v * gs()); }

    /** A rounded rectangle filled with argb. r is the corner radius in GUI units (clamped to fit). */
    public static void rect(Gfx c, double x, double y, double w, double h, double r, int argb) {
        if (w <= 0 || h <= 0 || (argb >>> 24) == 0) return;
        int X = px(x), Y = px(y), W = px(x + w) - X, H = px(y + h) - Y, R = Math.min(px(r), Math.min(W, H) / 2);
        c.push(); c.scale((float) (1 / gs()));
        if (R <= 0) c.fill(X, Y, X + W, Y + H, argb); else nine(c, tex("disk", R, 0, () -> UiArt.disk(R), 2 * R, 2 * R), R, 2 * R, X, Y, W, H, argb, true);
        c.pop();
    }
    /** A rounded outline, about half a GUI pixel wide (at least one screen pixel). */
    public static void outline(Gfx c, double x, double y, double w, double h, double r, int argb) {
        if (w <= 0 || h <= 0 || (argb >>> 24) == 0) return;
        int X = px(x), Y = px(y), W = px(x + w) - X, H = px(y + h) - Y, R = Math.max(2, Math.min(px(r), Math.min(W, H) / 2)); double st = Math.max(1, Math.round(gs() * 0.5));
        c.push(); c.scale((float) (1 / gs()));
        nine(c, tex("ring" + (int) st, R, 0, () -> UiArt.ring(R, st), 2 * R, 2 * R), R, 2 * R, X, Y, W, H, argb, false);
        c.pop();
    }
    /** A soft shadow under a rounded rectangle, spreading blur GUI units out from its edge. */
    public static void shadow(Gfx c, double x, double y, double w, double h, double r, double blur, int argb) {
        if (w <= 0 || h <= 0 || (argb >>> 24) == 0) return;
        int X = px(x), Y = px(y), W = px(x + w) - X, H = px(y + h) - Y, R = Math.min(px(r), Math.min(W, H) / 2), B = Math.max(2, px(blur)), K = R + B;
        c.push(); c.scale((float) (1 / gs()));
        nine(c, tex("shadow", R, B, () -> UiArt.shadow(R, B), 2 * K, 2 * K), K, 2 * K, X - B, Y - B, W + 2 * B, H + 2 * B, argb, true);
        c.pop();
    }
    /** A circle of radius r (GUI units) centred on (cx, cy). */
    public static void circle(Gfx c, double cx, double cy, double r, int argb) { rect(c, cx - r, cy - r, 2 * r, 2 * r, r, argb); }
    /** A vertical gradient from top to bottom colour (square corners; draw it inside a rounded shape's straight part). */
    public static void vgrad(Gfx c, double x, double y, double w, double h, int top, int bottom) {
        if (w <= 0 || h <= 0) return; int X = px(x), Y = px(y), W = px(x + w) - X, H = px(y + h) - Y;
        c.push(); c.scale((float) (1 / gs()));
        if ((bottom >>> 24) != 0) c.fill(X, Y, X + W, Y + H, bottom);
        // the top colour fades out downward over the bottom one (a 64-step ramp, finer than the eye sees on a panel)
        c.region(tex("ramp", 64, 0, () -> UiArt.ramp(64), 1, 64), X, Y, W, H, 0, 0, 1, 64, 1, 64, top);
        c.pop();
    }
    /** One of the menu icons (visuals/icons, drawn by scripts/draw-icons.py), size GUI units square, tinted argb. */
    public static void icon(Gfx c, String name, double x, double y, double size, int argb) {
        int S = Math.max(4, px(size)), X = px(x), Y = px(y);
        Identifier id = tex("icon_" + name, S, 0, () -> UiArt.icon(mask(name), 128, 128, S), S, S);
        c.push(); c.scale((float) (1 / gs())); c.texture(id, X, Y, S, S, argb); c.pop();
    }
    /** A sakura petal (core UiArt.petal) size GUI units long, centred on (cx, cy), turned rot radians, tinted argb. */
    public static void petal(Gfx c, double cx, double cy, double size, double rot, int argb) {
        int S = Math.max(4, px(size)); Identifier id = tex("petal", S, 0, () -> UiArt.petal(S), S, S);
        c.push(); c.scale((float) (1 / gs())); c.translate((float) (cx * gs()), (float) (cy * gs())); c.rotate((float) rot); c.texture(id, -S / 2, -S / 2, S, S, argb); c.pop();
    }
    /** Text in the Auroras font: size in GUI units, x at its left, baseline at y. */
    public static void text(Gfx c, String weight, double size, String s, double x, double baseline, int argb) {
        double g = gs(); c.push(); c.scale((float) (1 / g)); AuroraFont.draw(c, weight, size * g, s, Math.round(x * g), Math.round(baseline * g), argb, false); c.pop();
    }
    /** Text vertically centred on cy (by its capital height), cut with an ellipsis to maxW GUI units. */
    public static void label(Gfx c, String weight, double size, String s, double x, double cy, double maxW, int argb) {
        text(c, weight, size, fit(weight, size, s, maxW), x, cy + size * 0.36, argb);
    }
    public static void labelCentred(Gfx c, String weight, double size, String s, double cx, double cy, int argb) { text(c, weight, size, s, cx - width(weight, size, s) / 2, cy + size * 0.36, argb); }
    public static void labelRight(Gfx c, String weight, double size, String s, double right, double cy, int argb) { text(c, weight, size, s, right - width(weight, size, s), cy + size * 0.36, argb); }
    public static double width(String weight, double size, String s) { return AuroraFont.width(weight, size * gs(), s) / gs(); }
    public static String fit(String weight, double size, String s, double maxW) { return maxW <= 0 ? s : AuroraFont.fit(weight, size * gs(), s, maxW * gs()); }

    /** Nine-slice: corners from the texture's quarters, edges stretched from its middle row and column, centre filled. */
    private static void nine(Gfx c, Identifier id, int K, int S, int X, int Y, int W, int H, int argb, boolean centre) {
        int k = Math.min(K, Math.min(W, H) / 2); if (k <= 0) { if (centre) c.fill(X, Y, X + W, Y + H, argb); return; }
        int u2 = S - k; // far quarter starts here (k < K only when a shape is smaller than its texture's corner)
        c.region(id, X, Y, k, k, 0, 0, k, k, S, S, argb); c.region(id, X + W - k, Y, k, k, u2, 0, k, k, S, S, argb);
        c.region(id, X, Y + H - k, k, k, 0, u2, k, k, S, S, argb); c.region(id, X + W - k, Y + H - k, k, k, u2, u2, k, k, S, S, argb);
        if (W > 2 * k) { c.region(id, X + k, Y, W - 2 * k, k, K, 0, 1, k, S, S, argb); c.region(id, X + k, Y + H - k, W - 2 * k, k, K, u2, 1, k, S, S, argb); }
        if (H > 2 * k) { c.region(id, X, Y + k, k, H - 2 * k, 0, K, k, 1, S, S, argb); c.region(id, X + W - k, Y + k, k, H - 2 * k, u2, K, k, 1, S, S, argb); }
        if (centre && W > 2 * k && H > 2 * k) c.fill(X + k, Y + k, X + W - k, Y + H - k, argb);
    }
    /** The texture for one shape and size, baked and uploaded the first time it's needed (render thread). */
    private static Identifier tex(String kind, int a, int b, java.util.function.Supplier<int[]> art, int w, int h) {
        String key = kind + "_" + a + "_" + b; Identifier id = TEX.get(key);
        if (id == null) { id = Identifier.fromNamespaceAndPath("auroras_client", "ui/" + key.toLowerCase(java.util.Locale.ROOT)); Platform.texture(id, art.get(), w, h); TEX.put(key, id); }
        return id;
    }
    private static final Map<String, float[]> MASKS = new HashMap<>();
    /** 128x128 alpha mask from the bundled .a8 file (raw bytes); empty if missing. */
    static float[] mask(String name) {
        return MASKS.computeIfAbsent(name, n -> {
            try (InputStream in = Glass.class.getResourceAsStream("/assets/auroras_client/icons/" + n + ".a8")) {
                byte[] bt = in.readAllBytes(); float[] m = new float[128 * 128]; for (int i = 0; i < m.length && i < bt.length; i++) m[i] = (bt[i] & 255) / 255f; return m;
            } catch (Exception e) { return new float[128 * 128]; }
        });
    }
}
