package gg.auroras.client;

// ADAPTER fabric-1.21.4 — UNCOMPILED. The in-game Auroras menu (Right Shift): category rail, search, module cards and a
// settings panel per module, drawn with the shared design tokens (AUi). Every rule about layout, filtering, editing and
// limits lives in core ModuleMenu and is unit-tested there; this screen draws what it returns and forwards input.
// Keyboard: Tab / Shift+Tab move focus, arrows change the focused control, Enter toggles or opens, Esc goes back.

import gg.auroras.client.ui.AUi;
import gg.auroras.core.*;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

import java.util.HashMap;
import java.util.Map;

public class ModuleScreen extends Screen {
    private final ModuleMenu menu = new ModuleMenu(AurorasClient.REG, AurorasClient.PM);
    private TextFieldWidget search; private ModuleMenu.Layout L;
    private double openAnim, contentAnim = 1; private long last = System.nanoTime();
    private final Map<String, Double> knob = new HashMap<>(); private String dragging, listening; private int focus = -1;
    private static String lastCategory = "All";

    public ModuleScreen() { super(Text.literal("Auroras Client")); menu.setCategory(lastCategory); }

    @Override protected void init() {
        L = menu.layout(width, height);
        search = new TextFieldWidget(textRenderer, L.search().x() + 14, L.search().y() + 4, L.search().w() - 18, 10, Text.literal("Search modules"));
        search.setDrawsBackground(false); search.setMaxLength(40); search.setText(menu.query); search.setEditableColor(AUi.tokens().opaque("text"));
        search.setChangedListener(q -> { menu.setQuery(q); L = menu.layout(width, height); });
        addSelectableChild(search);
    }
    private boolean reduced() { return "true".equals(AurorasClient.PM.get("menuanim.reducedMotion")); }

