package gg.auroras.client;

// ADAPTER mojmap — Your name and head on the main menu and pause menu: the same files and code as the Right Shift menu
// (RadialScreen.Face / Head: config/auroras/face.png and head.png, written by the launcher for the account you play
// with). The 3D head turns toward the mouse; without head.png the flat 8x8 face is shown, without either your initial.

import gg.auroras.client.platform.Gfx;
import gg.auroras.core.Head3D;

public final class MenuProfile {
    private MenuProfile() {}
    private static final Head3D.Follow LOOK = new Head3D.Follow();
    public static void refresh() { try { RadialScreen.Face.refresh(); RadialScreen.Head.refresh(); } catch (Throwable t) { System.out.println("[Auroras] profile not shown: " + t.getMessage()); } }
    public static String name() { try { return RadialScreen.Face.name(); } catch (Throwable t) { return "Player"; } }
    /**
     * Draws your head in a size x size GUI-unit box at (x, y), turned toward the mouse at (mx, my) (GUI units), faded by
     * alpha. Returns false when there is no face to show (the caller draws your initial instead).
     */
    public static boolean draw(Gfx g, double x, double y, double size, double mx, double my, double dt, boolean reduced, float alpha) {
        double gs = Gfx.guiScale(); int a = Math.round(Math.max(0, Math.min(1, alpha)) * 255) << 24 | 0xFFFFFF;
        if (RadialScreen.Head.ready()) {
            double[] aim = Head3D.Follow.target((mx - x - size / 2) * gs, (my - y - size / 2) * gs, Math.max(120, Gfx.screenH() * 0.4));
            LOOK.update(dt, aim[0], aim[1], reduced);
            // the head image has room around the cube to turn in; drawn 1:1 in real pixels so it stays sharp
            int px = (int) Math.round(size * 1.3 * gs / 2) * 2; RadialScreen.Head.draw(Math.min(RadialScreen.Head.MAX, px), LOOK.yaw, LOOK.pitch);
            g.push(); g.scale((float) (1 / gs)); g.texture(RadialScreen.Head.ID, (int) Math.round((x + size / 2) * gs - px / 2.0), (int) Math.round((y + size / 2) * gs - px / 2.0), px, px, a); g.pop();
            return true;
        }
        if (RadialScreen.Face.ready()) { int px = Math.max(8, (int) Math.round(size * gs) / 8 * 8); g.push(); g.scale((float) (1 / gs)); g.texture(RadialScreen.Face.ID, (int) Math.round(x * gs), (int) Math.round(y * gs), px, px, a); g.pop(); return true; }
        return false;
    }
}
