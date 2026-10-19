package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. The in-game Auroras menu (Right Shift): category rail, search, module cards and a
// settings panel per module, drawn with the shared design tokens (AUi). Every rule about layout, filtering, editing and
// limits lives in core ModuleMenu and is unit-tested there; this screen draws what it returns and forwards input.
// Keyboard: Tab / Shift+Tab move focus, arrows change the focused control, Enter toggles or opens, Esc goes back.
// Motion: every animation runs on real frame time (smooth at any frame rate) and on sub-pixel offsets, so nothing steps:
// the panel rises and grows in and out, pages slide in, cards ease their hover, and the wheel scrolls smoothly.

import gg.auroras.client.platform.Mc;
import gg.auroras.client.platform.AScreen;
import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Keys;
import gg.auroras.client.ui.AUi;
import gg.auroras.client.ui.Glass;
import gg.auroras.core.*;

import java.util.HashMap;
import java.util.Map;

public class ModuleScreen extends AScreen {
    private final ModuleMenu menu = new ModuleMenu(AurorasClient.REG, AurorasClient.PM);
    private ModuleMenu.Layout L; private boolean searching; private long caretT0 = System.nanoTime();
    private double openAnim, contentAnim = 1, frameDt = 1 / 60.0, shownScroll; private boolean closing; private long last = System.nanoTime();
    private final Map<String, Double> hoverAnim = new HashMap<>();
    private final Map<String, Double> knob = new HashMap<>(); private String dragging, listening; private int focus = -1;
    private static String lastCategory = "All";
    private final net.minecraft.client.gui.screens.Screen parent; private final String section;

    public ModuleScreen() { this("All modules", null, null); menu.setCategory(lastCategory); }
    private ModuleScreen(String section, java.util.List<String> cats, net.minecraft.client.gui.screens.Screen parent) { super("Auroras Client"); this.section = section; this.parent = parent; menu.group(cats); }
    /** One section of the radial menu (its categories only); Esc goes back to the radial menu. */
    public static ModuleScreen section(String title, java.util.List<String> cats, net.minecraft.client.gui.screens.Screen parent) { return new ModuleScreen(title, cats, parent); }
    /** The client's own settings (menu key, visual quality). */
    public static ModuleScreen settings(net.minecraft.client.gui.screens.Screen parent) { ModuleScreen s = new ModuleScreen("Settings", null, parent); s.menu.openSettings(ModuleMenu.CLIENT.id()); return s; }

    @Override protected void init() { L = menu.layout(width, height); }
    /** The search box is drawn and edited here (no vanilla text field), so it looks and behaves the same in every version. */
    private void setQuery(String q) { menu.setQuery(q.length() > 40 ? q.substring(0, 40) : q); L = menu.layout(width, height); caretT0 = System.nanoTime(); }
    private boolean reduced() { return AurorasModules.reducedMotion(); }

