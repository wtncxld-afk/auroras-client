package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Hold the emote key: the wheel opens; point at a slot and let go to play it
// (or click it). Releasing in the centre plays nothing. Slot maths is core Emotes.wheelSlot, tested in core.

import gg.auroras.client.platform.AScreen;
import gg.auroras.client.platform.Gfx;
import gg.auroras.core.Emotes;
import net.minecraft.client.Minecraft;

public class EmoteWheelScreen extends AScreen {
    private int hover = -1;
    public EmoteWheelScreen() { super("Emotes"); }

    private double open; private long last = System.nanoTime();
    @Override protected void draw(Gfx ctx, int mx, int my, float delta) {
        gg.auroras.core.UiTokens t = gg.auroras.client.ui.AUi.tokens(); long now = System.nanoTime(); double dt = Math.min(0.1, (now - last) / 1e9); last = now;
        boolean rm = "true".equals(AurorasClient.PM.get("menuanim.reducedMotion")); open = rm ? 1 : gg.auroras.core.UiKit.approach(open, 1, dt, AurorasModules.tau(0.05));
        int cx = width / 2, cy = height / 2, r = (int) Math.round(Math.min(width, height) / 3.0 * (0.92 + 0.08 * open)); hover = Emotes.wheelSlot(mx - cx, my - cy, r * 0.28);
        ctx.fill(0, 0, width, height, gg.auroras.client.ui.AUi.fade(t.argb("bg", t.scrimAlpha), open));
        for (int k = 0; k < Emotes.SLOTS; k++) {
            double a = k * Math.PI * 2 / Emotes.SLOTS; int x = cx + (int) Math.round(Math.sin(a) * r * 0.72), y = cy - (int) Math.round(Math.cos(a) * r * 0.72);
            String id = AurorasEmotes.wheel[k]; Emotes.Emote e = id == null ? null : AurorasEmotes.BY_ID.get(id); boolean on = k == hover; int w = 78, h = 28;
            gg.auroras.client.ui.AUi.box(ctx, x - w / 2, y - h / 2, w, h, on ? gg.auroras.client.ui.AUi.mix(t.opaque("s2"), t.opaque("acc"), 0.16) : t.argb("s1", t.panelAlpha), on ? t.opaque("acc") : t.opaque("line"), 3);
            ctx.text(String.valueOf(k + 1), x - w / 2 + 5, y - h / 2 + 4, t.opaque("faint"), false);
            String name = e == null ? "Empty" : gg.auroras.core.UiKit.ellipsize(e.name(), w - 10, Gfx::width);
            ctx.text(name, x - Gfx.width(name) / 2, y + 1, e == null ? t.opaque("faint") : t.opaque("text"), false);
        }
        int hw = 92; gg.auroras.client.ui.AUi.box(ctx, cx - hw / 2, cy - 14, hw, 28, t.argb("bg", 0.95), t.opaque("lineStrong"), 3);
        String id = hover < 0 ? null : AurorasEmotes.wheel[hover]; Emotes.Emote he = id == null ? null : AurorasEmotes.BY_ID.get(id);
        String top = hover < 0 ? "Point at an emote" : he == null ? "Empty slot" : he.name(), sub = hover < 0 ? "then let go" : he == null ? "Fill it in the launcher" : "Let go to play";
        top = gg.auroras.core.UiKit.ellipsize(top, hw - 8, Gfx::width);
        ctx.text(top, cx - Gfx.width(top) / 2, cy - 9, t.opaque("text"), false);
        ctx.text(sub, cx - Gfx.width(sub) / 2, cy + 2, t.opaque("mute"), false);
        String note = "Only you can see your emotes"; ctx.text(note, cx - Gfx.width(note) / 2, cy + r + 10, t.opaque("faint"), false);
    }
    private void choose() { int k = hover; closeScreen(); if (k >= 0) AurorasEmotes.play(AurorasEmotes.wheel[k], Minecraft.getInstance()); }
    /** Letting go of the wheel key (the key in the profile, as a GLFW code) plays the emote under the pointer. */
    @Override protected boolean keyUp(int key) { if (key == Integer.parseInt(AurorasClient.PM.get("emotes.wheelKey"))) { choose(); return true; } return false; }
    @Override protected boolean click(double x, double y, int button) { choose(); return true; }
}
