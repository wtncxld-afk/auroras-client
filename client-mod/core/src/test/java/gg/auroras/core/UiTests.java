package gg.auroras.core;

import java.nio.file.*;
import java.util.*;

/** Design tokens, UI kit maths and the in-game module menu. Run: java -cp out gg.auroras.core.UiTests ../../visuals */
public class UiTests {
    static int pass, fail;
    static void check(String n, boolean ok, Object... info) { if (ok) pass++; else fail++; System.out.println((ok ? "PASS  " : "FAIL  ") + n + (ok || info.length == 0 ? "" : "  " + Arrays.toString(info))); }
    static double lum(int c) { double[] v = new double[3]; for (int k = 0; k < 3; k++) { double x = ((c >> (16 - 8 * k)) & 255) / 255.0; v[k] = x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); } return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
    static double contrast(int a, int b) { double x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
    static final java.util.function.ToIntFunction<String> W = s -> s.length() * 6; // stand-in font: 6 px per character

    public static void main(String[] a) throws Exception {
        Path dir = Path.of(a.length > 0 ? a[0] : "../../visuals");
        UiTokens t = UiTokens.parse(Files.readString(dir.resolve("design-tokens.json")));
        // tokens
        check("tokens: every required color is defined", UiTokens.REQUIRED.stream().allMatch(t.color::containsKey));
        double tb = contrast(t.c("text"), t.c("bg")), ts1 = contrast(t.c("text"), t.c("s1")), mb = contrast(t.c("mute"), t.c("bg")), ms2 = contrast(t.c("mute"), t.c("s2")), ink = contrast(t.c("accInk"), t.c("acc")), accBg = contrast(t.c("acc"), t.c("bg"));
        check("contrast: body text on the background and on panels is at least 7:1 (WCAG AAA)", tb >= 7 && ts1 >= 7, tb, ts1);
        check("contrast: secondary text is at least 4.5:1 on the background and raised surfaces (WCAG AA)", mb >= 4.5 && ms2 >= 4.5, mb, ms2);
        check("contrast: text on the accent (primary buttons) is at least 4.5:1, and the accent on the background at least 3:1", ink >= 4.5 && accBg >= 3, ink, accBg);
        check("contrast: status colors are readable on panels (3:1 for non-text marks)", contrast(t.c("ok"), t.c("s1")) >= 3 && contrast(t.c("warn"), t.c("s1")) >= 3 && contrast(t.c("err"), t.c("s1")) >= 3);
        check("tokens: spacing is a 4-pixel scale and radii grow s < m < l", t.space.values().stream().allMatch(v -> v % 4 == 0) && t.radius.get("s") < t.radius.get("m") && t.radius.get("m") < t.radius.get("l"));
        check("tokens: motion is quick (fast < base < slow <= 300 ms)", t.fast < t.base && t.base < t.slow && t.slow <= 300);
        check("tokens: the easing curve starts at 0, ends at 1 and never runs backwards", Math.abs(t.easeAt(0)) < 1e-6 && Math.abs(t.easeAt(1) - 1) < 1e-6 && mono(t));
        check("tokens: argb applies opacity; broken files are refused", t.argb("acc", 0.5) == (0x80000000 | t.c("acc")) && iae(() -> UiTokens.parse("{\"schema\":1,\"color\":{}}")) && iae(() -> UiTokens.parse("{\"schema\":2}")));
        // ui kit
        check("text fitting: short text is untouched, long text ends with an ellipsis inside the width", UiKit.ellipsize("Clock", 60, W).equals("Clock") && UiKit.ellipsize("Background opacity", 60, W).equals("Backgroun…") && W.applyAsInt(UiKit.ellipsize("Background opacity", 60, W)) <= 60);
        check("wrapping: at most n lines, the last one ellipsized", UiKit.wrap("one two three four five six seven", 60, 2, W).equals(List.of("one two", "three f…")) || UiKit.wrap("one two three four five six seven", 60, 2, W).size() == 2);
        check("slider: mouse position snaps to the step and clamps; knob position round-trips", UiKit.sliderValue(150, 100, 100, 0, 2, 0.01) == 1.0 && UiKit.sliderValue(-5, 100, 100, 0, 2, 0.01) == 0 && UiKit.sliderValue(999, 100, 100, 0, 2, 0.01) == 2 && UiKit.sliderPos(1.0, 100, 100, 0, 2) == 150);
        check("slider: keyboard nudges one step, shift ten, within range", UiKit.sliderNudge(1.0, 0, 2, 0.01, 1, false) == 1.01 && UiKit.sliderNudge(1.95, 0, 2, 0.01, 1, true) == 2.0);
        check("segmented: hit testing by segment widths", UiKit.segmentAt(5, 0, new int[]{30, 40, 20}) == 0 && UiKit.segmentAt(45, 0, new int[]{30, 40, 20}) == 1 && UiKit.segmentAt(95, 0, new int[]{30, 40, 20}) == -1);
        check("scrolling: clamped to content, brings items into view, thumb only when needed", UiKit.clampScroll(500, 300, 100) == 200 && UiKit.scrollTo(0, 150, 20, 100) == 70 && UiKit.thumb(0, 80, 100, 12) == null && UiKit.thumb(100, 300, 100, 12)[1] == 33);
        check("grid: columns from width and card width fill the row", UiKit.columns(300, 132, 6) == 2 && UiKit.cardWidth(300, 2, 6) == 147 && UiKit.columns(50, 132, 6) == 1);
        Config.Registry reg = new Config.Registry();
        check("controls: chosen by setting type, the same rule as the launcher", UiKit.controlFor(reg.get("fps").setting("shadow")) == UiKit.Control.SWITCH && UiKit.controlFor(reg.get("fps").setting("style")) == UiKit.Control.SEGMENTED
            && UiKit.controlFor(reg.get("fps").setting("anchor")) == UiKit.Control.DROPDOWN && UiKit.controlFor(reg.get("fps").setting("color")) == UiKit.Control.COLOR && UiKit.controlFor(reg.get("sky").setting("brightness")) == UiKit.Control.SLIDER);
        check("animation: approach is frame-rate independent", Math.abs(UiKit.approach(0, 1, 0.1, 0.1) - (1 - Math.exp(-1))) < 1e-12 && Math.abs(UiKit.approach(UiKit.approach(0, 1, 0.05, 0.1), 1, 0.05, 0.1) - UiKit.approach(0, 1, 0.1, 0.1)) < 1e-12);
        // module menu
        Config.ProfileManager pm = new Config.ProfileManager(reg); ModuleMenu mm = new ModuleMenu(reg, pm);
        for (int[] sz : new int[][]{{320, 240}, {427, 240}, {480, 270}, {640, 360}, {960, 540}, {860, 270}}) {
            ModuleMenu.Layout l = mm.layout(sz[0], sz[1]); boolean inside = l.panel().x() >= 0 && l.panel().right() <= sz[0] && l.panel().y() >= 0 && l.panel().bottom() <= sz[1];
            boolean cards = l.cards().stream().allMatch(c -> c.r().x() >= l.body().x() && c.r().right() <= l.body().right() && c.sw().right() <= c.r().right());
            check("menu layout " + sz[0] + "x" + sz[1] + ": panel on screen, cards inside the body, search and button don't overlap", inside && cards && l.search().right() <= l.hudBtn().x() && l.search().w() >= 60, l.panel());
        }
        ModuleMenu.Layout l = mm.layout(480, 270);
        check("menu: categories list All first and every category with modules", l.cats().get(0).equals("All") && l.cats().contains("HUD & Overlays") && l.cats().size() == l.catRects().size());
        mm.setQuery("sky"); check("menu: search filters cards and resets scroll", mm.layout(480, 270).cards().stream().allMatch(c -> (c.m().name() + c.m().cat().label + c.m().note()).toLowerCase().contains("sky")) && mm.scroll == 0);
        mm.setQuery(""); mm.setCategory("HUD & Overlays"); check("menu: category filter", mm.visible().stream().allMatch(m -> m.cat() == Config.Category.HUD));
        mm.setCategory("All"); ModuleMenu.Layout lg = mm.layout(480, 270); mm.scrollBy(lg, -100); double sc = mm.scroll; mm.scrollBy(lg, -1000);
        check("menu: scrolling stops at the end of the grid", sc > 0 && mm.scroll == UiKit.clampScroll(1e9, lg.content(), lg.body().h()));
        check("menu: switching a module on and off", mm.toggle("fps") && pm.enabled("fps") && mm.toggle("fps") && !pm.enabled("fps"));
        Config.Module unavailable = reg.modules().stream().filter(m -> !m.available()).findFirst().get();
        check("menu: unavailable modules can't be switched on and say why", !mm.toggle(unavailable.id()) && !pm.enabled(unavailable.id()) && mm.message.contains("isn't in the game yet"));
        mm.openSettings("fps"); ModuleMenu.Layout ls = mm.layout(480, 270);
        check("settings: rows for the module's settings, without the switch or HUD position, plus a HUD editor link", ls.rows().stream().noneMatch(r -> ModuleMenu.HIDDEN.contains(r.d().key())) && ls.hudLink() != null && ls.rows().size() == reg.get("fps").settings().size() - 4);
        Config.SettingDef op = reg.get("fps").setting("opacity"), style = reg.get("fps").setting("style"), shadow = reg.get("fps").setting("shadow"), col = reg.get("fps").setting("color");
        ModuleMenu.Row opRow = ls.rows().stream().filter(r -> r.d() == op).findFirst().get(); mm.slide(op, opRow.ctl().x() + opRow.ctl().w() / 2.0, opRow.ctl());
        check("settings: dragging a slider stores a valid value in the game's format", mm.value(op).equals("55") && mm.changed(op), mm.value(op));
        mm.nudge(op, 1, true); mm.nudge(style, 1, false); mm.nudge(shadow, 1, false); mm.nudge(col, 1, false);
        check("settings: keys and scrolling nudge sliders, cycle choices, flip switches and step through colors", mm.value(op).equals("65") && mm.value(style).equals("compact") && mm.value(shadow).equals("false") && mm.value(col).equals("E8ECF4"));
        mm.reset(op); mm.reset(style); check("settings: reset restores the default", mm.value(op).equals(op.def()) && !mm.changed(op) && mm.value(style).equals("minimal"));
        check("settings: values display as the launcher shows them", mm.display(style).equals("Minimal") && mm.display(shadow).equals("Off") && ModuleMenu.label("bgOpacity").equals("Background opacity") && ModuleMenu.label("showFrameTime").equals("Show frame time"));
        mm.back(); check("settings: back returns to the grid", mm.open == null && mm.layout(480, 270).rows().isEmpty());
        mm.openSettings("sky"); ModuleMenu.Layout lsky = mm.layout(320, 240);
        check("settings: long modules scroll, controls stay inside the panel", lsky.content() > lsky.body().h() && lsky.rows().stream().allMatch(r -> r.ctl().right() <= lsky.body().right() && r.ctl().x() >= lsky.body().x()));
        check("menu: keyboard focus order covers search, categories and rows", mm.focusCount(lsky) == 2 + lsky.cats().size() + lsky.rows().size() + 1 && UiKit.nextFocus(-1, 5, 1) == 0 && UiKit.nextFocus(4, 5, 1) == 0 && UiKit.nextFocus(0, 5, -1) == 4);
        // smooth shapes (UiArt)
        int[] dk = UiArt.disk(12); int dc = dk[12 * 24 + 12] >>> 24, dcorner = dk[0] >>> 24, dedge = dk[12 * 24] >>> 24;
        check("art: a disk is solid inside, clear in the corners, and its edge is anti-aliased", dc == 255 && dcorner == 0 && dedge > 0 && dedge < 255, dc, dcorner, dedge);
        int[] rg = UiArt.ring(12, 1.5); check("art: a ring is clear in the middle with a solid outline", (rg[12 * 24 + 12] >>> 24) == 0 && (rg[12 * 24] >>> 24) > 200);
        int[] sh = UiArt.shadow(8, 10); int ss = 36; boolean fades = true; for (int x = 18; x < 35; x++) fades &= (sh[18 * ss + x] >>> 24) >= (sh[18 * ss + x + 1] >>> 24);
        check("art: a shadow is opaque at the centre and fades out steadily to clear", (sh[18 * ss + 18] >>> 24) == 255 && (sh[18 * ss + 35] >>> 24) < 8 && fades);
        int[] rp = UiArt.ramp(16); check("art: a ramp runs from opaque to clear", (rp[0] >>> 24) > 240 && (rp[15] >>> 24) < 16 && (rp[0] & 0xFFFFFF) == 0xFFFFFF);
        float[] half = new float[128 * 128]; for (int y = 0; y < 128; y++) for (int x = 0; x < 64; x++) half[y * 128 + x] = 1;
        int[] ic = UiArt.icon(half, 128, 128, 15); int mid = ic[7 * 15 + 7] >>> 24;
        check("art: icons shrink by area averaging (a half-covered pixel comes out half opaque)", (ic[7 * 15] >>> 24) == 255 && (ic[7 * 15 + 14] >>> 24) == 0 && mid > 100 && mid < 155, mid);
        // menu themes and their background effects (MenuTheme)
        Config.Registry treg = new Config.Registry();
        check("themes: every theme id is a valid setting, others are refused, and Aurora is the default", MenuTheme.IDS.stream().allMatch(id -> treg.validate(Config.Registry.MENU_THEME, id) == null) && treg.validate(Config.Registry.MENU_THEME, "neon") != null
            && treg.defaults().get(Config.Registry.MENU_THEME).equals("aurora") && treg.validate(Config.Registry.MENU_FX, "false") == null && MenuTheme.of("nope").id().equals("aurora"));
        check("themes: each has its own accent and effect", MenuTheme.THEMES.stream().map(MenuTheme.Theme::acc).distinct().count() == MenuTheme.THEMES.size() && MenuTheme.THEMES.stream().map(MenuTheme.Theme::fx).distinct().count() == MenuTheme.THEMES.size());
        MenuTheme.Effect sak = new MenuTheme.Effect(MenuTheme.of("sakura"), 1, 7); double[] y0 = new double[sak.ps.length]; for (int k = 0; k < y0.length; k++) y0[k] = sak.ps[k].y;
        sak.update(1 / 60.0, false); int down = 0; for (int k = 0; k < y0.length; k++) if (sak.ps[k].y > y0[k]) down++; boolean y1 = down >= y0.length * 0.9, y0ok = true;
        boolean onScreen = true; for (int f = 0; f < 6000; f++) sak.update(1 / 60.0, false); for (MenuTheme.P q : sak.ps) onScreen &= q.x >= -0.06 && q.x <= 1.06 && q.y >= -0.06 && q.y <= 1.06;
        check("effects: sakura petals fall and keep coming back from the top (none lost after 100 s)", sak.ps.length > 20 && y1 && onScreen, down);
        MenuTheme.Effect emb = new MenuTheme.Effect(MenuTheme.of("ember"), 1, 3); double[] e0 = new double[emb.ps.length]; for (int k = 0; k < e0.length; k++) e0[k] = emb.ps[k].y; emb.update(1 / 60.0, false);
        int up = 0; for (int k = 0; k < e0.length; k++) if (emb.ps[k].y < e0[k]) up++; check("effects: embers rise", up >= e0.length * 0.9, up, e0.length);
        MenuTheme.Effect still = new MenuTheme.Effect(MenuTheme.of("frost"), 1, 5); double sx = still.ps[0].x, sy = still.ps[0].y; still.update(0.5, true);
        check("effects: reduced motion keeps everything still; amount scales the count", still.ps[0].x == sx && still.ps[0].y == sy && new MenuTheme.Effect(MenuTheme.of("frost"), 0.5, 5).ps.length == still.ps.length / 2 && new MenuTheme.Effect(MenuTheme.of("frost"), 0, 5).ps.length == 0);
        MenuTheme.Effect a60 = new MenuTheme.Effect(MenuTheme.of("void"), 1, 9), a30 = new MenuTheme.Effect(MenuTheme.of("void"), 1, 9); for (int f = 0; f < 60; f++) a60.update(1 / 60.0, false); for (int f = 0; f < 30; f++) a30.update(1 / 30.0, false);
        check("effects: motion is frame-rate independent (30 and 60 fps end in the same place)", Math.abs(a60.ps[0].x - a30.ps[0].x) < 1e-9 && Math.abs(a60.ps[0].y - a30.ps[0].y) < 1e-9);
        boolean readable = true; for (MenuTheme.Theme th : MenuTheme.THEMES) { UiTokens tt = t.themed(th); readable &= contrast(tt.c("text"), tt.c("s1")) >= 7 && contrast(tt.c("mute"), tt.c("s2")) >= 4.5 && contrast(tt.c("accInk"), tt.c("acc")) >= 4.5 && contrast(tt.c("acc"), tt.c("bg")) >= 3; }
        check("themes: every theme keeps text readable (7:1 body, 4.5:1 secondary, accents 3:1 on the background)", readable);
        int[] pt = UiArt.petal(32); check("art: a petal is solid in the middle and clear in the corners", (pt[16 * 32 + 16] >>> 24) > 200 && (pt[0] >>> 24) == 0 && (pt[16 * 32] >>> 24) < 40);
        gameMenus(dir);
        System.out.println("\n" + pass + " passed, " + fail + " failed"); if (fail > 0) System.exit(1);
    }
    /** The Auroras main menu and pause menu (core GameMenus) and their settings. */
    static void gameMenus(Path dir) {
        List<GameMenus.Item> ti = GameMenus.titleItems(true), tOff = GameMenus.titleItems(false);
        check("main menu: Singleplayer, Multiplayer, Join VexVanilla, Auroras menu, Options and Quit, in that order", ti.stream().map(GameMenus.Item::id).toList().equals(List.of("singleplayer", "multiplayer", "vexvanilla", "auroras", "options", "quit")));
        check("main menu: Join VexVanilla goes to vexvanilla.net and is shown with its address", GameMenus.VEX_ADDRESS.equals("vexvanilla.net") && ti.get(2).hint().equals("vexvanilla.net") && ti.get(2).label().equals("Join VexVanilla"));
        check("main menu: when Minecraft refuses multiplayer, Multiplayer and Join are greyed out, the rest still work", !tOff.get(1).enabled() && !tOff.get(2).enabled() && tOff.get(0).enabled() && tOff.get(5).enabled());
        List<String> sp = GameMenus.pauseItems(true, "Open to LAN", true).stream().map(GameMenus.Item::id).toList(), mp = GameMenus.pauseItems(false, null, false).stream().map(GameMenus.Item::id).toList();
        check("pause menu: the world button (Open to LAN) only when the release has one here; the last button saves and quits or disconnects", sp.contains("world") && !mp.contains("world") && sp.get(sp.size() - 1).equals("disconnect")
            && GameMenus.pauseItems(true, "Open to LAN", true).get(sp.size() - 1).label().equals("Save and quit to title") && GameMenus.pauseItems(false, null, false).get(mp.size() - 1).label().equals("Disconnect"));
        check("pause menu: the world button is greyed out when vanilla's is (a world already open to LAN), and keeps the release's label", !GameMenus.pauseItems(true, "Open to LAN", false).get(sp.indexOf("world")).enabled()
            && GameMenus.pauseItems(false, "World options", true).stream().anyMatch(i -> i.label().equals("World options") && i.enabled()));
        boolean icons = true; for (GameMenus.Item it : ti) icons &= Files.exists(dir.resolve("icons/" + it.icon() + ".a8")); for (GameMenus.Item it : GameMenus.pauseItems(true, "Open to LAN", true)) icons &= Files.exists(dir.resolve("icons/" + it.icon() + ".a8"));
        check("menus: every button's icon is bundled", icons);
        // layout on common GUI sizes (1080p at scale 2-4, 720p at 2, a tiny 320x240 window) and both main menu layouts
        boolean fits = true, noOverlap = true, halves = true; String why = "";
        for (int[] s : new int[][]{{960, 540}, {640, 360}, {480, 270}, {640, 360}, {427, 240}, {320, 240}, {320, 180}}) for (String lay : new String[]{"left", "centre", "pause"}) {
            GameMenus.Layout l = lay.equals("pause") ? GameMenus.pause(s[0], s[1], GameMenus.pauseItems(true, "Open to LAN", true)) : GameMenus.title(s[0], s[1], ti, lay);
            for (GameMenus.Placed p : l.buttons()) { GameMenus.Rect r = p.r(); boolean ok = r.x() >= 0 && r.y() >= 0 && r.right() <= s[0] && r.bottom() <= s[1] - (lay.equals("pause") ? 0 : 14) && r.h() >= 15; if (!ok) why = lay + " " + s[0] + "x" + s[1] + " " + r; fits &= ok; }
            for (int i = 0; i < l.buttons().size(); i++) for (int j = i + 1; j < l.buttons().size(); j++) { GameMenus.Rect a = l.buttons().get(i).r(), b = l.buttons().get(j).r();
                if (a.x() < b.right() && b.x() < a.right() && a.y() < b.bottom() && b.y() < a.bottom()) noOverlap = false; }
            GameMenus.Rect au = l.buttons().get(l.indexOf("auroras")).r(), op = l.buttons().get(l.indexOf("options")).r(); halves &= au.y() == op.y() && au.w() == op.w();
            if (lay.equals("pause")) { fits &= l.panel().x() >= 0 && l.panel().bottom() <= s[1]; for (GameMenus.Placed p : l.buttons()) fits &= l.panel().x() < p.r().x() && p.r().right() < l.panel().right() && p.r().bottom() < l.panel().bottom(); }
        }
        check("layout: every button is on screen (above the footer), at least 15 units tall, on every common GUI size", fits, why);
        check("layout: no two buttons overlap", noOverlap);
        check("layout: half-width buttons share a row at the same width", halves);
        GameMenus.Layout left = GameMenus.title(640, 360, ti, "left"), mid = GameMenus.title(640, 360, ti, "centre");
        check("layout: 'left' keeps the column on the left third; 'centre' centres it", left.panel().right() < 640 / 2 && Math.abs(mid.panel().cx() - 320) <= 1 && mid.centred() && !left.centred());
        check("layout: the main action is the biggest button and Quit the smallest", left.buttons().get(0).r().h() > left.buttons().get(1).r().h() && left.buttons().get(5).r().h() < left.buttons().get(1).r().h());
        GameMenus.Rect sp0 = left.buttons().get(0).r();
        check("hit testing: a click on a button finds it; disabled buttons and gaps find nothing", left.hit(sp0.cx(), sp0.cy()) == 0 && left.hit(sp0.x() - 1, sp0.cy()) == -1
            && GameMenus.title(640, 360, tOff, "left").hit(left.buttons().get(1).r().cx(), left.buttons().get(1).r().cy()) == -1);
        GameMenus.Layout off = GameMenus.title(640, 360, tOff, "left");
        check("keyboard: arrows skip greyed-out buttons and wrap round", GameMenus.step(off, 0, 1) == 3 && GameMenus.step(off, 3, -1) == 0 && GameMenus.step(off, 5, 1) == 0 && GameMenus.step(off, -1, 1) == 0 && GameMenus.step(off, -1, -1) == 5);
        // motion
        boolean staggered = GameMenus.entrance(0.2, 0, false) > GameMenus.entrance(0.2, 3, false) && GameMenus.entrance(0, 0, false) == 0;
        boolean arrives = GameMenus.entrance(GameMenus.FIRST + GameMenus.STAGGER * 5 + GameMenus.DURATION, 5, false) == 1 && GameMenus.settled(GameMenus.FIRST + GameMenus.STAGGER * 5 + GameMenus.DURATION, 6) && !GameMenus.settled(0.2, 6);
        boolean monotone = true; double prev = -1; for (int k = 0; k <= 100; k++) { double v = GameMenus.entrance(k / 100.0, 2, false); monotone &= v >= prev && v >= 0 && v <= 1; prev = v; }
        check("motion: buttons slide in one after another, ease out smoothly and all arrive", staggered && arrives && monotone);
        check("motion: reduced motion shows everything at once", GameMenus.entrance(0, 4, true) == 1 && GameMenus.fadeIn(0, true) == 1 && GameMenus.fadeIn(0, false) == 0);
        // settings
        Config.Registry reg = new Config.Registry(); Config.ProfileManager pm = new Config.ProfileManager(reg);
        check("settings: custom main menu and pause menu are on by default, main menu layout is left", pm.get(Config.Registry.CUSTOM_TITLE).equals("true") && pm.get(Config.Registry.CUSTOM_PAUSE).equals("true") && pm.get(Config.Registry.TITLE_LAYOUT).equals("left"));
        check("settings: the toggles take true or false, the layout left or centre, nothing else", reg.validate(Config.Registry.CUSTOM_TITLE, "false") == null && reg.validate(Config.Registry.CUSTOM_PAUSE, "1") != null
            && reg.validate(Config.Registry.TITLE_LAYOUT, "centre") == null && reg.validate(Config.Registry.TITLE_LAYOUT, "right") != null);
        ModuleMenu mm = new ModuleMenu(reg, pm); mm.openSettings("settings"); List<String> keys = mm.layout(480, 270).rows().stream().map(r -> r.d().key()).toList();
        check("settings page: Custom main menu, its layout and Custom pause menu are listed under Settings", keys.containsAll(List.of("customTitle", "titleLayout", "customPause")) && ModuleMenu.label("customTitle").equals("Custom main menu") && ModuleMenu.label("customPause").equals("Custom pause menu"));
        GameMenus.Item title0 = ti.get(0); mm.set(mm.openModule().setting("customPause"), "false");
        check("settings page: switching Custom pause menu off writes settings.customPause (the game then shows vanilla's)", pm.get(Config.Registry.CUSTOM_PAUSE).equals("false") && title0.enabled());
    }
    static boolean mono(UiTokens t) { double p = -1; for (int k = 0; k <= 50; k++) { double v = t.easeAt(k / 50.0); if (v < p - 1e-9) return false; p = v; } return true; }
    static boolean iae(Runnable r) { try { r.run(); return false; } catch (IllegalArgumentException | ClassCastException | NullPointerException e) { return true; } }
}
