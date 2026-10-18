package gg.auroras.client.platform;

// Minecraft 1.21.11 (gui-v1): drawing goes through GuiGraphics. Everything else in the mod draws only through this
// class, so the Minecraft-version-specific part of the GUI is these few methods.

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.resources.Identifier;

public final class Gfx {
    private final GuiGraphics g;
    public Gfx(GuiGraphics g) { this.g = g; }
    public void fill(int x0, int y0, int x1, int y1, int argb) { g.fill(x0, y0, x1, y1, argb); }
    public void text(String s, int x, int y, int argb, boolean shadow) { g.drawString(Minecraft.getInstance().font, s, x, y, argb, shadow); }
    public static int width(String s) { return Minecraft.getInstance().font.width(s); }
    public void push() { g.pose().pushMatrix(); }
    public void pop() { g.pose().popMatrix(); }
    public void translate(float x, float y) { g.pose().translate(x, y); }
    public void scale(float s) { g.pose().scale(s, s); }
    /** The whole texture drawn into w x h, tinted by argb (alpha fades it). */
    public void texture(Identifier id, int x, int y, int w, int h, int argb) { g.blit(RenderPipelines.GUI_TEXTURED, id, x, y, 0f, 0f, w, h, w, h, argb); }
    public void scissor(int x0, int y0, int x1, int y1) { g.enableScissor(x0, y0, x1, y1); }
    public void noScissor() { g.disableScissor(); }
    public int w() { return g.guiWidth(); }
    public int h() { return g.guiHeight(); }
}
