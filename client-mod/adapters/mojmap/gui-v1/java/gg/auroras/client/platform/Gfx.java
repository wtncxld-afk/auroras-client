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
    /** Maps what is drawn next through a 2x2 matrix: x axis to (ax, ay), y axis to (bx, by) (decals that turn and foreshorten). */
    public void affine(float ax, float ay, float bx, float by) { g.pose().mul(new org.joml.Matrix3x2f(ax, ay, bx, by, 0, 0)); }
    /** An item icon (16 x 16 GUI units) at x, y. */
    public void item(net.minecraft.world.item.ItemStack stack, int x, int y) { g.renderItem(stack, x, y); }
    /** Turns what is drawn next by rad radians (clockwise on screen) around the current origin. */
    public void rotate(float rad) { g.pose().rotate(rad); }
    /** The whole texture drawn into w x h, tinted by argb (alpha fades it). */
    public void texture(Identifier id, int x, int y, int w, int h, int argb) { g.blit(RenderPipelines.GUI_TEXTURED, id, x, y, 0f, 0f, w, h, w, h, argb); }
    /** A sprite from the GUI atlas (textures/gui/sprites/<path>.png, e.g. mob_effect/speed) drawn into w x h, tinted by argb. */
    public void sprite(Identifier id, int x, int y, int w, int h, int argb) { g.blitSprite(RenderPipelines.GUI_TEXTURED, id, x, y, w, h, argb); }
    /** A uw x vh region of a texW x texH texture at (u, v), drawn into w x h (font glyphs). */
    public void region(Identifier id, int x, int y, int w, int h, int u, int v, int uw, int vh, int texW, int texH, int argb) { g.blit(RenderPipelines.GUI_TEXTURED, id, x, y, (float) u, (float) v, w, h, uw, vh, texW, texH, argb); }
    /** GUI scale (screen pixels per GUI unit), for drawing at the screen's real resolution. */
    public static double guiScale() { return Minecraft.getInstance().getWindow().getGuiScale(); }
    public static int screenW() { return Minecraft.getInstance().getWindow().getWidth(); }
    public static int screenH() { return Minecraft.getInstance().getWindow().getHeight(); }
    public void scissor(int x0, int y0, int x1, int y1) { g.enableScissor(x0, y0, x1, y1); }
    public void noScissor() { g.disableScissor(); }
    public int w() { return g.guiWidth(); }
    public int h() { return g.guiHeight(); }
}
