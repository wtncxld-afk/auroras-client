package gg.auroras.core;

import java.util.*;

/**
 * State, layout and editing rules of the in-game module menu (Right Shift). Pure Java so every rule is unit-tested; the
 * adapter's ModuleScreen only draws what this returns and forwards input. Sizes are Minecraft GUI pixels.
 *
 * Layout: a centred panel with a category rail on the left, a top bar (search, HUD editor), and a body that shows either
 * the module grid or one module's settings. Text never overflows: callers ellipsize to the widths given here.
 */
public final class ModuleMenu {
    public final Config.Registry reg; public final Config.ProfileManager pm;
    public String category = "All", query = "", open = null; public double scroll = 0; public String message = "";
    public ModuleMenu(Config.Registry reg, Config.ProfileManager pm) { this.reg = reg; this.pm = pm; }

    public record Rect(int x, int y, int w, int h) {
        public boolean contains(double px, double py) { return px >= x && py >= y && px < x + w && py < y + h; }
        public int right() { return x + w; } public int bottom() { return y + h; }
    }
    public record Card(Config.Module m, Rect r, Rect sw) {}
    public record Row(Config.SettingDef d, Rect r, Rect ctl) {}
    public record Layout(Rect panel, Rect rail, Rect top, Rect search, Rect hudBtn, Rect body, Rect back, List<String> cats, List<Rect> catRects,
                         List<Card> cards, List<Row> rows, Rect headSwitch, Rect hudLink, int content) {}

    public static final int RAIL = 124, TOP = 36, CARD_MIN = 140, CARD_H = 36, GAP = 6, ROW = 24, ROW_SLIDER = 30, PAD = 10, HEAD = 46, CAT_H = 18;
    /** Keys edited elsewhere: the switch in the panel header, and HUD position (the HUD editor's job). */
    static final Set<String> HIDDEN = Set.of("enabled", "anchor", "offX", "offY");

    /**
     * A section of the radial menu: only these categories are listed (null = all). The rail's "All" then means all of
     * the section.
     */
    public List<String> group = null;
    public ModuleMenu group(List<String> cats) { group = cats == null || cats.isEmpty() ? null : List.copyOf(cats); category = "All"; scroll = 0; return this; }
    /** The client's own settings (menu key, visual quality), shown like a module's settings page. Keys are "settings.*". */
    public static final Config.Module CLIENT = new Config.Module("settings", "Client settings", Config.Category.ANIMATIONS, Config.Impact.COSMETIC, true,
        "Applies to every profile", List.of(new Config.SettingDef("guiKey", Config.Type.KEY, "344", 0, 0, List.of()), new Config.SettingDef("quality", Config.Type.ENUM, "BALANCED", 0, 0, List.of("LOW", "BALANCED", "HIGH")),
            new Config.SettingDef("menuTheme", Config.Type.ENUM, "aurora", 0, 0, MenuTheme.IDS), new Config.SettingDef("menuFx", Config.Type.BOOL, "true", 0, 0, List.of())));
    public List<String> categories() { List<String> all = UiKit.categories(reg.modules()); return group == null ? all : all.stream().filter(c -> c.equals("All") || group.contains(c)).toList(); }
    public List<Config.Module> visible() { List<Config.Module> v = UiKit.filter(reg.modules(), category, query); return group == null ? v : v.stream().filter(m -> group.contains(m.cat().label)).toList(); }
    public Config.Module openModule() { return open == null ? null : open.equals(CLIENT.id()) ? CLIENT : reg.get(open); }
    public List<Config.SettingDef> settings(Config.Module m) { List<Config.SettingDef> o = new ArrayList<>(); for (Config.SettingDef d : m.settings()) if (!HIDDEN.contains(d.key())) o.add(d); return o; }