    @Override public void render(DrawContext c, int mx, int my, float delta) {
        long now = System.nanoTime(); double dt = Math.min(0.1, (now - last) / 1e9); last = now; boolean rm = reduced();
        openAnim = rm ? 1 : UiKit.approach(openAnim, 1, dt, AurorasModules.tau(0.06)); contentAnim = rm ? 1 : UiKit.approach(contentAnim, 1, dt, AurorasModules.tau(0.05));
        L = menu.layout(width, height); UiTokens t = AUi.tokens(); double a = openAnim;
        c.fill(0, 0, width, height, AUi.fade(t.argb("bg", t.scrimAlpha), a));
        ModuleMenu.Rect p = L.panel(); int lift = (int) Math.round((1 - a) * 6);
        c.getMatrices().push(); c.getMatrices().translate(0, lift, 0);
        AUi.box(c, p.x(), p.y(), p.w(), p.h(), AUi.fade(t.argb("s1", t.panelAlpha), a), AUi.fade(t.opaque("line"), a), 3);
        AUi.box(c, p.x() + 1, p.y() + 1, ModuleMenu.RAIL - 1, p.h() - 2, AUi.fade(t.argb("side", t.panelAlpha), a), 0, 2);
        c.fill(p.x() + ModuleMenu.RAIL, p.y() + 1, p.x() + ModuleMenu.RAIL + 1, p.bottom() - 1, AUi.fade(t.opaque("line"), a));
        // rail: wordmark, categories, profile
        c.drawText(textRenderer, "Auroras", p.x() + 10, p.y() + 10, t.opaque("text"), false);
        c.fill(p.x() + 10 + textRenderer.getWidth("Auroras") + 3, p.y() + 13, p.x() + 13 + textRenderer.getWidth("Auroras") + 3, p.y() + 16, t.opaque("acc"));
        for (int k = 0; k < L.cats().size(); k++) {
            ModuleMenu.Rect r = L.catRects().get(k); String cat = L.cats().get(k); boolean on = cat.equals(menu.category) && menu.open == null, hov = r.contains(mx, my - lift);
            if (on || hov) AUi.box(c, r.x(), r.y(), r.w(), r.h(), on ? t.opaque("s2") : t.argb("s2", 0.5), 0, 2);
            if (on) c.fill(r.x() - 6, r.y() + 3, r.x() - 4, r.bottom() - 3, t.opaque("acc"));
            AUi.icon(c, cat.equals("All") ? "dots" : AUi.categoryIcon(cat), r.x() + 4, r.y() + 3, on ? t.opaque("acc") : t.opaque("mute"));
            AUi.textFit(c, textRenderer, cat, r.x() + 16, r.y() + 4, r.w() - 20, on ? t.opaque("text") : t.opaque("mute"));
            if (focus == 2 + k) AUi.focusRing(c, r.x(), r.y(), r.w(), r.h());
        }
        AUi.textFit(c, textRenderer, "Profile: " + AurorasClient.PM.active(), p.x() + 10, p.bottom() - 22, ModuleMenu.RAIL - 16, t.opaque("faint"));
        AUi.textFit(c, textRenderer, "Minecraft " + AurorasClient.mcVersion, p.x() + 10, p.bottom() - 12, ModuleMenu.RAIL - 16, t.opaque("faint"));
        // top bar: search + HUD editor
        ModuleMenu.Rect s = L.search(); boolean sf = search.isFocused() || focus == 0;
        AUi.box(c, s.x(), s.y(), s.w(), s.h(), t.opaque("bg"), sf ? t.opaque("acc") : t.opaque("line"), 2); AUi.icon(c, "search", s.x() + 4, s.y() + 4, t.opaque("faint"));
        if (search.getText().isEmpty() && !search.isFocused()) c.drawText(textRenderer, "Search modules", s.x() + 14, s.y() + 4, t.opaque("faint"), false);
        search.setX(s.x() + 14); search.setY(s.y() + 4); search.setWidth(s.w() - 18); search.render(c, mx, my, delta);
        AUi.button(c, textRenderer, L.hudBtn().x(), L.hudBtn().y() - 1, L.hudBtn().w(), "HUD editor", false, L.hudBtn().contains(mx, my - lift), focus == 1, true);
        // body (clipped so scrolled content never draws outside the panel)
        ModuleMenu.Rect b = L.body(); int fadeIn = (int) Math.round((1 - contentAnim) * 4);
        c.enableScissor(b.x(), b.y() + lift, b.right(), b.bottom() + lift);
        if (menu.open == null) drawGrid(c, mx, my - lift, t, fadeIn); else drawSettings(c, mx, my - lift, t, fadeIn);
        c.disableScissor();
        AUi.scrollbar(c, b.right() + 3, b.y(), b.h(), menu.scroll, L.content());
        if (!menu.message.isEmpty()) { int w = textRenderer.getWidth(menu.message) + 14, x = p.x() + ModuleMenu.RAIL + (p.w() - ModuleMenu.RAIL - w) / 2;
            AUi.box(c, x, p.bottom() - 20, w, 14, t.opaque("s3"), t.opaque("lineStrong"), 2); c.drawText(textRenderer, menu.message, x + 7, p.bottom() - 17, t.opaque("warn"), false); }
        c.getMatrices().pop();
        tooltip(c, mx, my - lift);
    }
    private void drawGrid(DrawContext c, int mx, int my, UiTokens t, int fadeIn) {
        if (L.cards().isEmpty()) { String m = "No modules match \"" + menu.query + "\""; c.drawText(textRenderer, m, L.body().x() + (L.body().w() - textRenderer.getWidth(m)) / 2, L.body().y() + 40, t.opaque("mute"), false); return; }
        int i = 0;
        for (ModuleMenu.Card cd : L.cards()) {
            ModuleMenu.Rect r = cd.r(); if (r.bottom() < L.body().y() || r.y() > L.body().bottom()) { i++; continue; }
            Config.Module m = cd.m(); boolean av = m.available(), on = AurorasClient.PM.enabled(m.id()), hov = r.contains(mx, my); int y = r.y() + fadeIn;
            AUi.box(c, r.x(), y, r.w(), r.h(), hov && av ? t.opaque("s3") : t.opaque("s2"), on ? AUi.mix(t.opaque("line"), t.opaque("acc"), 0.55) : hov ? t.opaque("lineStrong") : t.opaque("line"), 2);
            AUi.icon(c, av ? AUi.categoryIcon(m.cat().label) : "lock", r.x() + 7, y + 7, av ? (on ? t.opaque("acc") : t.opaque("mute")) : t.opaque("faint"));
            AUi.textFit(c, textRenderer, m.name(), r.x() + 20, y + 6, r.w() - 50, av ? t.opaque("text") : t.opaque("faint"));
            AUi.textFit(c, textRenderer, av ? m.cat().label : "Not in the game yet", r.x() + 20, y + 18, r.w() - 50, t.opaque("faint"));
            double k = knob.merge(m.id(), on ? 1.0 : 0.0, (o, n) -> reduced() ? n : UiKit.approach(o, n, 1 / 60.0, AurorasModules.tau(0.04)));
            AUi.toggle(c, cd.sw().x(), cd.sw().y() + fadeIn, k, cd.sw().contains(mx, my), av);
            if (focus == 2 + L.cats().size() + i) AUi.focusRing(c, r.x(), y, r.w(), r.h());
            i++;
        }
    }
    private void drawSettings(DrawContext c, int mx, int my, UiTokens t, int fadeIn) {
        Config.Module m = menu.openModule(); ModuleMenu.Rect b = L.body(); int y0 = b.y() - (int) Math.round(menu.scroll) + fadeIn;
        boolean bh = L.back().contains(mx, my); AUi.box(c, L.back().x(), y0, 15, 15, bh ? t.opaque("s3") : t.opaque("s2"), t.opaque("line"), 2);
        c.drawText(textRenderer, "<", L.back().x() + 5, y0 + 4, t.opaque("text"), false);
        AUi.icon(c, AUi.categoryIcon(m.cat().label), b.x() + 21, y0 + 4, t.opaque("acc"));
        AUi.textFit(c, textRenderer, m.name(), b.x() + 33, y0 + 4, b.w() - 60, t.opaque("text"));
        AUi.textFit(c, textRenderer, m.impact().label, b.x() + 21, y0 + 18, b.w() - 30, t.opaque("faint"));
        AUi.textFit(c, textRenderer, m.available() ? "In game · experimental" : "Not in the game yet: " + m.note(), b.x() + 21, y0 + 28, b.w() - 30, m.available() ? t.opaque("ok") : t.opaque("warn"));
        double k = knob.merge("head:" + m.id(), AurorasClient.PM.enabled(m.id()) ? 1.0 : 0.0, (o, n) -> reduced() ? n : UiKit.approach(o, n, 1 / 60.0, AurorasModules.tau(0.04)));
        AUi.toggle(c, L.headSwitch().x(), y0 + 3, k, L.headSwitch().contains(mx, my), m.available());
        if (L.hudLink() != null) { ModuleMenu.Rect r = L.hudLink(); boolean h = r.contains(mx, my); AUi.icon(c, "hud", r.x() + 4, r.y() + 7 + fadeIn, t.opaque("acc"));
            c.drawText(textRenderer, "Position and size: open the HUD editor", r.x() + 16, r.y() + 7 + fadeIn, h ? t.opaque("acc") : t.opaque("mute"), false); }
        int idx = 0;
        for (ModuleMenu.Row row : L.rows()) {
            ModuleMenu.Rect r = row.r(); if (r.bottom() < b.y() || r.y() > b.bottom()) { idx++; continue; }
            Config.SettingDef d = row.d(); ModuleMenu.Rect ctl = row.ctl(); boolean hov = r.contains(mx, my), foc = focus == 2 + L.cats().size() + 1 + idx; int y = r.y() + fadeIn;
            if (hov) AUi.box(c, r.x(), y, r.w(), r.h(), t.argb("s2", 0.6), 0, 2);
            c.fill(r.x() + 2, r.bottom() + fadeIn - 1, r.right() - 2, r.bottom() + fadeIn, t.argb("line", 0.7));
            String lab = ModuleMenu.label(d.key()); boolean changed = menu.changed(d);
            AUi.textFit(c, textRenderer, lab, r.x() + 4, y + 7, ctl.x() - r.x() - 10 > 40 && UiKit.controlFor(d) != UiKit.Control.SLIDER ? ctl.x() - r.x() - 10 : r.w() - 60, t.opaque("text"));
            if (changed) c.fill(r.x() + 1, y + 7, r.x() + 2, y + 15, t.opaque("acc"));
            switch (UiKit.controlFor(d)) {
                case SWITCH -> { double kk = knob.merge(menu.open + "." + d.key(), Boolean.parseBoolean(menu.value(d)) ? 1.0 : 0.0, (o, n) -> reduced() ? n : UiKit.approach(o, n, 1 / 60.0, AurorasModules.tau(0.04))); AUi.toggle(c, ctl.right() - AUi.SWITCH_W, y + 6, kk, hov, true); }
                case SLIDER -> { String v = menu.display(d); c.drawText(textRenderer, v, r.right() - 4 - textRenderer.getWidth(v), y + 5, t.opaque("mute"), false);
                    AUi.slider(c, ctl.x(), ctl.y() + fadeIn - 2, ctl.w(), d.min(), d.max(), Double.parseDouble(menu.value(d)), hov, foc); }
                case SEGMENTED -> { java.util.List<String> labels = d.options().stream().map(UiKit::optionLabel).toList(); int total = 2; for (String s2 : labels) total += textRenderer.getWidth(s2) + 10;
                    AUi.segmented(c, textRenderer, ctl.right() - total, y + 4, labels, d.options().indexOf(menu.value(d)), -1, foc); }
                case DROPDOWN -> AUi.dropdown(c, textRenderer, ctl.x(), y + 4, ctl.w(), menu.display(d), hov, foc);
                case COLOR -> AUi.swatch(c, textRenderer, ctl.right() - 58, y + 4, Integer.parseInt(menu.value(d), 16), hov, foc);
                case KEY -> AUi.button(c, textRenderer, ctl.right() - 70, y + 3, 70, d.key().equals(listening) ? "Press a key…" : keyName(Integer.parseInt(menu.value(d))), false, hov, foc, true);
            }
            idx++;
        }
    }
    private void tooltip(DrawContext c, int mx, int my) {
        if (menu.open == null) for (ModuleMenu.Card cd : L.cards()) { if (cd.r().contains(mx, my) && L.body().contains(mx, my)) { Config.Module m = cd.m(); AUi.tooltip(c, textRenderer, m.available() ? m.name() + ": " + m.impact().label : m.name() + " isn't in the game yet. " + m.note(), mx, my, width, height); return; } }
        else for (ModuleMenu.Row r : L.rows()) if (r.r().contains(mx, my) && L.body().contains(mx, my) && menu.changed(r.d())) { AUi.tooltip(c, textRenderer, "Changed from the default. Right-click to reset.", mx, my, width, height); return; }
    }
    static String keyName(int code) { if (code < 0) return "Unbound"; if (code >= 65 && code <= 90) return String.valueOf((char) code); if (code >= 48 && code <= 57) return String.valueOf((char) code);
        return switch (code) { case 32 -> "Space"; case 340 -> "Left Shift"; case 344 -> "Right Shift"; case 341 -> "Left Ctrl"; case 342 -> "Left Alt"; case 258 -> "Tab"; default -> "Key " + code; }; }

