package gg.auroras.core;

import java.util.ArrayList;
import java.util.List;

/**
 * The Auroras main menu (title screen) and pause menu: which buttons each shows, where they go on any screen size, the
 * staggered entrance animation, and keyboard focus. Everything is in GUI units and pure, so it is unit-tested (UiTests)
 * and the adapter only draws what it returns and calls Minecraft's own action for the button that was pressed.
 */
public final class GameMenus {
    private GameMenus() {}

    /** How big a button is: the main action, a full-width one, half of a row (two side by side), or a quiet small one. */
    public enum Size { LARGE, NORMAL, HALF, SMALL }
    /** One button: id (what the adapter does), label, icon (visuals/icons), size, whether it can be pressed, and a hint shown on its right. */
    public record Item(String id, String label, String icon, Size size, boolean enabled, String hint) {
        public Item(String id, String label, String icon, Size size) { this(id, label, icon, size, true, ""); }
        public Item disabled() { return new Item(id, label, icon, size, false, hint); }
        public Item hint(String h) { return new Item(id, label, icon, size, enabled, h); }
    }
    public record Rect(int x, int y, int w, int h) {
        public boolean contains(double px, double py) { return px >= x && py >= y && px < x + w && py < y + h; }
        public int right() { return x + w; }
        public int bottom() { return y + h; }
        public double cx() { return x + w / 2.0; }
        public double cy() { return y + h / 2.0; }
    }
    public record Placed(Item item, Rect r) {}
    /**
     * A laid-out menu. panel is the glass card behind the buttons (the pause menu's card, or the main menu's column),
     * logo the brand block above the buttons, header the pause menu's title line.
     */
    public record Layout(Rect panel, Rect logo, Rect header, List<Placed> buttons, boolean centred) {
        public int hit(double x, double y) { for (int k = 0; k < buttons.size(); k++) if (buttons.get(k).item().enabled() && buttons.get(k).r().contains(x, y)) return k; return -1; }
        public int indexOf(String id) { for (int k = 0; k < buttons.size(); k++) if (buttons.get(k).item().id().equals(id)) return k; return -1; }
    }

    // ---- what each menu shows ----
    public static final String VEX_ADDRESS = "vexvanilla.net", VEX_NAME = "VexVanilla";
    /** The main menu. multiplayer false greys out Multiplayer and Join (Minecraft says why, e.g. a child account). */
    public static List<Item> titleItems(boolean multiplayer) {
        List<Item> l = new ArrayList<>();
        l.add(new Item("singleplayer", "Singleplayer", "user", Size.LARGE));
        Item mp = new Item("multiplayer", "Multiplayer", "globe", Size.NORMAL), vex = new Item("vexvanilla", "Join " + VEX_NAME, "server", Size.NORMAL).hint(VEX_ADDRESS);
        l.add(multiplayer ? mp : mp.disabled()); l.add(multiplayer ? vex : vex.disabled());
        l.add(new Item("auroras", "Auroras menu", "sparkles", Size.HALF)); l.add(new Item("options", "Options", "gear", Size.HALF));
        l.add(new Item("quit", "Quit game", "power", Size.SMALL));
        return l;
    }
    /**
     * The pause menu. local: a singleplayer world (this game runs the server). world: the label of the release's own
     * world button, or null when it has none here ("Open to LAN" up to 26.1, "Multiplayer options" in 26.2, "World
     * options" from 26.3; the adapter's versions/<target>/platform/Mc decides), greyed out when worldEnabled is false
     * (a world already open to LAN, as in vanilla).
     */
    public static List<Item> pauseItems(boolean local, String world, boolean worldEnabled) {
        List<Item> l = new ArrayList<>();
        l.add(new Item("back", "Back to game", "play", Size.LARGE));
        l.add(new Item("advancements", "Advancements", "trophy", Size.HALF)); l.add(new Item("stats", "Statistics", "chart", Size.HALF));
        l.add(new Item("options", "Options", "gear", Size.HALF)); l.add(new Item("auroras", "Auroras menu", "sparkles", Size.HALF));
        if (world != null && !world.isBlank()) { Item w = new Item("world", world, "signal", Size.NORMAL); l.add(worldEnabled ? w : w.disabled().hint("Open")); }
        l.add(new Item("disconnect", local ? "Save and quit to title" : "Disconnect", "power", Size.NORMAL));
        return l;
    }

    // ---- layout ----
    public static final int GAP = 5, TITLE_W = 168, PAUSE_W = 212, PAD = 12, HEADER = 30, LOGO_H = 50;
    public static int height(Size s) { return switch (s) { case LARGE -> 26; case NORMAL, HALF -> 21; case SMALL -> 17; }; }

