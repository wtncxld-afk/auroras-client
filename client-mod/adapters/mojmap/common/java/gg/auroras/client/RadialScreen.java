package gg.auroras.client;

// ADAPTER mojmap — UNCOMPILED. The Auroras menu (Right Shift): five glass sections around your face and name.
// Layout, outlines, hit testing and every animation are core RadialMenu (tested in RadialTests); the art is baked once per
// window size (RadialArt) and drawn 1:1 at the screen's real pixel size, with text in the Auroras font, so nothing is
// blurry or jagged at any GUI scale. The Auroras logo and name stay in the corner the whole time the menu is open.
//
// Mouse: point to highlight, click a section. Keyboard: arrows or Tab move round the ring, Enter opens, 1 to 5 jump,
// Esc or the menu key closes. Clicking your face opens the full module list.
//
// Your head in the middle is a real 3D cube (core Head3D: your skin's head and hat, every side) that turns to follow the
// mouse with a smooth spring, ray-traced at the screen's real pixel size and only re-drawn while it moves.

import gg.auroras.client.platform.Mc;
import com.mojang.blaze3d.platform.NativeImage;
import gg.auroras.client.platform.AScreen;
import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Keys;
import gg.auroras.client.platform.Platform;
import gg.auroras.client.ui.AuroraFont;
import gg.auroras.core.Config;
import gg.auroras.core.Head3D;
import gg.auroras.core.RadialMenu;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public class RadialScreen extends AScreen {
    private RadialArt art; private RadialMenu m; private double gs = 2; private long last = System.nanoTime();
    private int hovered = -1, pressedOn = -1; private boolean keyboard; private Runnable after;
    private final Head3D.Follow look = new Head3D.Follow(); private double hubHover;
    public RadialScreen() { super("Auroras"); }

    @Override protected void init() {
        gs = Gfx.guiScale(); int w = Gfx.screenW(), h = Gfx.screenH();
        RadialArt a = RadialArt.get(w, h, gs);
        if (m == null || art != a) { art = a; RadialMenu fresh = new RadialMenu(w, h); if (m != null) { fresh.phase = m.phase; fresh.t = m.t; } m = fresh; }
        Face.refresh(); Head.refresh();
    }
    private boolean reduced() { return AurorasModules.reducedMotion(); }

    @Override protected void draw(Gfx g, int mx, int my, float delta) {
        if (m == null) return;
        long now = System.nanoTime(); double dt = Math.min(0.1, (now - last) / 1e9); last = now;
        dt = dt * AurorasModules.menuSpeed();
        double px = mx * gs, py = my * gs;
        if (!keyboard) hovered = m.hit(px, py);
        m.update(dt, hovered, reduced());
        double hx = m.cx, hy = m.cy - m.hubR * 0.34;
        double[] aim = keyboard ? new double[]{hovered < 0 ? 0 : Math.cos(m.angle(hovered)) * Head3D.MAX_YAW * 0.8, hovered < 0 ? 0 : Math.sin(m.angle(hovered)) * Head3D.MAX_PITCH * 0.8}
                : Head3D.Follow.target(px - hx, py - hy, Math.max(120, art.h * 0.32));
        look.update(dt, aim[0], aim[1], reduced());
        double hubTarget = !keyboard && hovered < 0 && m.onHub(px, py) ? 1 : 0;
        hubHover += (hubTarget - hubHover) * (reduced() ? 1 : 1 - Math.exp(-dt * 16));
        if (m.done()) { Runnable r = after; after = null; if (r != null) r.run(); else Mc.setScreen(minecraft, null); return; }

        g.push(); g.scale((float) (1 / gs)); // from here on: real screen pixels
        double open = m.hubProgress();
        g.fill(0, 0, art.w, art.h, (int) Math.round(0.40 * 255 * open) << 24 | 0x05070C);
        int side = m.side();
        for (int k = 0; k < RadialMenu.N; k++) {
            float s = m.scale(k), al = m.alpha(k), hv = (float) m.hover[k]; if (al <= 0.003f) continue;
            int size = Math.round(side * s), x = Math.round(m.px(k) - size / 2f), y = Math.round(m.py(k) - size / 2f);
            if (hv < 0.999f) g.texture(RadialArt.petal(k, false), x, y, size, size, argb(al * (1 - hv)));
            if (hv > 0.001f) g.texture(RadialArt.petal(k, true), x, y, size, size, argb(al * hv));
            double labelPx = Math.max(7, 9 * gs * s); String label = RadialMenu.PETALS.get(k).label();
            AuroraFont.drawCentred(g, "semibold", labelPx, label, m.px(k), m.py(k) + m.petalR * 0.40 * s + AuroraFont.ascent("semibold", labelPx) * 0.5, argb(al * (0.92f + 0.08f * hv)), true);
        }
        drawHub(g, (float) open);
        drawBrand(g);
        String hint = keyboard ? "Arrows to move · Enter to open · Esc to close" : "Click a section · click your face for every module · Esc to close";
        AuroraFont.drawCentred(g, "medium", 7 * gs, hint, art.w / 2.0, art.h - 10 * gs, argb(0.62f * (float) open), true);
        g.pop();
    }
    private void drawHub(Gfx g, float open) {
        int hs = m.hubSide(); float s = 0.9f + 0.1f * open; int size = Math.round(hs * s), x = Math.round(m.cx - size / 2f), y = Math.round(m.cy - size / 2f);
        g.texture(RadialArt.HUB, x, y, size, size, argb(open));
        float r = m.hubR * s; String name = Face.name();
        if (Head.ready()) {
            // the head image is ~1.1 hub radii wide (the cube fills about 60% of it, leaving room to turn); drawn 1:1
            float lift = (float) (1 + 0.05 * hubHover); int hsz = Math.round(r * 1.1f * lift / 2) * 2;
            Head.draw(Math.min(Head.MAX, hsz), look.yaw, look.pitch);
            int hx = Math.round(m.cx - hsz / 2f), hy = Math.round(m.cy - r * 0.34f - hsz / 2f);
            g.texture(Head.ID, hx, hy, hsz, hsz, argb(open));
        } else {
            int fs = Math.round(r * 0.62f) / 8 * 8; if (fs < 8) fs = 8; // whole multiples of 8 keep the face pixels square
            int fx = Math.round(m.cx - fs / 2f), fy = Math.round(m.cy - r * 0.66f);
            if (Face.ready()) g.texture(Face.ID, fx, fy, fs, fs, argb(open));
            else { g.fill(fx, fy, fx + fs, fy + fs, argb(open * 0.9f, 0x2A6FA8)); AuroraFont.drawCentred(g, "semibold", fs * 0.6, name.isEmpty() ? "?" : name.substring(0, 1).toUpperCase(), m.cx, fy + fs * 0.72, argb(open), false); }
        }
        double np = Math.max(7, 9 * gs * s); String shown = AuroraFont.fit("semibold", np, name, r * 1.6);
        AuroraFont.drawCentred(g, "semibold", np, shown, m.cx, m.cy + r * 0.30, argb(open), true);
        int pw = Math.round(art.pillW * s), ph = Math.round(art.pillH * s), bx = Math.round(m.cx - pw / 2f), by = Math.round(m.cy + r * 0.44f);
        g.texture(RadialArt.PILL, bx, by, pw, ph, argb(open));
        double bp = Math.max(6, 7 * gs * s); AuroraFont.drawCentred(g, "semibold", bp, RadialArt.BADGE, m.cx, by + ph / 2.0 + AuroraFont.ascent("semibold", bp) * 0.5 - 0.5, argb(open, 0x06141F), false);
    }
    /** The Auroras logo and name, top left, always visible while the menu is open. */
    private void drawBrand(Gfx g) {
        int ls = (int) Math.round(18 * gs), x = (int) Math.round(10 * gs), y = (int) Math.round(10 * gs);
        g.texture(HudRenderer.LOGO, x, y, ls, ls, 0xFFFFFFFF);
        double tp = 11 * gs; AuroraFont.draw(g, "semibold", tp, "Auroras Client", x + ls + 6 * gs, y + ls / 2.0 + AuroraFont.ascent("semibold", tp) * 0.5 - gs, 0xFFFFFFFF, true);
    }
    static int argb(float a) { return argb(a, 0xFFFFFF); }
    static int argb(float a, int rgb) { return (int) Math.round(Math.max(0, Math.min(1, a)) * 255) << 24 | (rgb & 0xFFFFFF); }

    // ---- choosing ----
    private void choose(int k) {
        if (k < 0) return; RadialMenu.Petal p = RadialMenu.PETALS.get(k); m.close(k);
        after = () -> {
            switch (p.id()) {
                case "hud" -> Mc.setScreen(minecraft, new HudEditorScreen(new RadialScreen()));
                case "settings" -> Mc.setScreen(minecraft, ModuleScreen.settings(new RadialScreen()));
                default -> Mc.setScreen(minecraft, ModuleScreen.section(p.label(), p.categories(), new RadialScreen()));
            }
        };
    }
    @Override protected boolean click(double x, double y, int button) {
        keyboard = false; double px = x * gs, py = y * gs; int k = m.hit(px, py);
        if (button == 0 && k >= 0) { pressedOn = k; m.press(k); return true; }
        if (button == 0 && m.onHub(px, py)) { m.close(-1); after = () -> Mc.setScreen(minecraft, ModuleScreen.section("All modules", null, new RadialScreen())); return true; }
        return true;
    }
    @Override protected boolean release(double x, double y, int button) {
        int k = m.hit(x * gs, y * gs); m.release();
        if (button == 0 && pressedOn >= 0 && k == pressedOn) choose(k);
        pressedOn = -1; return true;
    }
    @Override protected boolean key(int key) {
        if (key == Keys.ESCAPE || key == Integer.parseInt(AurorasClient.PM.get(Config.Registry.GUI_KEY))) { m.close(-1); return true; }
        if (key == Keys.RIGHT || key == Keys.DOWN || (key == Keys.TAB && !shift())) { keyboard = true; hovered = m.step(hovered, 1); return true; }
        if (key == Keys.LEFT || key == Keys.UP || key == Keys.TAB) { keyboard = true; hovered = m.step(hovered, -1); return true; }
        if ((key == Keys.ENTER || key == Keys.SPACE) && hovered >= 0) { choose(hovered); return true; }
        if (key >= 49 && key <= 53) { choose(key - 49); return true; } // 1..5
        return false;
    }
    @Override protected boolean drag(double x, double y, int button, double dx, double dy) { keyboard = false; return true; }

    /** Your 3D head: the launcher writes your skin's top 64x16 (head and hat) to config/auroras/head.png. */
    static final class Head {
        static final Identifier ID = Identifier.fromNamespaceAndPath("auroras_client", "radial/head3d");
        static final int MAX = 320; // biggest render (4K); larger windows scale it up a little
        private static final Platform.Live TEX = new Platform.Live(ID);
        private static Head3D head; private static long stamp = -1; private static double yaw = 1e9, pitch = 1e9; private static int size;
        static boolean ready() { return head != null; }
        static void refresh() {
            Path f = AurorasClient.DIR.resolve("head.png"); long s;
            try { s = Files.exists(f) ? Files.getLastModifiedTime(f).toMillis() : 0; } catch (Exception e) { s = 0; }
            if (s == stamp) return; stamp = s; head = null; size = 0; if (s == 0) return;
            try (InputStream in = Files.newInputStream(f)) {
                NativeImage img = NativeImage.read(in);
                if (img.getWidth() != Head3D.SKIN_W || img.getHeight() != Head3D.SKIN_H) throw new IllegalStateException("head.png must be 64x16");
                int[] px = new int[Head3D.SKIN_W * Head3D.SKIN_H]; for (int y = 0; y < Head3D.SKIN_H; y++) for (int x = 0; x < Head3D.SKIN_W; x++) px[y * Head3D.SKIN_W + x] = img.getPixel(x, y);
                img.close(); head = new Head3D(px);
            } catch (Exception e) { System.out.println("[Auroras] 3D head not shown, using the flat face: " + e.getMessage()); }
        }
        /** Re-renders only when the angle or size really changed (a still head costs nothing). */
        static void draw(int sz, double y, double p) {
            if (sz == size && Math.abs(y - yaw) < 0.03 && Math.abs(p - pitch) < 0.03) return;
            size = sz; yaw = y; pitch = p; TEX.set(head.render(sz, y, p), sz, sz);
        }
    }

    /** Your face (from the launcher's config/auroras/face.png, the skin of the account you play with) and name. */
    static final class Face {
        static final Identifier ID = Identifier.fromNamespaceAndPath("auroras_client", "radial/face");
        private static long stamp = -1; private static boolean ready;
        static boolean ready() { return ready; }
        static String name() { Minecraft mc = Minecraft.getInstance(); return mc.player != null ? mc.player.getName().getString() : mc.getUser().getName(); }
        static void refresh() {
            try { gg.auroras.client.ui.Glass.player = name(); } catch (Exception ignored) {}
            Path f = AurorasClient.DIR.resolve("face.png"); long s;
            try { s = Files.exists(f) ? Files.getLastModifiedTime(f).toMillis() : 0; } catch (Exception e) { s = 0; }
            if (s == stamp) return; stamp = s; ready = false; if (s == 0) return;
            try (InputStream in = Files.newInputStream(f)) { NativeImage img = NativeImage.read(in); if (img.getWidth() != 8 || img.getHeight() != 8) throw new IllegalStateException("face.png must be 8x8"); Platform.texture(ID, img); ready = true; gg.auroras.client.ui.Glass.face = ID; }
            catch (Exception e) { System.out.println("[Auroras] face not shown: " + e.getMessage()); }
        }
    }
}