    // ---- input ----
    @Override public boolean mouseClicked(double mx, double my, int button) {
        if (search.mouseClicked(mx, my, button)) { focus = 0; return true; } search.setFocused(L.search().contains(mx, my));
        if (L.hudBtn().contains(mx, my)) { client.setScreen(new HudEditorScreen(this)); return true; }
        for (int k = 0; k < L.cats().size(); k++) if (L.catRects().get(k).contains(mx, my)) { menu.back(); menu.setCategory(L.cats().get(k)); lastCategory = menu.category; contentAnim = 0; focus = 2 + k; return true; }
        if (!L.body().contains(mx, my)) return super.mouseClicked(mx, my, button);
        if (menu.open == null) {
            for (ModuleMenu.Card cd : L.cards()) {
                if (cd.sw().contains(mx, my)) { menu.toggle(cd.m().id()); AurorasClient.save(); return true; }
                if (cd.r().contains(mx, my)) { menu.openSettings(cd.m().id()); contentAnim = 0; return true; }
            }
            return true;
        }
        if (L.back() != null && L.back().contains(mx, my + menu.scroll)) { menu.back(); contentAnim = 0; return true; }
        if (L.headSwitch().contains(mx, my + menu.scroll)) { menu.toggle(menu.open); AurorasClient.save(); return true; }
        if (L.hudLink() != null && L.hudLink().contains(mx, my)) { client.setScreen(new HudEditorScreen(this)); return true; }
        for (ModuleMenu.Row r : L.rows()) {
            if (!r.r().contains(mx, my)) continue; Config.SettingDef d = r.d();
            if (button == GLFW.GLFW_MOUSE_BUTTON_RIGHT) { menu.reset(d); return true; }
            switch (UiKit.controlFor(d)) {
                case SLIDER -> { if (r.ctl().contains(mx, my) || my >= r.ctl().y() - 3) { dragging = d.key(); menu.slide(d, mx, r.ctl()); } }
                case KEY -> listening = d.key();
                case SEGMENTED -> { java.util.List<String> labels = d.options().stream().map(UiKit::optionLabel).toList(); int[] ws = new int[labels.size()]; int total = 2;
                    for (int k = 0; k < ws.length; k++) { ws[k] = textRenderer.getWidth(labels.get(k)) + 10; total += ws[k]; }
                    int seg = UiKit.segmentAt(mx, r.ctl().right() - total + 1, ws); if (seg >= 0) menu.set(d, d.options().get(seg)); }
                default -> menu.nudge(d, hasShiftDown() ? -1 : 1, false);
            }
            return true;
        }
        return true;
    }
    @Override public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        if (dragging != null) for (ModuleMenu.Row r : L.rows()) if (r.d().key().equals(dragging)) { menu.slide(r.d(), mx, r.ctl()); return true; }
        return super.mouseDragged(mx, my, button, dx, dy);
    }
    @Override public boolean mouseReleased(double mx, double my, int button) { dragging = null; return super.mouseReleased(mx, my, button); }
    @Override public boolean mouseScrolled(double mx, double my, double h, double v) {
        if (menu.open != null) for (ModuleMenu.Row r : L.rows()) if (r.ctl().contains(mx, my) && UiKit.controlFor(r.d()) != UiKit.Control.KEY) { menu.nudge(r.d(), v > 0 ? 1 : -1, hasShiftDown()); return true; }
        if (L.body().contains(mx, my)) { menu.scrollBy(L, v); return true; }
        return super.mouseScrolled(mx, my, h, v);
    }
    @Override public boolean keyPressed(int key, int scan, int mods) {
        if (listening != null) { for (ModuleMenu.Row r : L.rows()) if (r.d().key().equals(listening)) menu.set(r.d(), String.valueOf(key == GLFW.GLFW_KEY_ESCAPE ? -1 : key)); listening = null; return true; }
        if (key == GLFW.GLFW_KEY_ESCAPE) { if (search.isFocused()) { search.setFocused(false); focus = -1; return true; } if (menu.open != null) { menu.back(); contentAnim = 0; return true; } close(); return true; }
        if (search.isFocused()) return search.keyPressed(key, scan, mods) || true;
        if (key == Integer.parseInt(AurorasClient.PM.get(Config.Registry.GUI_KEY))) { close(); return true; }
        int n = menu.focusCount(L);
        if (key == GLFW.GLFW_KEY_TAB) { focus = UiKit.nextFocus(focus, n, hasShiftDown() ? -1 : 1); search.setFocused(focus == 0); revealFocus(); return true; }
        int cats = L.cats().size(), first = 2 + cats;
        if (focus >= 2 && focus < first && (key == GLFW.GLFW_KEY_ENTER || key == GLFW.GLFW_KEY_SPACE)) { menu.back(); menu.setCategory(L.cats().get(focus - 2)); lastCategory = menu.category; return true; }
        if (focus == 1 && (key == GLFW.GLFW_KEY_ENTER || key == GLFW.GLFW_KEY_SPACE)) { client.setScreen(new HudEditorScreen(this)); return true; }
        if (menu.open == null && focus >= first && focus - first < L.cards().size()) {
            Config.Module m = L.cards().get(focus - first).m();
            if (key == GLFW.GLFW_KEY_SPACE) { menu.toggle(m.id()); AurorasClient.save(); return true; }
            if (key == GLFW.GLFW_KEY_ENTER) { menu.openSettings(m.id()); focus = first; contentAnim = 0; return true; }
        }
        if (menu.open != null && focus > first && focus - first - 1 < L.rows().size()) {
            Config.SettingDef d = L.rows().get(focus - first - 1).d();
            if (key == GLFW.GLFW_KEY_RIGHT || key == GLFW.GLFW_KEY_UP) { menu.nudge(d, 1, hasShiftDown()); return true; }
            if (key == GLFW.GLFW_KEY_LEFT || key == GLFW.GLFW_KEY_DOWN) { menu.nudge(d, -1, hasShiftDown()); return true; }
            if (key == GLFW.GLFW_KEY_ENTER || key == GLFW.GLFW_KEY_SPACE) { if (UiKit.controlFor(d) == UiKit.Control.KEY) listening = d.key(); else menu.nudge(d, 1, false); return true; }
            if (key == GLFW.GLFW_KEY_BACKSPACE || key == GLFW.GLFW_KEY_DELETE) { menu.reset(d); return true; }
        }
        return super.keyPressed(key, scan, mods);
    }
    @Override public boolean charTyped(char ch, int mods) { if (search.isFocused()) return search.charTyped(ch, mods); return super.charTyped(ch, mods); }
    private void revealFocus() {
        int first = 2 + L.cats().size(); ModuleMenu.Rect r = null;
        if (menu.open == null && focus >= first && focus - first < L.cards().size()) r = L.cards().get(focus - first).r();
        if (menu.open != null && focus > first && focus - first - 1 < L.rows().size()) r = L.rows().get(focus - first - 1).r();
        if (r != null) menu.scroll = UiKit.clampScroll(UiKit.scrollTo(menu.scroll, (int) (r.y() - L.body().y() + menu.scroll), r.h(), L.body().h()), L.content(), L.body().h());
    }
    @Override public void close() { AurorasClient.save(); super.close(); }
    @Override public boolean shouldPause() { return false; }
    @Override public void renderBackground(DrawContext c, int mx, int my, float delta) {}
}
