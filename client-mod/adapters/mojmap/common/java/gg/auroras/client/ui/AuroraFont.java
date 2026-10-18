package gg.auroras.client.ui;

// ADAPTER mojmap — UNCOMPILED. The Auroras font in game: Inter (SIL Open Font License), baked by scripts/bake-font.py into
// one glyph atlas. Text is drawn 1:1 at the screen's real pixel size (callers scale the GUI transform by 1/guiScale), so
// it is as smooth as the launcher's. Layout, sizes and ellipsis are core TextKit (tested); this only draws glyph quads.

import gg.auroras.client.platform.Gfx;
import gg.auroras.core.TextKit;
import net.minecraft.resources.Identifier;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public final class AuroraFont {
    private AuroraFont() {}
    public static final Identifier ATLAS = Identifier.fromNamespaceAndPath("auroras_client", "textures/font/auroras-font.png");
    private static TextKit kit; private static boolean failed;
    /** The font metrics, loaded once; null if the bundled file is missing (callers then use Minecraft's font). */
    public static TextKit kit() {
        if (kit != null || failed) return kit;
        try (InputStream in = AuroraFont.class.getResourceAsStream("/assets/auroras_client/textures/font/auroras-font.json")) { kit = new TextKit(new String(in.readAllBytes(), StandardCharsets.UTF_8)); }
        catch (Exception e) { failed = true; System.out.println("[Auroras] font not loaded, using Minecraft's: " + e.getMessage()); }
        return kit;
    }
    public static double width(String weight, double px, String s) {
        TextKit k = kit(); if (k == null) return Gfx.width(s) * px / 9.0;
        TextKit.Face f = k.face(weight, px); return k.width(f, s, TextKit.scaleFor(f, px));
    }
    public static String fit(String weight, double px, String s, double maxW) { TextKit k = kit(); if (k == null) return s; TextKit.Face f = k.face(weight, px); return k.fit(f, s, TextKit.scaleFor(f, px), maxW); }
    /** Ascent in pixels, to place text by its top or centre. */
    public static double ascent(String weight, double px) { TextKit k = kit(); if (k == null) return px * 0.8; TextKit.Face f = k.face(weight, px); return f.ascent() * TextKit.scaleFor(f, px); }
    /** Draws s with its baseline at y. shadow adds a soft dark copy one pixel down for legibility over the world. */
    public static void draw(Gfx g, String weight, double px, String s, double x, double baseline, int argb, boolean shadow) {
        TextKit k = kit();
        if (k == null) { g.text(s, (int) Math.round(x), (int) Math.round(baseline - px * 0.8), argb, shadow); return; }
        TextKit.Face f = k.face(weight, px); double sc = TextKit.scaleFor(f, px); int aw = k.atlasW, ah = k.atlasH;
        if (shadow) { int sa = (int) (((argb >>> 24) & 255) * 0.38) << 24; k.draw(f, s, x, baseline + Math.max(1, Math.round(px / 14.0)), sc, (gx, gy, w, h, u, v, uw, vh) -> g.region(ATLAS, gx, gy, w, h, u, v, uw, vh, aw, ah, sa)); }
        k.draw(f, s, x, baseline, sc, (gx, gy, w, h, u, v, uw, vh) -> g.region(ATLAS, gx, gy, w, h, u, v, uw, vh, aw, ah, argb));
    }
    public static void drawCentred(Gfx g, String weight, double px, String s, double cx, double baseline, int argb, boolean shadow) { draw(g, weight, px, s, cx - width(weight, px, s) / 2, baseline, argb, shadow); }
}
