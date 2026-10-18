package gg.auroras.client;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Hold the emote key: the wheel opens; point at a slot and let go to play it
// (or click it). Releasing in the centre plays nothing. Slot maths is core Emotes.wheelSlot, tested in core.

import gg.auroras.core.Emotes;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

public class EmoteWheelScreen extends Screen {
    private int hover = -1;
    public EmoteWheelScreen() { super(Text.literal("Emotes")); }

    private double open; private long last = System.nanoTime();
    @Override public void render(DrawContext ctx, int mx, int my, float delta) {
        gg.auroras.core.UiTokens t = gg.auroras.client.ui.AUi.tokens(); long now = System.nanoTime(); double dt = Math.min(0.1, (now - last) / 1e9); last = now;
        boolean rm = "true".equals(AurorasClient.PM.get("menuanim.reducedMotion")); open = rm ? 1 : gg.auroras.core.UiKit.approach(open, 1, dt, AurorasModules.tau(0.05));
        int cx = width / 2, cy = height / 2, r = (int) Math.round(Math.min(width, height) / 3.0 * (0.92 + 0.08 * open)); hover = Emotes.wheelSlot(mx - cx, my - cy, r * 0.28);
        ctx.fill(0, 0, width, height, gg.auroras.client.ui.AUi.fade(t.argb("bg", t.scrimAlpha), open));
        for (int k = 0; k < Emotes.SLOTS; k++) {
            double a = k * Math.PI * 2 / Emotes.SLOTS; int x = cx + (int) Math.round(Math.sin(a) * r * 0.72), y = cy - (int) Math.round(Math.cos(a) * r * 0.72);
            String id = AurorasEmotes.wheel[k]; Emotes.Emote e = id == null ? null : AurorasEmotes.BY_ID.get(id); boolean on = k == hover; int w = 78, h = 28;
            gg.auroras.client.ui.AUi.box(ctx, x - w / 2, y - h / 2, w, h, on ? gg.auroras.client.ui.AUi.mix(t.opaque("s2"), t.opaque("acc"), 0.16) : t.argb("s1", t.panelAlpha), on ? t.opaque("acc") : t.opaque("line"), 3);
            ctx.drawText(textRenderer, String.valueOf(k + 1), x - w / 2 + 5, y - h / 2 + 4, t.opaque("faint"), false);
            String name = e == null ? "Empty" : gg.auroras.core.UiKit.ellipsize(e.name(), w - 10, textRenderer::getWidth);
            ctx.drawText(textRenderer, name, x - textRenderer.getWidth(name) / 2, y + 1, e == null ? t.opaque("faint") : t.opaque("text"), false);
        }
        int hw = 92; gg.auroras.client.ui.AUi.box(ctx, cx - hw / 2, cy - 14, hw, 28, t.argb("bg", 0.95), t.opaque("lineStrong"), 3);
        String id = hover < 0 ? null : AurorasEmotes.wheel[hover]; Emotes.Emote he = id == null ? null : AurorasEmotes.BY_ID.get(id);
        String top = hover < 0 ? "Point at an emote" : he == null ? "Empty slot" : he.name(), sub = hover < 0 ? "then let go" : he == null ? "Fill it in the launcher" : "Let go to play";
        top = gg.auroras.core.UiKit.ellipsize(top, hw - 8, textRenderer::getWidth);
        ctx.drawText(textRenderer, top, cx - textRenderer.getWidth(top) / 2, cy - 9, t.opaque("text"), false);
        ctx.drawText(textRenderer, sub, cx - textRenderer.getWidth(sub) / 2, cy + 2, t.opaque("mute"), false);
        String note = "Only you can see your emotes"; ctx.drawText(textRenderer, note, cx - textRenderer.getWidth(note) / 2, cy + r + 10, t.opaque("faint"), false);
    }
    private void choose() { int k = hover; close(); if (k >= 0) AurorasEmotes.play(AurorasEmotes.wheel[k], MinecraftClient.getInstance()); }
    @Override public boolean keyReleased(int key, int scan, int mods) {
        if (AurorasClient.emoteKey.matchesKey(key, scan)) { choose(); return true; }
        return super.keyReleased(key, scan, mods);
    }
    @Override public boolean mouseClicked(double x, double y, int button) { choose(); return true; }
    @Override public boolean shouldPause() { return false; }
    @Override public void renderBackground(DrawContext ctx, int mx, int my, float delta) {}
}