    /**
     * The main menu on a sw x sh GUI-unit screen. layout "left" puts the logo and a column of buttons at the left
     * (the theme's background shows on the right); "centre" stacks them in the middle. Small screens shrink the gaps
     * first and then the buttons (never below 15 units), so everything always fits above the footer line.
     */
    public static Layout title(int sw, int sh, List<Item> items, String layout) {
        boolean centred = "centre".equals(layout);
        int w = Math.min(TITLE_W, Math.max(120, sw - 32)), footer = 18, avail = Math.max(60, sh - footer - 16);
        int logoH = sh < 230 ? 34 : LOGO_H, gapAfterLogo = sh < 230 ? 8 : 16;
        double k = fit(items, avail - logoH - gapAfterLogo);
        int block = logoH + gapAfterLogo + stackHeight(items, k);
        int x = centred ? (sw - w) / 2 : Math.max(16, Math.min(56, (int) Math.round(sw * 0.075)));
        int y = Math.max(8, (int) Math.round((sh - footer) / 2.0 - block / 2.0 + (centred ? 0 : -4)));
        Rect logo = new Rect(x, y, w, logoH);
        List<Placed> placed = stack(items, x, y + logoH + gapAfterLogo, w, k);
        Rect panel = new Rect(x, logo.y(), w, placed.isEmpty() ? logoH : placed.get(placed.size() - 1).r().bottom() - logo.y());
        return new Layout(panel, logo, null, placed, centred);
    }
    /** The pause menu: a glass card in the middle of the screen with a title line and the buttons. */
    public static Layout pause(int sw, int sh, List<Item> items) {
        int w = Math.min(PAUSE_W, Math.max(140, sw - 24)), inner = w - 2 * PAD;
        double k = fit(items, Math.max(60, sh - 24 - 2 * PAD - HEADER));
        int h = 2 * PAD + HEADER + stackHeight(items, k), x = (sw - w) / 2, y = Math.max(8, (sh - h) / 2);
        Rect panel = new Rect(x, y, w, h), header = new Rect(x + PAD, y + PAD, inner, HEADER - 6);
        return new Layout(panel, null, header, stack(items, x + PAD, y + PAD + HEADER, inner, k), true);
    }
    /** 1 if the stack fits in avail units, otherwise how much to shrink it (gaps first, then heights; 0.6 at least). */
    static double fit(List<Item> items, int avail) { int full = stackHeight(items, 1); return full <= avail ? 1 : Math.max(0.6, avail / (double) full); }
    static int rowH(Size s, double k) { return Math.max(15, (int) Math.round(height(s) * Math.min(1, 0.4 + 0.6 * k))); }
    static int gap(double k) { return Math.max(2, (int) Math.round(GAP * k)); }
    static int stackHeight(List<Item> items, double k) {
        int h = 0, rows = 0;
        for (int i = 0; i < items.size(); i++) { Item it = items.get(i); h += rowH(it.size(), k); rows++; if (it.size() == Size.HALF && i + 1 < items.size() && items.get(i + 1).size() == Size.HALF) i++; }
        return h + Math.max(0, rows - 1) * gap(k) + (items.stream().anyMatch(it -> it.size() == Size.SMALL) ? gap(k) : 0);
    }
    /** Rows top to bottom; two HALF items in a row share it. A SMALL button gets a little extra space above it. */
    static List<Placed> stack(List<Item> items, int x, int y, int w, double k) {
        List<Placed> out = new ArrayList<>(); int g = gap(k);
        for (int i = 0; i < items.size(); i++) {
            Item it = items.get(i); int h = rowH(it.size(), k);
            if (it.size() == Size.SMALL && i > 0) y += g;
            if (it.size() == Size.HALF && i + 1 < items.size() && items.get(i + 1).size() == Size.HALF) {
                int hw = (w - g) / 2; out.add(new Placed(it, new Rect(x, y, hw, h))); out.add(new Placed(items.get(i + 1), new Rect(x + w - hw, y, hw, h))); i++;
            } else out.add(new Placed(it, new Rect(x, y, w, h)));
            y += h + g;
        }
        return out;
    }

    // ---- motion ----
    /** Seconds before button i starts to slide in, and how long each takes (scaled by Menu Animations speed by the caller). */
    public static final double STAGGER = 0.035, FIRST = 0.08, DURATION = 0.34;
    /** Entrance progress 0..1 of button i, t seconds after the menu opened: each eases in a little after the one above. */
    public static double entrance(double t, int i, boolean reduced) {
        if (reduced) return 1; double p = (t - FIRST - STAGGER * i) / DURATION; return easeOut(p);
    }
    /** The whole menu's fade, t seconds after it opened. */
    public static double fadeIn(double t, boolean reduced) { return reduced ? 1 : easeOut(t / 0.28); }
    /** Cubic ease-out, clamped to 0..1. */
    public static double easeOut(double p) { p = Math.max(0, Math.min(1, p)); return 1 - Math.pow(1 - p, 3); }
    /** True once every button has finished arriving (the screen can stop asking for entrance values). */
    public static boolean settled(double t, int count) { return t >= FIRST + STAGGER * Math.max(0, count - 1) + DURATION; }

    // ---- keyboard ----
    /** Next pressable button from focus in direction dir (+1 down, -1 up), wrapping; -1 focus starts at the first or last. */
    public static int step(Layout l, int focus, int dir) {
        int n = l.buttons().size(); if (n == 0) return -1;
        int k = focus < 0 ? (dir > 0 ? -1 : n) : focus;
        for (int s = 0; s < n; s++) { k = Math.floorMod(k + dir, n); if (l.buttons().get(k).item().enabled()) return k; }
        return -1;
    }
}