    public Layout layout(int sw, int sh) {
        int w = Math.min(sw - 16, 480), h = Math.min(sh - 16, 300), x = (sw - w) / 2, y = (sh - h) / 2;
        Rect panel = new Rect(x, y, w, h), rail = new Rect(x, y, RAIL, h), top = new Rect(x + RAIL, y, w - RAIL, TOP);
        // top bar: the page title on the left (drawn by the screen), search and the HUD editor button on the right
        int titleRoom = Math.min(110, Math.max(0, top.w() - PAD * 2 - 70 - 6 - 120));
        Rect hudBtn = new Rect(top.right() - PAD - 70, y + 9, 70, 18), search = new Rect(top.x() + PAD + titleRoom, y + 9, Math.max(60, hudBtn.x() - 6 - top.x() - PAD - titleRoom), 18);
        Rect body = new Rect(top.x() + PAD, y + TOP + 4, top.w() - PAD * 2, h - TOP - 4 - PAD);
        List<String> cats = categories(); List<Rect> cr = new ArrayList<>(); int cy = y + 40;
        for (int k = 0; k < cats.size(); k++) { cr.add(new Rect(x + 8, cy, RAIL - 16, CAT_H)); cy += CAT_H + 2; }
        List<Card> cards = new ArrayList<>(); List<Row> rows = new ArrayList<>(); Rect back = null, headSwitch = null, hudLink = null; int content;
        Config.Module m = openModule();
        if (m == null) {
            int cols = UiKit.columns(body.w(), CARD_MIN, GAP), cw = UiKit.cardWidth(body.w(), cols, GAP); List<Config.Module> vis = visible();
            for (int i = 0; i < vis.size(); i++) { int cx = body.x() + (i % cols) * (cw + GAP), cyy = body.y() + (i / cols) * (CARD_H + GAP) - (int) Math.round(scroll);
                Rect r = new Rect(cx, cyy, cw, CARD_H); cards.add(new Card(vis.get(i), r, new Rect(r.right() - 30, cyy + (CARD_H - 12) / 2, 22, 12))); }
            content = vis.isEmpty() ? 0 : ((vis.size() + cols - 1) / cols) * (CARD_H + GAP) - GAP;
        } else {
            back = new Rect(body.x(), body.y() + 2, 18, 18); headSwitch = new Rect(body.right() - 26, body.y() + 6, 22, 12);
            int ry = body.y() + HEAD - (int) Math.round(scroll), ctlW = Math.min(150, body.w() / 2);
            if (HudKit.positionable(m)) { hudLink = new Rect(body.x(), ry, body.w(), ROW); ry += ROW; }
            for (Config.SettingDef d : settings(m)) {
                int rh = UiKit.controlFor(d) == UiKit.Control.SLIDER ? ROW_SLIDER : ROW; Rect r = new Rect(body.x(), ry, body.w(), rh);
                Rect ctl = UiKit.controlFor(d) == UiKit.Control.SLIDER ? new Rect(body.x() + 10, ry + 17, body.w() - 20, 10) : new Rect(body.right() - 8 - ctlW, ry + 5, ctlW, 14);
                rows.add(new Row(d, r, ctl)); ry += rh;
            }
            content = HEAD + (hudLink != null ? ROW : 0) + rows.stream().mapToInt(r -> r.r().h()).sum();
        }
        return new Layout(panel, rail, top, search, hudBtn, body, back, cats, cr, cards, rows, headSwitch, hudLink, content);
    }
    public void scrollBy(Layout l, double amount) { scroll = UiKit.clampScroll(scroll - amount * 16, l.content(), l.body().h()); }

    public void setCategory(String c) { category = c; scroll = 0; }
    public void setQuery(String q) { query = q == null ? "" : q; scroll = 0; }
    public void openSettings(String id) { open = id; scroll = 0; message = ""; }
    public void back() { open = null; scroll = 0; message = ""; }

    /** Turns a module on or off. Unavailable modules can't be switched on; the reason is kept in message. */
    public boolean toggle(String id) {
        Config.Module m = reg.get(id); if (m == null) return false;
        if (!m.available()) { message = m.name() + " isn't in the game yet."; return false; }
        pm.setEnabled(id, !pm.enabled(id)); message = ""; return true;
    }
    public String key(Config.SettingDef d) { return open + "." + d.key(); }
    public String value(Config.SettingDef d) { return pm.get(key(d)); }
    public boolean changed(Config.SettingDef d) {
        String v = value(d); if (d.type() == Config.Type.DOUBLE || d.type() == Config.Type.INT) return Double.parseDouble(v) != Double.parseDouble(d.def()); return !v.equals(d.def());
    }
    public void set(Config.SettingDef d, String v) { pm.set(key(d), v); }
    public void reset(Config.SettingDef d) { set(d, d.def()); }
    /** Slider drag: the value under the mouse on the track, snapped to the launcher's step. */
    public void slide(Config.SettingDef d, double mouseX, Rect track) { set(d, UiKit.formatSetting(d, UiKit.sliderValue(mouseX, track.x(), track.w(), d.min(), d.max(), UiKit.stepFor(d)))); }
    /** Keyboard or scroll: one step (shift: ten) for sliders, next option for choices, flip for switches, next swatch for colors. */
    public void nudge(Config.SettingDef d, int dir, boolean big) {
        switch (UiKit.controlFor(d)) {
            case SWITCH -> set(d, String.valueOf(!Boolean.parseBoolean(value(d))));
            case SLIDER -> set(d, UiKit.formatSetting(d, UiKit.sliderNudge(Double.parseDouble(value(d)), d.min(), d.max(), UiKit.stepFor(d), dir, big)));
            case SEGMENTED, DROPDOWN -> set(d, UiKit.cycle(d.options(), value(d), dir));
            case COLOR -> set(d, cycleColor(value(d), dir));
            default -> { }
        }
    }
    /** Text settings (Name Protect's alias): typing appends what the setting allows and ignores anything else. Returns true when it changed. */
    public boolean typeText(Config.SettingDef d, String typed) {
        String v = value(d) + typed; if (pm == null || reg.validate(key(d), v) != null) return false; set(d, v); return true;
    }
    public boolean eraseText(Config.SettingDef d) { String v = value(d); if (v.isEmpty()) return false; set(d, v.substring(0, v.length() - 1)); return true; }
    /** Colors offered in game (the launcher has a full picker): the design accents plus neutrals. */
    public static final List<String> PALETTE = List.of("FFFFFF", "E8ECF4", "8A93A6", "8FD3FF", "6FE3FF", "5FD0D6", "A78BFA", "B58CFF", "FFB7CF", "6FCF97", "E0B45A", "E57373");
    public static String cycleColor(String cur, int dir) { int i = PALETTE.indexOf(cur.toUpperCase(Locale.ROOT)); return i < 0 ? PALETTE.get(0) : PALETTE.get(Math.floorMod(i + dir, PALETTE.size())); }

