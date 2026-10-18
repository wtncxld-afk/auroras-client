package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. In-game HUD editor: drag elements, resize with the corner handle, snap to screen
// centre/edges and other elements (hold Alt to place freely), right-click to reset one element. Outlines only exist on
// this screen, so they never show during normal play. The toolbar and hint use the shared Auroras UI kit. Uses the same Hud/HudKit maths as the launcher's HUD editor.

import gg.auroras.client.platform.AScreen;
import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Keys;
import gg.auroras.core.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.util.*;

public class HudEditorScreen extends AScreen {
    private final Screen parent;
    private String selected, dragging; private boolean resizing, snap = true; private double grabX, grabY, startX; private float startScale; private int startW;
    private final int[] guide = {-1, -1}; private long last = System.nanoTime(); private int presetIdx = -1;
    public HudEditorScreen(Screen parent) { super("Auroras HUD editor"); this.parent = parent; }

    // Toolbar drawn with the Auroras UI kit (same tokens as the launcher), hit-tested in mouseClicked.
    private static final String[] TOOLS = {"Snap", "Save as preset", "Next preset", "Done"};
    private int[][] toolRects() { int y = height - 24, x = width / 2 - 170; int[][] r = new int[4][]; int[] w = {70, 96, 86, 70};
        for (int k = 0; k < 4; k++) { r[k] = new int[]{x, y, w[k]}; x += w[k] + 6; } return r; }
    @Override protected void draw(Gfx ctx, int mx, int my, float delta) {
        long now = System.nanoTime(); double dt = (now - last) / 1e9; last = now;
        ctx.fill(0, 0, width, height, 0x40000000);
        HudRenderer.render(ctx, Minecraft.getInstance(), dt, true, selected);
        for (HudRenderer.El e : HudRenderer.ELS.values()) {
            if (!e.on || e.w == 0) continue; boolean sel = e.id.equals(selected); gg.auroras.core.UiTokens tk = gg.auroras.client.ui.AUi.tokens(); int c = sel ? tk.opaque("acc") : tk.argb("text", 0.45);
            ctx.fill(e.pos[0], e.pos[1], e.pos[0] + e.w, e.pos[1] + 1, c); ctx.fill(e.pos[0], e.pos[1] + e.h - 1, e.pos[0] + e.w, e.pos[1] + e.h, c);
            ctx.fill(e.pos[0], e.pos[1], e.pos[0] + 1, e.pos[1] + e.h, c); ctx.fill(e.pos[0] + e.w - 1, e.pos[1], e.pos[0] + e.w, e.pos[1] + e.h, c);
            if (sel) ctx.fill(e.pos[0] + e.w - 3, e.pos[1] + e.h - 3, e.pos[0] + e.w + 1, e.pos[1] + e.h + 1, tk.opaque("acc"));
        }
        int gc = 0xC0000000 | gg.auroras.client.ui.AUi.tokens().guide; if (guide[0] >= 0) ctx.fill(guide[0], 0, guide[0] + 1, height, gc);
        if (guide[1] >= 0) ctx.fill(0, guide[1], width, guide[1] + 1, gc);
        gg.auroras.core.UiTokens t = gg.auroras.client.ui.AUi.tokens(); String hint = "Editing HUD layout · drag to move · corner to resize · right-click resets · Alt places freely";
        int hw = Gfx.width(hint) + 16; gg.auroras.client.ui.AUi.box(ctx, (width - hw) / 2, 5, hw, 15, t.argb("s1", 0.92), gg.auroras.client.ui.AUi.mix(t.opaque("line"), t.opaque("acc"), 0.5), 3);
        ctx.fill((width - hw) / 2 + 6, 11, (width - hw) / 2 + 9, 14, t.opaque("acc")); ctx.text(hint, (width - hw) / 2 + 12, 9, t.opaque("text"), false);
        int[][] tr = toolRects(); gg.auroras.client.ui.AUi.box(ctx, tr[0][0] - 6, tr[0][1] - 5, tr[3][0] + tr[3][2] - tr[0][0] + 12, 26, t.argb("s1", 0.92), t.opaque("line"), 3);
        for (int k = 0; k < 4; k++) { String lab = k == 0 ? "Snap: " + (snap ? "on" : "off") : TOOLS[k]; boolean hov = mx >= tr[k][0] && mx < tr[k][0] + tr[k][2] && my >= tr[k][1] && my < tr[k][1] + 16;
            gg.auroras.client.ui.AUi.button(ctx, tr[k][0], tr[k][1], tr[k][2], lab, k == 3, hov, false, true); }
    }
    private HudRenderer.El at(double x, double y) {
        HudRenderer.El hit = null;
        for (HudRenderer.El e : HudRenderer.ELS.values()) if (e.on && x >= e.pos[0] - 2 && y >= e.pos[1] - 2 && x <= e.pos[0] + e.w + 2 && y <= e.pos[1] + e.h + 2) hit = e;
        return hit;
    }
    @Override protected boolean click(double x, double y, int button) {
        int[][] tr = toolRects(); for (int k = 0; k < 4; k++) if (x >= tr[k][0] && x < tr[k][0] + tr[k][2] && y >= tr[k][1] && y < tr[k][1] + 16) {
            if (k == 0) snap = !snap; else if (k == 1) savePreset(); else if (k == 2) nextPreset(); else closeScreen(); return true; }
        HudRenderer.El e = at(x, y); selected = e == null ? null : e.id; if (e == null) return false;
        if (button == 1) { HudKit.applyLayout(AurorasClient.PM, HudKit.resetElement(AurorasClient.REG, e.id)); return true; }
        dragging = e.id; resizing = x >= e.pos[0] + e.w - 5 && y >= e.pos[1] + e.h - 5; grabX = x - e.pos[0]; grabY = y - e.pos[1]; startX = x; startScale = e.scale; startW = Math.max(1, Math.round(e.w / e.scale));
        return true;
    }
    @Override protected boolean drag(double x, double y, int button, double dx, double dy) {
        if (dragging == null) return false;
        HudRenderer.El e = HudRenderer.ELS.get(dragging); Config.ProfileManager pm = AurorasClient.PM;
        if (resizing) { float s = Math.round(Hud.scaleFromDrag(startScale, (int) Math.round(x - startX), startW) * 20) / 20f; pm.set(e.id + ".scale", String.valueOf(s)); return true; }
        int nx = (int) Math.round(x - grabX), ny = (int) Math.round(y - grabY); guide[0] = guide[1] = -1;
        if (snap && !alt()) {
            List<int[]> others = new ArrayList<>(); for (HudRenderer.El o : HudRenderer.ELS.values()) if (o.on && o != e && o.w > 0) others.add(new int[]{o.pos[0], o.pos[1], o.w, o.h});
            int[] s = Hud.snap(nx, ny, e.w, e.h, width, height, 4, others); guide[0] = edgeHit(s[0], e.w, width, others, true); guide[1] = edgeHit(s[1], e.h, height, others, false); nx = s[0]; ny = s[1];
        }
        Hud.Placement p = Hud.fromPosition(nx, ny, e.w, e.h, width, height);
        pm.set(e.id + ".anchor", p.anchor().name()); pm.set(e.id + ".offX", String.valueOf(p.offX())); pm.set(e.id + ".offY", String.valueOf(p.offY()));
        return true;
    }
    private static int edgeHit(int pos, int len, int screen, List<int[]> others, boolean xAxis) {
        Set<Integer> lines = new HashSet<>(List.of(0, screen / 2, screen)); for (int[] o : others) { int a = xAxis ? o[0] : o[1], l = xAxis ? o[2] : o[3]; lines.add(a); lines.add(a + l / 2); lines.add(a + l); }
        for (int edge : new int[]{pos, pos + len / 2, pos + len}) if (lines.contains(edge)) return edge; return -1;
    }
    @Override protected boolean release(double x, double y, int button) { dragging = null; resizing = false; guide[0] = guide[1] = -1; return false; }
    @Override protected boolean key(int key) {
        if (selected != null && (key == Keys.LEFT || key == Keys.RIGHT || key == Keys.UP || key == Keys.DOWN)) {
            HudRenderer.El e = HudRenderer.ELS.get(selected); int st = shift() ? 10 : 1;
            int nx = Math.max(0, Math.min(width - e.w, e.pos[0] + (key == Keys.LEFT ? -st : key == Keys.RIGHT ? st : 0))), ny = Math.max(0, Math.min(height - e.h, e.pos[1] + (key == Keys.UP ? -st : key == Keys.DOWN ? st : 0)));
            Hud.Placement p = Hud.fromPosition(nx, ny, e.w, e.h, width, height); AurorasClient.PM.set(selected + ".anchor", p.anchor().name()); AurorasClient.PM.set(selected + ".offX", String.valueOf(p.offX())); AurorasClient.PM.set(selected + ".offY", String.valueOf(p.offY()));
            return true;
        }
        return false;
    }
    private void savePreset() {
        try { String name = "Layout " + (HudKit.loadLayouts(AurorasClient.REG, AurorasClient.DIR).size() + 1); HudKit.saveLayout(AurorasClient.DIR, name, HudKit.captureLayout(AurorasClient.REG, AurorasClient.PM));
            if (minecraft != null && minecraft.player != null) minecraft.player.sendSystemMessage(Component.literal("[Auroras] Saved HUD layout “" + name + "”.")); }
        catch (Exception ex) { System.out.println("[Auroras] couldn't save layout: " + ex.getMessage()); }
    }
    private void nextPreset() {
        try { Map<String, Map<String, String>> all = HudKit.loadLayouts(AurorasClient.REG, AurorasClient.DIR); if (all.isEmpty()) return; List<String> names = new ArrayList<>(all.keySet());
            presetIdx = (presetIdx + 1) % names.size(); HudKit.applyLayout(AurorasClient.PM, all.get(names.get(presetIdx))); }
        catch (Exception ex) { System.out.println("[Auroras] couldn't load layouts: " + ex.getMessage()); }
    }
    @Override public void onClose() { AurorasClient.save(); Minecraft.getInstance().setScreen(parent); }
}
