package gg.auroras.client;

// ADAPTER mojmap — UNCOMPILED. The radial menu's artwork for the current window size: the glass petals (normal and
// hover), the hub and the badge, rasterized by core RadialMenu/Raster at the screen's real pixel size and uploaded as
// textures. Baking takes about 150 ms, so it runs on a background thread when you join a world and whenever the window
// size changes; opening the menu then costs nothing. Only the upload (once per size) happens on the render thread.

import com.mojang.blaze3d.platform.NativeImage;
import gg.auroras.client.platform.Platform;
import gg.auroras.client.ui.AuroraFont;
import gg.auroras.core.RadialMenu;
import net.minecraft.resources.Identifier;

import java.io.InputStream;
import java.util.concurrent.CompletableFuture;

final class RadialArt {
    final int w, h, accent; final RadialMenu layout; final int pillW, pillH; volatile boolean baked; boolean uploaded;
    private NativeImage[] rest = new NativeImage[RadialMenu.N], hover = new NativeImage[RadialMenu.N]; private NativeImage hub, pill;
    static final String BADGE = "AURORAS";
    private RadialArt(int w, int h, double gs, int accent) {
        this.w = w; this.h = h; this.accent = accent; layout = new RadialMenu(w, h); layout.accent = accent;
        pillH = (int) Math.round(11 * gs); pillW = (int) Math.ceil(AuroraFont.width("semibold", 7 * gs, BADGE)) + (int) Math.round(14 * gs);
    }
    static Identifier petal(int k, boolean hv) { return Identifier.fromNamespaceAndPath("auroras_client", "radial/petal_" + k + (hv ? "_hover" : "")); }
    static final Identifier HUB = Identifier.fromNamespaceAndPath("auroras_client", "radial/hub"), PILL = Identifier.fromNamespaceAndPath("auroras_client", "radial/pill");

    private static RadialArt current; private static CompletableFuture<RadialArt> pending; private static int pendingW, pendingH, pendingAcc;
    /** Starts baking for this window size and menu theme in the background if it isn't baked or baking already. */
    static synchronized void prepare(int w, int h, double gs) {
        if (w <= 0 || h <= 0) return; int acc = gg.auroras.client.ui.AUi.theme().acc();
        if (current != null && current.w == w && current.h == h && current.accent == acc) return;
        if (pending != null && pendingW == w && pendingH == h && pendingAcc == acc) return;
        pendingW = w; pendingH = h; pendingAcc = acc; RadialArt a = new RadialArt(w, h, gs, acc);
        pending = CompletableFuture.supplyAsync(() -> { a.bake(); return a; });
    }
    /** The art for this size, uploading it if it's ready; bakes right now (one short pause) if nothing was prepared. */
    static synchronized RadialArt get(int w, int h, double gs) {
        if (current == null || current.w != w || current.h != h || current.accent != gg.auroras.client.ui.AUi.theme().acc()) {
            prepare(w, h, gs);
            RadialArt a = pending.join(); pending = null; current = a;
        }
        if (!current.uploaded) current.upload();
        return current;
    }
    private void bake() {
        RadialMenu m = layout;
        for (int k = 0; k < RadialMenu.N; k++) {
            float[] icon = icon(RadialMenu.PETALS.get(k).icon()); int s = m.side();
            rest[k] = Platform.image(m.bakePetal(k, false, icon, 128, 128), s, s); hover[k] = Platform.image(m.bakePetal(k, true, icon, 128, 128), s, s);
        }
        hub = Platform.image(m.bakeHub(), m.hubSide(), m.hubSide());
        pill = Platform.image(RadialMenu.bakePill(pillW, pillH, accent, 0.95f), pillW, pillH);
        baked = true;
    }
    private void upload() {
        for (int k = 0; k < RadialMenu.N; k++) { Platform.texture(petal(k, false), rest[k]); Platform.texture(petal(k, true), hover[k]); }
        Platform.texture(HUB, hub); Platform.texture(PILL, pill); uploaded = true;
        rest = hover = null; hub = pill = null; // the texture manager owns them now
    }
    /** 128x128 alpha mask from the bundled .a8 file (raw bytes, made by scripts/draw-icons.py). */
    static float[] icon(String name) {
        try (InputStream in = RadialArt.class.getResourceAsStream("/assets/auroras_client/icons/" + name + ".a8")) {
            byte[] b = in.readAllBytes(); float[] m = new float[128 * 128]; for (int i = 0; i < m.length && i < b.length; i++) m[i] = (b[i] & 255) / 255f; return m;
        } catch (Exception e) { return null; }
    }
}