    /** What a row shows as its value (sliders show the number; choices their label). */
    public String display(Config.SettingDef d) {
        String v = value(d);
        return switch (d.type()) { case ENUM -> UiKit.optionLabel(v); case BOOL -> v.equals("true") ? "On" : "Off"; case DOUBLE -> Calc.num(Double.parseDouble(v), UiKit.stepFor(d) >= 1 ? 0 : UiKit.stepFor(d) >= 0.1 ? 1 : 2); default -> v; };
    }
    /** Human label for a setting key: "bgOpacity" -> "Background opacity". */
    public static String label(String key) {
        String s = LABELS.get(key); if (s != null) return s; s = key.replaceAll("([A-Z])", " $1").toLowerCase(Locale.ROOT); return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
    private static final Map<String, String> LABELS = Map.ofEntries(Map.entry("noCooldownDip", "No cooldown dip"), Map.entry("posX", "Item left / right"), Map.entry("posY", "Item up / down"), Map.entry("posZ", "Item near / far"), Map.entry("itemScale", "Item size"), Map.entry("rotX", "Tilt"), Map.entry("rotY", "Turn"), Map.entry("rotZ", "Roll"), Map.entry("offHand", "Also the off hand"), Map.entry("anyItem", "Any held item"), Map.entry("cancelOnSwing", "Stop when you swing"), Map.entry("bladeSkin", "Blade skin"), Map.entry("bladeColor", "Blade colour"), Map.entry("bladeStrength", "Skin strength"), Map.entry("skinTools", "Skins on tools too"), Map.entry("chroma", "Chroma"), Map.entry("layers", "Glow layers"), Map.entry("pulse", "Pulse"), Map.entry("hand", "Glow on hand"), Map.entry("item", "Glow on item"), Map.entry("shape", "Shape"), Map.entry("color2", "Top colour"), Map.entry("sparkles", "Sparkles"), Map.entry("riseHeight", "Rise height"), Map.entry("self", "My totems"), Map.entry("others", "Other players' totems"), Map.entry("alias", "Your alias"), Map.entry("hideOthers", "Hide other names"), Map.entry("othersAlias", "Others' alias"), Map.entry("hotbar", "Hide hotbar items"), Map.entry("inventory", "Hide inventory items"), Map.entry("held", "Hide held item"), Map.entry("tooltips", "Hide item tooltips"), Map.entry("placeholder", "Show slot placeholders"), Map.entry("badge", "Show 'hidden' badge"), Map.entry("model", "Arm model"), Map.entry("bgOpacity", "Background opacity"), Map.entry("guiKey", "Menu key"), Map.entry("quality", "Visual quality"), Map.entry("menuTheme", "Menu theme"), Map.entry("menuFx", "Background effects"), Map.entry("offX", "Horizontal offset"), Map.entry("offY", "Vertical offset"), Map.entry("tintStrength", "Tint strength"),
            Map.entry("showArt", "Cover art"), Map.entry("showProgress", "Progress bar"), Map.entry("marquee", "Scroll long titles"), Map.entry("skyQuality", "Sky quality"), Map.entry("h24", "24-hour clock"), Map.entry("windowMs", "Window (ms)"),
            Map.entry("scrollAdjust", "Scroll to change zoom"), Map.entry("skipFront", "Skip front view with F5"), Map.entry("hideRain", "Hide rain splashes"), Map.entry("multiplier", "Amount kept"), Map.entry("level", "Brightness"), Map.entry("graphWidth", "Graph width (px)"), Map.entry("showGraph", "Frame graph"), Map.entry("dynamic", "Widen while moving"),
            Map.entry("bgColor", "Background colour"), Map.entry("radius", "Corner radius"), Map.entry("textMode", "Text colour"), Map.entry("chromaSpeed", "Colour speed"),
            Map.entry("keySize", "Key size"), Map.entry("gap", "Key gap"), Map.entry("labels", "Key labels"), Map.entry("spaceStyle", "Space bar"), Map.entry("showModifiers", "Sneak and sprint keys"),
            Map.entry("fadeMs", "Release fade (ms)"), Map.entry("keyStyle", "Key style"), Map.entry("pressedText", "Pressed text colour"), Map.entry("pressedOpacity", "Pressed opacity"), Map.entry("showSpace", "Space bar key"), Map.entry("showMouse", "Mouse buttons"), Map.entry("showCps", "CPS on mouse buttons"));
    /** Focus order for keyboard users: search, categories, then cards (grid) or rows (settings). */
    public int focusCount(Layout l) { return 2 + l.cats().size() + (open == null ? l.cards().size() : l.rows().size() + 1); }
}
