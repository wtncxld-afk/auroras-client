package gg.auroras.core;

import java.nio.file.*;
import java.util.*;

/** The radial menu (layout, outlines, baked art, hit testing, animation) and the Auroras font. Run: java -cp out gg.auroras.core.RadialTests ../../visuals */
public class RadialTests {
    static int pass, fail;
    static void check(String n, boolean ok, Object... info) { if (ok) pass++; else fail++; System.out.println((ok ? "PASS  " : "FAIL  ") + n + (ok || info.length == 0 ? "" : "  " + Arrays.toString(info))); }

    public static void main(String[] a) throws Exception {
        Path dir = Path.of(a.length > 0 ? a[0] : "../../visuals");
        // raster
        float[] acc = new float[25]; Raster.cover(new float[]{1.5f, 3.5f, 3.5f, 1.5f}, new float[]{1.5f, 1.5f, 3.5f, 3.5f}, 4, 0, 0, 5, 5, 1, acc);
        double sum = 0; for (float v : acc) sum += v;
        check("raster: coverage is exact (a 2x2 square on half pixels covers 4 pixels' worth, corners a quarter, middle fully)", Math.abs(sum - 4) < 1e-4 && Math.abs(acc[6] - 0.25) < 1e-4 && Math.abs(acc[12] - 1) < 1e-4 && acc[0] == 0, sum, acc[6], acc[12]);
        float[] cx = new float[256], cy = new float[256]; Raster.star(t -> 40, 50, 50, 0, 256, cx, cy); float[] circ = new float[100 * 100]; Raster.cover(cx, cy, 256, 0, 0, 100, 100, 1, circ);
        double area = 0; int partial = 0; for (float v : circ) { area += v; if (v > 0.02 && v < 0.98) partial++; }
        check("raster: a circle's area matches pi r^2 within 0.2%, with a smooth (partly covered) edge all round", Math.abs(area - Math.PI * 1600) / (Math.PI * 1600) < 0.002 && partial > 200, area, partial);
        check("raster: point-in-outline test", Raster.inside(cx, cy, 256, 50, 50) && !Raster.inside(cx, cy, 256, 5, 5) && Raster.inside(cx, cy, 256, 89, 50) && !Raster.inside(cx, cy, 256, 91, 50));
        // layout
        boolean fits = true, apart = true; String worst = "";
        for (int[] s : new int[][]{{854, 480}, {1280, 720}, {1366, 768}, {1920, 1080}, {2560, 1440}, {3440, 1440}, {3840, 2160}, {1024, 768}, {800, 600}}) {
            RadialMenu m = open(s[0], s[1]); float[] xs = new float[180], ys = new float[180];
            for (int k = 0; k < RadialMenu.N; k++) {
                Raster.star(m.shape(k, RadialMenu.HOVER), m.px(k), m.py(k), m.glow(), 180, xs, ys);
                for (int i = 0; i < 180; i++) if (xs[i] < 4 || ys[i] < 4 || xs[i] > s[0] - 4 || ys[i] > s[1] - 4) { fits = false; worst = s[0] + "x" + s[1] + " petal " + k; }
                Raster.star(m.shape(k, 1), m.px(k), m.py(k), 0, 180, xs, ys);
                for (int i = 0; i < 180; i++) if (Math.hypot(xs[i] - m.cx, ys[i] - m.cy) < m.hubR + 2) apart = false;
            }
        }
        check("layout: every petal (hovered, with its glow) stays on screen from 800x600 to 3840x2160 and ultrawide", fits, worst);
        check("layout: the hub never touches a petal", apart);
        RadialMenu m = open(1920, 1080);
        check("layout: sections clockwise from the top: HUD, Visuals, Design, Settings, Utility", RadialMenu.PETALS.stream().map(RadialMenu.Petal::label).toList().equals(List.of("HUD", "Visuals", "Design", "Settings", "Utility")) && m.py(0) < m.cy && m.px(1) > m.cx && m.px(4) < m.cx);
        // baked art
        int[] hub = m.bakeHub(); int hs = m.hubSide(), c = hs / 2;
        int centre = hub[c * hs + c] >>> 24, rim = maxAlphaAlongRow(hub, hs, c, c + (int) m.hubR - 4, c + (int) m.hubR + 2), outside = hub[0] >>> 24;
        check("art: frosted centre (translucent), bright rim, nothing in the corners", centre > 40 && centre < 110 && rim > 200 && outside == 0, centre, rim);
        long t0 = System.nanoTime(); int[] p0 = null; for (int k = 0; k < RadialMenu.N; k++) { p0 = m.bakePetal(k, false, null, 0, 0); m.bakePetal(k, true, null, 0, 0); } m.bakeHub(); double bakeMs = (System.nanoTime() - t0) / 1e6;
        check("art: all petals (both states) and the hub bake in under 400 ms at 1920x1080 (done once when the menu opens)", bakeMs < 400, bakeMs);
        System.out.println("      bake time at 1920x1080: " + Math.round(bakeMs) + " ms");
        int ps = m.side(); int softEdge = 0; for (int x = 0; x < ps; x++) { int al = p0[(ps / 2) * ps + x] >>> 24; if (al > 0 && al < 40) softEdge++; }
        check("art: petal edges fade out softly (glow), not a hard cut", softEdge >= 4, softEdge);
        float[] icon = new float[16 * 16]; for (int i = 0; i < icon.length; i++) icon[i] = 1; int[] withIcon = m.bakePetal(0, false, icon, 16, 16), plain = m.bakePetal(0, false, null, 0, 0);
        int ic = (int) (ps / 2 - m.petalR * 0.14f); check("art: the icon is drawn into the petal above its centre", (withIcon[ic * ps + ps / 2] >>> 24) > 230 && (plain[ic * ps + ps / 2] >>> 24) < 120);
        int[] pill = RadialMenu.bakePill(60, 16, 0x8FD3FF, 1); check("art: badge pill is rounded (corners clear, middle solid)", (pill[0] >>> 24) == 0 && (pill[8 * 60 + 30] >>> 24) == 255 && (pill[8 * 60] >>> 24) > 0);
        // hit testing
        RadialMenu o = open(1920, 1080);
        boolean hits = true; for (int k = 0; k < RadialMenu.N; k++) hits &= o.hit(o.px(k), o.py(k)) == k;
        check("hit: each petal's centre selects it; the hub and empty space select nothing", hits && o.hit(o.cx, o.cy) == -1 && o.onHub(o.cx, o.cy) && o.hit(5, 5) == -1);
        float edgeX = (float) (o.px(1) + o.shape(1, 1).radius(0) - 3); check("hit: by the real outline (just inside the edge counts)", o.hit(edgeX, o.py(1)) == 1, edgeX);
        // animation
        RadialMenu an = new RadialMenu(1920, 1080); boolean mono = true; double last = -1; int frames = 0;
        while (an.phase != RadialMenu.Phase.OPEN && frames < 200) { an.update(1 / 60.0, -1, false); double p = an.progress(4); if (p < last - 1e-9) mono = false; last = p; frames++; }
        check("open: petals grow out smoothly and in order, finishing in under half a second", mono && frames * (1 / 60.0) < 0.5 && an.progress(0) == 1, frames);
        RadialMenu st = new RadialMenu(1920, 1080); st.update(0.06, -1, false);
        check("open: staggered clockwise from the top", st.progress(0) > st.progress(1) && st.progress(1) > st.progress(4));
        RadialMenu hv = open(1920, 1080); double prev = 0; boolean smooth = true, under = true; for (int f = 0; f < 30; f++) { hv.update(1 / 60.0, 2, false); if (hv.hover[2] < prev) smooth = false; if (hv.hover[2] > 1) under = false; prev = hv.hover[2]; }
        check("hover: eases in without jumping or overshooting, and is nearly complete within a quarter second", smooth && under && hv.hover[2] > 0.95 && hv.hover[0] == 0, hv.hover[2]);
        hv.press(2); for (int f = 0; f < 10; f++) hv.update(1 / 60.0, 2, false); check("press: the petal dips slightly while held", hv.scale(2) < 0.99f && hv.scale(2) > 0.95f, hv.scale(2));
        RadialMenu cl = open(1920, 1080); float before = cl.px(3); cl.close(3); int cf = 0; float pxMid = 0;
        while (!cl.done() && cf < 100) { cl.update(1 / 60.0, -1, false); if (cf == 4) pxMid = cl.px(3); cf++; }
        check("close: the chosen section stays put and fades while the others fold in, all within a quarter second", cl.done() && Math.abs(pxMid - before) < 0.01 && cf * (1 / 60.0) < 0.3, cf);
        RadialMenu rm = new RadialMenu(1920, 1080); rm.update(0.001, -1, true); check("reduced motion: opens and closes at once", rm.phase == RadialMenu.Phase.OPEN && rm.progress(4) == 1 && closeNow(rm));
        check("easing: 0 to 1, never backwards, never past 1, front-loaded", RadialMenu.ease(0) == 0 && RadialMenu.ease(1) == 1 && monotone() && RadialMenu.ease(0.5) > 0.75);
        check("keyboard: arrows step round the ring", o.step(-1, 1) == 0 && o.step(4, 1) == 0 && o.step(0, -1) == 4 && o.step(-1, -1) == 4);
        // sections
        Config.Registry reg = new Config.Registry(); Config.ProfileManager pm = new Config.ProfileManager(reg); ModuleMenu mm = new ModuleMenu(reg, pm).group(RadialMenu.PETALS.get(1).categories());
        check("sections: Visuals lists only its categories, and All means all of the section", mm.categories().equals(List.of("All", "Color & Rendering", "World & Sky", "Particles & Effects")) && !mm.visible().isEmpty() && mm.visible().stream().allMatch(x -> RadialMenu.PETALS.get(1).categories().contains(x.cat().label)));
        boolean covered = reg.modules().stream().allMatch(x -> RadialMenu.PETALS.stream().anyMatch(p -> p.categories().contains(x.cat().label)));
        check("sections: every module belongs to exactly one section", covered);
        mm.openSettings("settings"); ModuleMenu.Layout ml = mm.layout(480, 270);
        check("settings page: menu key, visual quality, menu theme and effects, main and pause menus, saved as the client's own settings", mm.openModule() == ModuleMenu.CLIENT && ml.rows().size() == 7 && mm.value(ml.rows().get(1).d()).equals("BALANCED") && !mm.toggle("settings"));
        mm.set(ml.rows().get(1).d(), "HIGH"); check("settings page: changing quality writes settings.quality", pm.get(Config.Registry.QUALITY).equals("HIGH"));
        // font
        TextKit tk = new TextKit(Files.readString(dir.resolve("font/auroras-font.json")));
        TextKit.Face f14 = tk.face("medium", 14), f15 = tk.face("semibold", 15), big = tk.face("medium", 500);
        check("font: exact baked sizes, the next size up otherwise, the largest as a last resort", f14.size() == 14 && f15.size() == 16 && big.size() == 44 && Math.abs(TextKit.scaleFor(f15, 15) - 15 / 16.0) < 1e-9);
        double wHud = tk.width(f14, "Settings", 1), wHudBold = tk.width(tk.face("semibold", 14), "Settings", 1);
        check("font: measuring text (semibold is a little wider)", wHud > 40 && wHud < 70 && wHudBold > wHud, wHud, wHudBold);
        String cut = tk.fit(f14, "A really very long Minecraft name here", 1, 80);
        check("font: long names end in an ellipsis inside the space", cut.endsWith("…") && tk.width(f14, cut, 1) <= 80 && tk.fit(f14, "Steve", 1, 80).equals("Steve"), cut);
        List<int[]> quads = new ArrayList<>(); tk.draw(f14, "Auroras Client", 10.4, 20.6, 1, (x, y, w, h, u, v, uw, vh) -> quads.add(new int[]{x, y, w, h, u, v, uw, vh}));
        check("font: one atlas quad per visible letter, on whole pixels, inside the atlas", quads.size() == 13 && quads.stream().allMatch(q -> q[4] >= 0 && q[5] >= 0 && q[4] + q[6] <= tk.atlasW && q[5] + q[7] <= tk.atlasH && q[2] == q[6]), quads.size());
        check("font: unknown characters fall back to '?' instead of breaking", tk.width(f14, "中", 1) == tk.width(f14, "?", 1));
        // 3D head
        Head3D head = new Head3D(testSkin(false)); int hsz = 120, mid = hsz / 2;
        int[] still = head.render(hsz, 0, 0);
        check("head: facing you, the middle shows the front of the face", hueNear(still[mid * hsz + mid], FRONT) && hueNear(still[(hsz / 3) * hsz + mid], FRONT), Integer.toHexString(still[mid * hsz + mid]));
        check("head: corners stay see-through and the outline is anti-aliased", still[0] == 0 && still[hsz * hsz - 1] == 0 && countPartial(still) > 40, countPartial(still));
        int[] right = head.render(hsz, 40, 0);
        check("head: turned to your right, the face moves right and its right side (skin u 0..8) shows on your left", hueNear(right[mid * hsz + hsz / 4 + 4], RIGHT) && hueNear(right[mid * hsz + hsz * 2 / 3], FRONT), Integer.toHexString(right[mid * hsz + hsz / 4 + 4]));
        int[] left = head.render(hsz, -40, 0);
        check("head: turned to your left, its left side (skin u 16..24) shows on your right", hueNear(left[mid * hsz + hsz * 3 / 4 - 4], LEFT), Integer.toHexString(left[mid * hsz + hsz * 3 / 4 - 4]));
        int[] down = head.render(hsz, 0, 26), up = head.render(hsz, 0, -26);
        check("head: tipped down shows the top of the head above the face, tipped up shows the chin underside", hueNear(down[(hsz / 5) * hsz + mid], TOP) && hueNear(up[(hsz * 4 / 5) * hsz + mid], BOTTOM), Integer.toHexString(down[(hsz / 5) * hsz + mid]), Integer.toHexString(up[(hsz * 4 / 5) * hsz + mid]));
        check("head: lit from above (the top keeps more of its colour than the underside)", lum(down[(hsz / 5) * hsz + mid]) / lum(0xFF000000 | TOP) > lum(up[(hsz * 4 / 5) * hsz + mid]) / lum(0xFF000000 | BOTTOM) + 0.15);
        int[] hat = new Head3D(testSkin(true)).render(hsz, 0, 0);
        check("head: the hat layer covers the face where it's solid and lets it through where it's clear", hueNear(hat[mid * hsz + mid], HAT_C) && hueNear(hat[(hsz * 3 / 4) * hsz + mid], FRONT), Integer.toHexString(hat[mid * hsz + mid]), Integer.toHexString(hat[(hsz * 3 / 4) * hsz + mid]));
        for (int i = 0; i < 20; i++) head.render(160, i, i); long ht = System.nanoTime(); for (int i = 0; i < 10; i++) head.render(160, i * 3, i); double headMs = (System.nanoTime() - ht) / 1e6 / 10;
        check("head: a 160 px frame renders in under 4 ms (only redrawn while it moves)", headMs < 4, headMs);
        Head3D.Follow fa = new Head3D.Follow(), fb = new Head3D.Follow(); double over = 0;
        for (int i = 0; i < 30; i++) { fa.update(1 / 60.0, 30, 10, false); over = Math.max(over, fa.yaw - 30); }
        for (int i = 0; i < 72; i++) fb.update(1 / 144.0, 30, 10, false);
        check("head follow: glides to the mouse without overshoot and the same at 60 and 144 fps", over <= 1e-9 && Math.abs(fa.yaw - fb.yaw) < 0.05 && Math.abs(fa.yaw - 30) < 0.5, fa.yaw, fb.yaw, over);
        double[] tg = Head3D.Follow.target(10000, -10000, 300);
        check("head follow: never turns past its limits, and looks up when the mouse is above", tg[0] <= Head3D.MAX_YAW && tg[0] > Head3D.MAX_YAW * 0.99 && tg[1] < 0 && tg[1] >= -Head3D.MAX_PITCH);
        Head3D.Follow fr = new Head3D.Follow(); fr.update(1 / 60.0, 12, -5, true);
        check("head follow: reduced motion snaps straight to the mouse", fr.yaw == 12 && fr.pitch == -5);
        System.out.println("\n" + pass + " passed, " + fail + " failed"); if (fail > 0) System.exit(1);
    }
    static final int FRONT = 0xD9A066, RIGHT = 0x3F7FE0, LEFT = 0x2EB86A, TOP = 0x6B3A1E, BOTTOM = 0xC23A3A, BACK = 0x8A8A8A, HAT_C = 0xE8C21E;
    /** A test skin (top 64x16): each head side its own colour; with hat, a hat band over the top half of the face only. */
    static int[] testSkin(boolean hat) {
        int[] s = new int[Head3D.SKIN_W * Head3D.SKIN_H];
        for (int y = 0; y < 16; y++) for (int x = 0; x < 32; x++) {
            int c = y < 8 ? (x >= 8 && x < 16 ? TOP : x >= 16 && x < 24 ? BOTTOM : 0) : (x < 8 ? RIGHT : x < 16 ? FRONT : x < 24 ? LEFT : BACK);
            if (c != 0) s[y * 64 + x] = 0xFF000000 | c;
            if (hat && y >= 8 && y < 13 && x >= 8 && x < 16) s[y * 64 + x + 32] = 0xFF000000 | HAT_C;
        }
        return s;
    }
    static int rgb(int c) { return c & 0xFFFFFF; }
        static boolean hueNear(int c, int base) {
        if ((c >>> 24) < 200) return false;
        double r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, R = (base >> 16) & 255, G = (base >> 8) & 255, B = base & 255;
        double l1 = Math.max(1, r + g + b), l2 = Math.max(1, R + G + B);
        return Math.abs(r / l1 - R / l2) < 0.04 && Math.abs(g / l1 - G / l2) < 0.04 && Math.abs(b / l1 - B / l2) < 0.04;
    }
    static double lum(int c) { return 0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255); }
    static int countPartial(int[] img) { int n = 0; for (int c : img) { int a = c >>> 24; if (a > 10 && a < 245) n++; } return n; }
    static RadialMenu open(int w, int h) { RadialMenu m = new RadialMenu(w, h); for (int i = 0; i < 60; i++) m.update(1 / 60.0, -1, false); return m; }
    static boolean closeNow(RadialMenu m) { m.close(-1); m.update(0.001, -1, true); return m.done(); }
    static boolean monotone() { double p = 0; for (int i = 0; i <= 200; i++) { double v = RadialMenu.ease(i / 200.0); if (v < p - 1e-12 || v > 1) return false; p = v; } return true; }
    static int maxAlphaAlongRow(int[] img, int s, int row, int x0, int x1) { int mx = 0; for (int x = x0; x <= x1; x++) mx = Math.max(mx, img[row * s + x] >>> 24); return mx; }
}
