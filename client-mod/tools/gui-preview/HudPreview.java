package gg.auroras.client;

import gg.auroras.client.platform.Gfx;
import gg.auroras.client.ui.HudArt;
import gg.auroras.core.*;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.List;

/**
 * Renders the HUD widgets with the adapter's real drawing code (ui/HudArt.java and core HudSkin) over a background, so
 * the widgets can be seen without Minecraft. The lines are sample readouts; in game HudRenderer supplies the live ones
 * and lays out each widget with the same calls. Args: background.png out.png [width height guiScale]
 */
public class HudPreview {
    public static void main(String[] a) throws Exception {
        BufferedImage bg = ImageIO.read(new File(a[0])); int W = a.length > 2 ? Integer.parseInt(a[2]) : 1920, H = a.length > 3 ? Integer.parseInt(a[3]) : 1080; Gfx.GS = a.length > 4 ? Double.parseDouble(a[4]) : 3;
        int gw = (int) Math.ceil(W / Gfx.GS), gh = (int) Math.ceil(H / Gfx.GS);
        BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB); Graphics2D g = img.createGraphics(); g.drawImage(bg, 0, 0, W, H, null);
        Gfx c = new Gfx(g, gw, gh); HudArt.Look l = new HudArt.Look();
        widget(c, l, "fps", "FPS Counter", "minimal", new String[]{"FPS 144"}, 6, 6, 0x6FE3FF, "solid");
        widget(c, l, "cps", "CPS Counter", "compact", new String[]{"9 | 4"}, 6, 26, 0x6FE3FF, "solid");
        widget(c, l, "coords", "Coordinates", "expanded", new String[]{"X 128.4  Y 64.0  Z -311.7  NW"}, 6, 44, 0x6FE3FF, "solid");
        widget(c, l, "ping", "Ping Display", "minimal", new String[]{"Ping 42 ms"}, 6, 82, 0x6FE3FF, "ping");
        widget(c, l, "brandinghud", "Client Branding", "minimal", new String[]{"Auroras Client"}, 6, 102, 0x8FD3FF, "gradient");
        widget(c, l, "clock", "Clock", "expanded", new String[]{"21:47"}, gw - 6 - 70, 6, 0xB58CFF, "solid");
        widget(c, l, "potions", "Potion Effects", "expanded", new String[]{"Speed II  1:42", "Night Vision  6:12", "Strength  0:38"}, gw - 6 - 104, 40, 0xFFB86B, "solid");
        widget(c, l, "modulelist", "Module List", "minimal", new String[]{"Custom Skies", "Keystrokes", "Toggle Sprint", "Zoom"}, gw - 6 - 76, 112, 0x6FE3FF, "list");
        widget(c, l, "direction", "Direction HUD", "minimal", new String[]{GameLogic.compassStrip(315, 9) + "  315°"}, gw / 2 - 60, 6, 0x6FE3FF, "solid");
        widget(c, l, "armor", "Armor Status", "expanded", new String[]{"Diamond Helmet  92%", "Diamond Chestplate  88%", "Netherite Sword  100%"}, gw - 6 - 128, gh - 6 - 50, 0x7CE38B, "solid");
        widget(c, l, "memory", "Memory", "compact", new String[]{"Memory 1.2 / 4.0 GB"}, gw / 2 - 40, gh - 40, 0x6FE3FF, "chroma");
        // keystrokes in all three styles, W held, LMB fading out, Space tapped
        String[] styles = {HudSkin.GLASS, HudSkin.CREAMY, HudSkin.CLASSIC}; double[] glow = {1, 0, 0.15, 0, 0.55, 0, 1, 0, 0};
        Keystrokes.Layout lay = Keystrokes.layout(18, 2, true, false, true, "bar");
        for (int s = 0; s < 3; s++) {
            int pad = HudSkin.CREAMY.equals(styles[s]) ? 3 : 2; l.ox = 6 + s * (lay.w() + pad * 2 + 10); l.oy = gh - 6 - lay.h() - pad * 2; base(l, 0x6FE3FF, "solid");
            for (Keystrokes.Key k : lay.keys()) { int in = k.input(); boolean bar = in == Keystrokes.JUMP; String lab = bar ? "" : Keystrokes.label("wasd", in, null, "bar"), sub = in == Keystrokes.ATTACK ? "11 CPS" : in == Keystrokes.USE ? "3 CPS" : null;
                HudArt.key(c, l, styles[s], k, pad, pad, glow[in], lab, sub, bar, 85, 0x06141F); }
        }
        g.dispose(); ImageIO.write(img, "png", new File(a[1])); System.out.println("wrote " + a[1]);
    }
    static void base(HudArt.Look l, int accent, String mode) { l.k = 1; l.fade = 1; l.color = 0xFFFFFF; l.accent = accent; l.bgColor = 0x0C0F16; l.bgPct = 45; l.opacity = 100; l.radius = 2; l.bg = true; l.border = false; l.shadow = true; l.textMode = mode.equals("gradient") || mode.equals("chroma") ? mode : "solid"; l.chromaSpeed = 1; l.seconds = 1.3; }
    /** The same steps HudRenderer.draw takes for a text widget. */
    static void widget(Gfx c, HudArt.Look l, String id, String name, String style, String[] lines, double x, double y, int accent, String mode) {
        base(l, accent, mode); l.ox = x; l.oy = y; HudKit.Style st = HudKit.Style.of(style); HudSkin.Card cd = HudSkin.card(st);
        double tw = 0; for (String s : lines) tw = Math.max(tw, HudArt.width(cd.text(), s)); String label = st.label ? name.toUpperCase() : null;
        int[] b = HudSkin.size(cd, tw, lines.length, label != null ? HudArt.labelWidth(cd.label(), label) : 0, cd.icon() > 0);
        double[] at = HudArt.body(c, l, cd, b, HudSkin.icon(id), label, lines.length); double yy = at[1]; boolean right = mode.equals("list");
        for (int i = 0; i < lines.length; i++) {
            double lx = right ? b[0] - cd.padX() - HudArt.width(cd.text(), lines[i]) : at[0];
            int rgb = mode.equals("ping") ? HudKit.PING_COLORS[0] : right && i % 2 == 0 ? accent : 0xFFFFFF;
            HudArt.text(c, l, cd.text(), lines[i], lx, yy, rgb); yy += cd.line();
        }
    }
}