    @Override protected void draw(Gfx c, int mx, int my, float delta) {
        long now = System.nanoTime(); double dt = Math.min(0.1, (now - last) / 1e9); last = now; frameDt = dt; boolean rm = reduced();
        if (closing) { openAnim = rm ? 0 : UiKit.approach(openAnim, 0, dt, AurorasModules.tau(0.035)); if (openAnim < 0.03) { closing = false; finishClose(); return; } }
        else openAnim = rm ? 1 : UiKit.approach(openAnim, 1, dt, AurorasModules.tau(0.06));
        contentAnim = rm ? 1 : UiKit.approach(contentAnim, 1, dt, AurorasModules.tau(0.05));
        shownScroll = rm ? menu.scroll : UiKit.approach(shownScroll, menu.scroll, dt, AurorasModules.tau(0.045)); if (Math.abs(shownScroll - menu.scroll) < 0.05) shownScroll = menu.scroll;
        L = menu.layout(width, height); UiTokens t = AUi.tokens(); double a = openAnim, ease = Motion.out(a);
        c.fill(0, 0, width, height, AUi.fade(0xFF05070C, 0.46 * a));
        Glass.vgrad(c, 0, 0, width, height * 0.4, AUi.fade(0xFF05070C, 0.35 * a), 0);
        ModuleMenu.Rect p = L.panel(); int lift = (int) Math.round((1 - ease) * 8); float zoom = (float) (0.975 + 0.025 * ease);
        // grow from the panel's centre with a sub-pixel rise; hit testing uses the rounded lift (the difference is under a pixel)
        c.push(); c.translate((float) (p.x() + p.w() / 2.0), (float) (p.y() + p.h() / 2.0 + (1 - ease) * 8)); c.scale(zoom); c.translate((float) -(p.x() + p.w() / 2.0), (float) -(p.y() + p.h() / 2.0));
        drawFrame(c, p, t, a);
        drawRail(c, p, mx, my - lift, t);
        drawTop(c, p, mx, my - lift, t);
        // body (clipped so scrolled content never draws outside the panel)
        ModuleMenu.Rect b = L.body();
        c.scissor(b.x() - 4, b.y(), b.right() + 4, b.bottom()); // inside the lift transform, so in panel coordinates
        // a new page slides up into place; the wheel glides (content is laid out at the real scroll and drawn offset to the shown one)
        float slide = (float) ((1 - Motion.out(contentAnim)) * 6), glide = (float) (menu.scroll - shownScroll);
        c.push(); c.translate(0, slide + glide); int cull = (int) Math.ceil(Math.abs(glide) + slide);
        if (menu.open == null) drawGrid(c, mx, my - lift, t, cull); else drawSettings(c, mx, my - lift, t, cull);
        c.pop();
        c.noScissor();
        // soft fades where content scrolls under the top bar and the panel's bottom edge
        if (menu.scroll > 1) Glass.vgrad(c, b.x() - 4, b.y(), b.w() + 8, 8, t.argb("s1", 0.9), 0);
        AUi.scrollbar(c, b.right() + 4, b.y() + 2, b.h() - 4, menu.scroll, L.content());
        if (!menu.message.isEmpty()) { double w = Glass.width("medium", 7.5, menu.message) + 20, x = p.x() + ModuleMenu.RAIL + (p.w() - ModuleMenu.RAIL - w) / 2;
            Glass.shadow(c, x, p.bottom() - 26, w, 18, 9, 8, AUi.fade(0xFF000000, 0.5)); Glass.rect(c, x, p.bottom() - 26, w, 18, 9, t.opaque("s3")); Glass.outline(c, x, p.bottom() - 26, w, 18, 9, AUi.fade(t.opaque("warn"), 0.45));
            Glass.label(c, "medium", 7.5, menu.message, x + 10, p.bottom() - 17, 0, t.opaque("warn")); }
        c.pop();
        tooltip(c, mx, my - lift);
    }
    static final int WHITE = 0xFFFFFFFF, R = 10;
    /** The glass panel: deep shadow, frosted body, the rail's darker side, a soft top sheen and a hairline rim. */
    private void drawFrame(Gfx c, ModuleMenu.Rect p, UiTokens t, double a) {
        Glass.shadow(c, p.x(), p.y() + 8, p.w(), p.h(), R + 4, 26, AUi.fade(0xFF000000, 0.6 * a));
        Glass.rect(c, p.x(), p.y(), p.w(), p.h(), R, AUi.fade(t.argb("s1", 0.95), a));
        Glass.rect(c, p.x(), p.y(), ModuleMenu.RAIL, p.h(), R, AUi.fade(t.argb("side", 0.97), a)); c.fill(p.x() + ModuleMenu.RAIL - R, p.y(), p.x() + ModuleMenu.RAIL, p.bottom(), AUi.fade(t.argb("side", 0.97), a));
        // a soft aurora glow behind the logo, the brand's one flourish
        Glass.shadow(c, p.x() + 12, p.y() + 12, 14, 14, 7, 22, AUi.fade(t.opaque("acc"), 0.16 * a));
        Glass.vgrad(c, p.x() + ModuleMenu.RAIL, p.y() + 0.5, p.w() - ModuleMenu.RAIL - R, 50, AUi.fade(WHITE, 0.025 * a), 0);
        Glass.rect(c, p.x() + ModuleMenu.RAIL, p.y() + 12, 0.5, p.h() - 24, 0, AUi.fade(WHITE, 0.07 * a));
        Glass.outline(c, p.x(), p.y(), p.w(), p.h(), R, AUi.fade(WHITE, 0.1 * a));
    }
    /** Brand, categories and the profile card. */
    private void drawRail(Gfx c, ModuleMenu.Rect p, int mx, int my, UiTokens t) {
        c.texture(HudRenderer.LOGO, p.x() + 10, p.y() + 10, 18, 18, 0xFFFFFFFF);
        Glass.text(c, "semibold", 10, "Auroras", p.x() + 33, p.y() + 19, t.opaque("text"));
        Glass.text(c, "medium", 6.5, "Client", p.x() + 33, p.y() + 27.5, t.opaque("mute"));
        for (int k = 0; k < L.cats().size(); k++) {
            ModuleMenu.Rect r = L.catRects().get(k); String cat = L.cats().get(k); boolean on = cat.equals(menu.category) && menu.open == null, hov = r.contains(mx, my);
            if (r.bottom() > p.bottom() - 42) break; // never under the profile card on short screens
            double h = ease("cat:" + cat, hov && !on ? 1 : 0, 0.04), s = ease("catOn:" + cat, on ? 1 : 0, 0.05);
            if (h > 0.01) Glass.rect(c, r.x(), r.y(), r.w(), r.h(), 6, AUi.fade(WHITE, 0.05 * h));
            if (s > 0.01) { Glass.rect(c, r.x(), r.y(), r.w(), r.h(), 6, AUi.fade(t.opaque("acc"), 0.13 * s)); Glass.outline(c, r.x(), r.y(), r.w(), r.h(), 6, AUi.fade(t.opaque("acc"), 0.22 * s));
                Glass.rect(c, r.x() - 5, r.y() + 9 - 4 * s, 2, 8 * s, 1, AUi.fade(t.opaque("acc"), s)); }
            int col = AUi.mix(AUi.mix(t.opaque("mute"), t.opaque("text"), h), t.opaque("acc"), s);
            Glass.icon(c, AUi.categoryIcon(cat), r.x() + 6, r.y() + 4.5, 9, col);
            Glass.label(c, "medium", 7.5, cat, r.x() + 20, r.y() + r.h() / 2.0, r.w() - 24, AUi.mix(col, t.opaque("text"), s * 0.6));
            if (focus == 2 + k) AUi.focusRing(c, r.x(), r.y(), r.w(), r.h());
        }
        // profile card: your face and name, the active profile and the game version
        double cx = p.x() + 8, cy = p.bottom() - 38, cw = ModuleMenu.RAIL - 16;
        Glass.rect(c, cx, cy, cw, 30, 8, AUi.fade(WHITE, 0.04)); Glass.outline(c, cx, cy, cw, 30, 8, AUi.fade(WHITE, 0.07));
        if (Glass.face != null) { Glass.rect(c, cx + 6, cy + 6, 18, 18, 4, AUi.fade(0xFF000000, 0.4)); c.push(); c.translate((float) (cx + 7), (float) (cy + 7)); c.texture(Glass.face, 0, 0, 16, 16, WHITE); c.pop(); }
        else { Glass.circle(c, cx + 15, cy + 15, 9, AUi.fade(t.opaque("acc"), 0.25)); Glass.labelCentred(c, "semibold", 8, Glass.player.isEmpty() ? "?" : Glass.player.substring(0, 1).toUpperCase(), cx + 15, cy + 15, t.opaque("acc")); }
        Glass.label(c, "semibold", 7.5, Glass.player, cx + 30, cy + 11, cw - 36, t.opaque("text"));
        Glass.label(c, "medium", 6, AurorasClient.PM.active() + " · " + AurorasClient.mcVersion, cx + 30, cy + 21, cw - 36, t.opaque("mute"));
    }
    /** Page title, search and the HUD editor button. */
    private void drawTop(Gfx c, ModuleMenu.Rect p, int mx, int my, UiTokens t) {
        ModuleMenu.Rect s = L.search(), top = L.top(); double titleW = s.x() - top.x() - ModuleMenu.PAD - 8;
        if (titleW > 30) {
            String title = menu.open != null ? section : menu.category.equals("All") ? section : menu.category;
            String sub = menu.open != null ? (ModuleMenu.CLIENT.id().equals(menu.open) ? "Client" : "Module settings") : L.cards().size() + (L.cards().size() == 1 ? " module" : " modules");
            Glass.text(c, "semibold", 11, Glass.fit("semibold", 11, title, titleW), top.x() + ModuleMenu.PAD, p.y() + 19, t.opaque("text"));
            Glass.text(c, "medium", 6.5, Glass.fit("medium", 6.5, sub, titleW), top.x() + ModuleMenu.PAD, p.y() + 28.5, t.opaque("mute"));
        }
        boolean sf = searching || focus == 0, sh = s.contains(mx, my);
        Glass.rect(c, s.x(), s.y(), s.w(), s.h(), 7, t.argb("bg", 0.62));
        Glass.outline(c, s.x(), s.y(), s.w(), s.h(), 7, sf ? AUi.fade(t.opaque("acc"), 0.85) : AUi.fade(WHITE, sh ? 0.16 : 0.08));
        if (sf) Glass.shadow(c, s.x(), s.y(), s.w(), s.h(), 7, 5, AUi.fade(t.opaque("acc"), 0.18));
        Glass.icon(c, "search", s.x() + 6, s.y() + 5, 8, sf ? t.opaque("acc") : t.opaque("faint"));
        if (menu.query.isEmpty() && !searching) Glass.label(c, "medium", 7.5, "Search modules", s.x() + 18, s.y() + s.h() / 2.0, s.w() - 22, t.opaque("faint"));
        else { String q = Glass.fit("medium", 7.5, menu.query, s.w() - 26); Glass.label(c, "medium", 7.5, q, s.x() + 18, s.y() + s.h() / 2.0, 0, t.opaque("text"));
            if (searching && ((System.nanoTime() - caretT0) / 500_000_000L) % 2 == 0) { double cx = s.x() + 18.5 + Glass.width("medium", 7.5, q); Glass.rect(c, cx, s.y() + 4.5, 0.7, s.h() - 9, 0.3, t.opaque("acc")); } }
        ModuleMenu.Rect hb = L.hudBtn(); AUi.button(c, hb.x(), hb.y(), hb.w(), hb.h(), "move", "HUD editor", false, hb.contains(mx, my), focus == 1, true);
    }
    private void drawGrid(Gfx c, int mx, int my, UiTokens t, int cull) {
        if (L.cards().isEmpty()) { ModuleMenu.Rect b = L.body(); Glass.icon(c, "search", b.x() + b.w() / 2.0 - 8, b.y() + 36, 16, t.opaque("faint"));
            Glass.labelCentred(c, "semibold", 8.5, "No modules match \"" + menu.query + "\"", b.x() + b.w() / 2.0, b.y() + 64, t.opaque("text"));
            Glass.labelCentred(c, "medium", 7, "Try another word, or clear the search", b.x() + b.w() / 2.0, b.y() + 76, t.opaque("mute")); return; }
        int i = 0;
        for (ModuleMenu.Card cd : L.cards()) {
            ModuleMenu.Rect r = cd.r(); if (r.bottom() < L.body().y() - cull || r.y() > L.body().bottom() + cull) { i++; continue; }
            Config.Module m = cd.m(); boolean av = m.available(), on = AurorasClient.PM.enabled(m.id()), hov = r.contains(mx, my) && L.body().contains(mx, my);
            double h = ease("card:" + m.id(), hov && av ? 1 : 0, 0.05), lit = ease("lit:" + m.id(), on && av ? 1 : 0, 0.06), y = r.y() - h, al = av ? 1 : 0.55; int acc = t.opaque("acc");
            Glass.shadow(c, r.x(), y + 2 + h, r.w(), r.h(), 8, 6 + 4 * h, AUi.fade(0xFF000000, 0.25 + 0.2 * h));
            if (lit > 0.01) Glass.shadow(c, r.x(), y, r.w(), r.h(), 8, 6, AUi.fade(acc, 0.13 * lit));
            Glass.rect(c, r.x(), y, r.w(), r.h(), 8, AUi.mix(AUi.mix(t.opaque("s2"), t.opaque("s3"), h), AUi.mix(t.opaque("s2"), acc, 0.07), lit));
            Glass.vgrad(c, r.x() + 6, y + 0.5, r.w() - 12, r.h() * 0.55, AUi.fade(WHITE, 0.03 + 0.02 * h), 0);
            Glass.outline(c, r.x(), y, r.w(), r.h(), 8, AUi.mix(AUi.fade(WHITE, 0.07 + 0.07 * h), AUi.fade(acc, 0.5), lit));
            // icon badge
            Glass.rect(c, r.x() + 8, y + 8, 20, 20, 6, AUi.mix(AUi.fade(WHITE, 0.06), AUi.fade(acc, 0.16), lit));
            Glass.icon(c, av ? AUi.categoryIcon(m.cat().label) : "lock", r.x() + 12.5, y + 12.5, 11, AUi.fade(av ? AUi.mix(t.opaque("mute"), acc, lit) : t.opaque("faint"), al));
            Glass.label(c, "semibold", 8, m.name(), r.x() + 34, y + 14, r.w() - 34 - 36, AUi.fade(t.opaque("text"), al));
            Glass.label(c, "medium", 6.5, av ? m.cat().label : "Coming soon", r.x() + 34, y + 25, r.w() - 34 - 36, av ? t.opaque("mute") : AUi.fade(t.opaque("warn"), 0.8));
            double k = knob(m.id(), on);
            AUi.toggle(c, cd.sw().x(), cd.sw().y() - h, k, cd.sw().contains(mx, my), av);
            if (focus == 2 + L.cats().size() + i) AUi.focusRing(c, r.x(), y, r.w(), r.h());
            i++;
        }
    }
    private void drawSettings(Gfx c, int mx, int my, UiTokens t, int cull) {
        Config.Module m = menu.openModule(); ModuleMenu.Rect b = L.body(); int y0 = b.y() - (int) Math.round(menu.scroll); int acc = t.opaque("acc");
        ModuleMenu.Rect bk = L.back(); boolean bh = bk.contains(mx, my + menu.scroll); double bhv = ease("back", bh ? 1 : 0, 0.04);
        Glass.rect(c, bk.x(), y0 + 2, 18, 18, 9, AUi.fade(WHITE, 0.06 + 0.06 * bhv)); Glass.outline(c, bk.x(), y0 + 2, 18, 18, 9, AUi.fade(WHITE, 0.08 + 0.1 * bhv));
        Glass.icon(c, "back", bk.x() + 5, y0 + 7, 8, AUi.mix(t.opaque("mute"), t.opaque("text"), bhv));
        boolean client = m == ModuleMenu.CLIENT;
        Glass.rect(c, b.x() + 24, y0 + 1, 20, 20, 6, AUi.fade(acc, 0.16)); Glass.icon(c, client ? "gear" : AUi.categoryIcon(m.cat().label), b.x() + 28.5, y0 + 5.5, 11, acc);
        Glass.label(c, "semibold", 10, m.name(), b.x() + 50, y0 + 7.5, b.w() - 90, t.opaque("text"));
        Glass.label(c, "medium", 6.5, client ? "The menu key and visual quality, for every profile" : m.impact().label, b.x() + 50, y0 + 17.5, b.w() - 90, t.opaque("mute"));
        if (!client) { String status = m.available() ? "In game · experimental" : "Not in the game yet: " + m.note(); int sc = m.available() ? t.opaque("ok") : t.opaque("warn");
            double sw = Math.min(b.w() - 50, Glass.width("semibold", 6.5, status) + 12);
            Glass.rect(c, b.x() + 50, y0 + 24, sw, 11, 5.5, AUi.fade(sc, 0.14)); Glass.label(c, "semibold", 6.5, status, b.x() + 56, y0 + 29.5, sw - 12, sc); }
        double k = knob("head:" + m.id(), AurorasClient.PM.enabled(m.id()));
        if (m != ModuleMenu.CLIENT) AUi.toggle(c, L.headSwitch().x(), y0 + 6, k, L.headSwitch().contains(mx, my + menu.scroll), m.available());
        if (L.hudLink() != null) { ModuleMenu.Rect r = L.hudLink(); boolean h = r.contains(mx, my); double hv = ease("hudlink", h ? 1 : 0, 0.04);
            Glass.rect(c, r.x(), r.y() + 2, r.w(), r.h() - 6, 7, AUi.fade(acc, 0.07 + 0.06 * hv)); Glass.outline(c, r.x(), r.y() + 2, r.w(), r.h() - 6, 7, AUi.fade(acc, 0.2 + 0.2 * hv));
            Glass.icon(c, "move", r.x() + 8, r.y() + 7, 8, acc); Glass.label(c, "medium", 7.5, "Position and size: open the HUD editor", r.x() + 22, r.y() + 11, r.w() - 30, AUi.mix(t.opaque("text"), acc, 0.5 + 0.5 * hv)); }
        // the settings sit together on one card, rows split by hairlines
        java.util.List<ModuleMenu.Row> rows = L.rows();
        if (!rows.isEmpty()) { int gy = rows.get(0).r().y(), gh = rows.get(rows.size() - 1).r().bottom() - gy;
            Glass.rect(c, b.x(), gy, b.w(), gh, 9, AUi.fade(WHITE, 0.03)); Glass.outline(c, b.x(), gy, b.w(), gh, 9, AUi.fade(WHITE, 0.07)); }
        int idx = 0;
        for (ModuleMenu.Row row : rows) {
            ModuleMenu.Rect r = row.r(); if (r.bottom() < b.y() - cull || r.y() > b.bottom() + cull) { idx++; continue; }
            Config.SettingDef d = row.d(); ModuleMenu.Rect ctl = row.ctl(); boolean hov = r.contains(mx, my) && b.contains(mx, my), foc = focus == 2 + L.cats().size() + 1 + idx; int y = r.y();
            UiKit.Control kind = UiKit.controlFor(d); boolean slider = kind == UiKit.Control.SLIDER;
            double rh = ease("row:" + menu.open + "." + d.key(), hov ? 1 : 0, 0.05); if (rh > 0.01) Glass.rect(c, r.x() + 2, y + 2, r.w() - 4, r.h() - 4, 7, AUi.fade(WHITE, 0.04 * rh));
            if (idx > 0) Glass.rect(c, r.x() + 10, y, r.w() - 20, 0.5, 0, AUi.fade(WHITE, 0.06));
            String lab = ModuleMenu.label(d.key()); boolean changed = menu.changed(d); double ly = slider ? y + 10 : y + r.h() / 2.0;
            if (changed) Glass.circle(c, r.x() + 5, ly, 1.6, acc);
            Glass.label(c, "medium", 7.5, lab, r.x() + 10, ly, slider ? r.w() - 70 : ctl.x() - r.x() - 18, t.opaque("text"));
            switch (kind) {
                case SWITCH -> { double kk = knob(menu.open + "." + d.key(), Boolean.parseBoolean(menu.value(d))); AUi.toggle(c, ctl.right() - AUi.SWITCH_W, y + (r.h() - AUi.SWITCH_H) / 2.0, kk, hov, true); }
                case SLIDER -> { String v = menu.display(d); double vw = Glass.width("semibold", 7, v) + 10;
                    Glass.rect(c, r.right() - 10 - vw, ly - 5.5, vw, 11, 5.5, AUi.fade(WHITE, 0.06)); Glass.labelCentred(c, "semibold", 7, v, r.right() - 10 - vw / 2, ly, AUi.mix(t.opaque("mute"), acc, rh));
                    AUi.slider(c, ctl.x(), ctl.y() - 2, ctl.w(), d.min(), d.max(), Double.parseDouble(menu.value(d)), hov, foc); }
                case SEGMENTED -> { java.util.List<String> labels = d.options().stream().map(UiKit::optionLabel).toList();
                    AUi.segmented(c, ctl.right() - AUi.segTotal(labels), y + 5, labels, d.options().indexOf(menu.value(d)), -1, foc); }
                case DROPDOWN -> AUi.dropdown(c, ctl.x(), y + 5, ctl.w(), menu.display(d), hov, foc);
                case COLOR -> AUi.swatch(c, ctl.right() - 58, y + 5, Integer.parseInt(menu.value(d), 16), hov, foc);
                case KEY -> AUi.button(c, ctl.right() - 70, y + 4, 70, d.key().equals(listening) ? "Press a key…" : keyName(Integer.parseInt(menu.value(d))), d.key().equals(listening), hov, foc, true);
            }
            idx++;
        }
    }
    /** A switch knob easing to on or off on real frame time (the same speed at 30, 60 or 240 fps). */
    private double knob(String id, boolean on) { return knob.merge(id, on ? 1.0 : 0.0, (o, n) -> reduced() ? n : UiKit.approach(o, n, frameDt, AurorasModules.tau(0.04))); }
    /** Any 0..1 state (hover, lit) eased the same way. */
    private double ease(String id, double target, double tau) { return hoverAnim.merge(id, target, (o, n) -> reduced() ? n : UiKit.approach(o, n, frameDt, AurorasModules.tau(tau))); }
    /** Smooth ease-out for open and slide-in progress. */
    static final class Motion { static double out(double x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); } }
    private void tooltip(Gfx c, int mx, int my) {
        if (menu.open == null) for (ModuleMenu.Card cd : L.cards()) { if (cd.r().contains(mx, my) && L.body().contains(mx, my)) { Config.Module m = cd.m(); AUi.tooltip(c, m.available() ? m.name() + ": " + m.impact().label : m.name() + " isn't in the game yet. " + m.note(), mx, my, width, height); return; } }
        else for (ModuleMenu.Row r : L.rows()) if (r.r().contains(mx, my) && L.body().contains(mx, my) && menu.changed(r.d())) { AUi.tooltip(c, "Changed from the default. Right-click to reset.", mx, my, width, height); return; }
    }
    static String keyName(int code) { if (code < 0) return "Unbound"; if (code >= 65 && code <= 90) return String.valueOf((char) code); if (code >= 48 && code <= 57) return String.valueOf((char) code);
        return switch (code) { case 32 -> "Space"; case 340 -> "Left Shift"; case 344 -> "Right Shift"; case 341 -> "Left Ctrl"; case 342 -> "Left Alt"; case 258 -> "Tab"; default -> "Key " + code; }; }

    // ---- input ----
    @Override protected boolean click(double mx, double my, int button) {
        if (closing) return true;
        searching = L.search().contains(mx, my); if (searching) { focus = 0; caretT0 = System.nanoTime(); return true; }
        if (L.hudBtn().contains(mx, my)) { Mc.setScreen(minecraft, new HudEditorScreen(this)); return true; }
        for (int k = 0; k < L.cats().size(); k++) if (L.catRects().get(k).contains(mx, my)) { menu.back(); menu.setCategory(L.cats().get(k)); lastCategory = menu.category; contentAnim = 0; focus = 2 + k; return true; }
        if (!L.body().contains(mx, my)) return false;
        if (menu.open == null) {
            for (ModuleMenu.Card cd : L.cards()) {
                if (cd.sw().contains(mx, my)) { menu.toggle(cd.m().id()); AurorasClient.save(); return true; }
                if (cd.r().contains(mx, my)) { menu.openSettings(cd.m().id()); contentAnim = 0; return true; }
            }
            return true;
        }
        if (L.back() != null && L.back().contains(mx, my + menu.scroll)) { if (parent != null && ModuleMenu.CLIENT.id().equals(menu.open)) { closeScreen(); return true; } menu.back(); contentAnim = 0; return true; }
        if (L.headSwitch().contains(mx, my + menu.scroll)) { menu.toggle(menu.open); AurorasClient.save(); return true; }
        if (L.hudLink() != null && L.hudLink().contains(mx, my)) { Mc.setScreen(minecraft, new HudEditorScreen(this)); return true; }
        for (ModuleMenu.Row r : L.rows()) {
            if (!r.r().contains(mx, my)) continue; Config.SettingDef d = r.d();
            if (button == 1) { menu.reset(d); return true; } // right click resets
            switch (UiKit.controlFor(d)) {
                case SLIDER -> { if (r.ctl().contains(mx, my) || my >= r.ctl().y() - 3) { dragging = d.key(); menu.slide(d, mx, r.ctl()); } }
                case KEY -> listening = d.key();
                case SEGMENTED -> { java.util.List<String> labels = d.options().stream().map(UiKit::optionLabel).toList(); int[] ws = AUi.segWidths(labels);
                    int seg = UiKit.segmentAt(mx, r.ctl().right() - AUi.segTotal(labels) + 1, ws); if (seg >= 0) menu.set(d, d.options().get(seg)); }
                default -> menu.nudge(d, shift() ? -1 : 1, false);
            }
            return true;
        }
        return true;
    }
    @Override protected boolean drag(double mx, double my, int button, double dx, double dy) {
        if (dragging != null) for (ModuleMenu.Row r : L.rows()) if (r.d().key().equals(dragging)) { menu.slide(r.d(), mx, r.ctl()); return true; }
        return false;
    }
    @Override protected boolean release(double mx, double my, int button) { dragging = null; return false; }
    @Override protected boolean wheel(double mx, double my, double v) {
        if (menu.open != null) for (ModuleMenu.Row r : L.rows()) if (r.ctl().contains(mx, my) && UiKit.controlFor(r.d()) != UiKit.Control.KEY) { menu.nudge(r.d(), v > 0 ? 1 : -1, shift()); return true; }
        if (L.body().contains(mx, my)) { menu.scrollBy(L, v); return true; }
        return false;
    }
    @Override protected boolean key(int key) {
        // keys are GLFW codes here (Keys converts), the format settings files store
        if (listening != null) { for (ModuleMenu.Row r : L.rows()) if (r.d().key().equals(listening)) menu.set(r.d(), String.valueOf(key == Keys.ESCAPE ? -1 : key)); listening = null; return true; }
        if (key == Keys.ESCAPE) { if (searching) { searching = false; focus = -1; return true; } if (menu.open != null && !(parent != null && ModuleMenu.CLIENT.id().equals(menu.open))) { menu.back(); contentAnim = 0; return true; } closeScreen(); return true; }
        if (searching) { if (key == Keys.BACKSPACE && !menu.query.isEmpty()) setQuery(menu.query.substring(0, menu.query.length() - 1)); else if (key == Keys.ENTER || key == Keys.TAB) { searching = false; focus = 2 + L.cats().size(); } return true; }
        if (key == Integer.parseInt(AurorasClient.PM.get(Config.Registry.GUI_KEY))) { closeScreen(); return true; }
        int n = menu.focusCount(L);
        if (key == Keys.TAB) { focus = UiKit.nextFocus(focus, n, shift() ? -1 : 1); searching = focus == 0; revealFocus(); return true; }
        int cats = L.cats().size(), first = 2 + cats;
        if (focus >= 2 && focus < first && (key == Keys.ENTER || key == Keys.SPACE)) { menu.back(); menu.setCategory(L.cats().get(focus - 2)); lastCategory = menu.category; return true; }
        if (focus == 1 && (key == Keys.ENTER || key == Keys.SPACE)) { Mc.setScreen(minecraft, new HudEditorScreen(this)); return true; }
        if (menu.open == null && focus >= first && focus - first < L.cards().size()) {
            Config.Module m = L.cards().get(focus - first).m();
            if (key == Keys.SPACE) { menu.toggle(m.id()); AurorasClient.save(); return true; }
            if (key == Keys.ENTER) { menu.openSettings(m.id()); focus = first; contentAnim = 0; return true; }
        }
        if (menu.open != null && focus > first && focus - first - 1 < L.rows().size()) {
            Config.SettingDef d = L.rows().get(focus - first - 1).d();
            if (key == Keys.RIGHT || key == Keys.UP) { menu.nudge(d, 1, shift()); return true; }
            if (key == Keys.LEFT || key == Keys.DOWN) { menu.nudge(d, -1, shift()); return true; }
            if (key == Keys.ENTER || key == Keys.SPACE) { if (UiKit.controlFor(d) == UiKit.Control.KEY) listening = d.key(); else menu.nudge(d, 1, false); return true; }
            if (key == Keys.BACKSPACE || key == Keys.DELETE) { menu.reset(d); return true; }
        }
        return false;
    }
    @Override protected boolean typed(String ch) {
        if (!searching) { if (focus <= 0 && !ch.isBlank() && listening == null) { searching = true; focus = 0; } else return false; }
        if (!ch.chars().allMatch(c -> c >= 32)) return true; setQuery(menu.query + ch); return true;
    }
    private void revealFocus() {
        int first = 2 + L.cats().size(); ModuleMenu.Rect r = null;
        if (menu.open == null && focus >= first && focus - first < L.cards().size()) r = L.cards().get(focus - first).r();
        if (menu.open != null && focus > first && focus - first - 1 < L.rows().size()) r = L.rows().get(focus - first - 1).r();
        if (r != null) menu.scroll = UiKit.clampScroll(UiKit.scrollTo(menu.scroll, (int) (r.y() - L.body().y() + menu.scroll), r.h(), L.body().h()), L.content(), L.body().h());
    }
    @Override protected void onClosing() { AurorasClient.save(); }
    /** Esc and the menu key fade the panel out first; finishClose() then really leaves. */
    @Override protected void closeScreen() { if (reduced()) finishClose(); else closing = true; }
    private void finishClose() { AurorasClient.save(); if (parent != null) Mc.setScreen(minecraft, parent); else super.onClose(); }
    @Override public void onClose() { finishClose(); }
}
