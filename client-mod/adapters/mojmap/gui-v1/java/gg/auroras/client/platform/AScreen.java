package gg.auroras.client.platform;

// Minecraft 1.21.11 (gui-v1): the base of every Auroras screen. Screens implement draw() and the simple input methods
// below; this class adapts them to Minecraft's Screen (render, MouseButtonEvent, KeyEvent, CharacterEvent).

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.CharacterEvent;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;

public abstract class AScreen extends Screen {
    protected AScreen(String title) { super(Component.literal(title)); }
    protected abstract void draw(Gfx g, int mx, int my, float delta);
    protected boolean click(double x, double y, int button) { return false; }
    protected boolean release(double x, double y, int button) { return false; }
    protected boolean drag(double x, double y, int button, double dx, double dy) { return false; }
    protected boolean wheel(double x, double y, double v) { return false; }
    /** key is a GLFW key code (Keys converts), whatever the game uses underneath. */
    protected boolean key(int glfwKey) { return false; }
    protected boolean keyUp(int glfwKey) { return false; }
    protected boolean typed(String s) { return false; }
    public static boolean shift() { return Minecraft.getInstance().hasShiftDown(); }
    public static boolean alt() { return Minecraft.getInstance().hasAltDown(); }
    protected void closeScreen() { onClose(); }
    protected void onClosing() {}

    @Override public void render(GuiGraphics g, int mx, int my, float delta) { draw(new Gfx(g), mx, my, delta); }
    // No vanilla background or blur behind Auroras screens: each draws its own scrim.
    @Override public void renderBackground(GuiGraphics g, int mx, int my, float delta) {}
    @Override public boolean mouseClicked(MouseButtonEvent e, boolean doubleClick) { return click(e.x(), e.y(), e.button()) || super.mouseClicked(e, doubleClick); }
    @Override public boolean mouseReleased(MouseButtonEvent e) { return release(e.x(), e.y(), e.button()) || super.mouseReleased(e); }
    @Override public boolean mouseDragged(MouseButtonEvent e, double dx, double dy) { return drag(e.x(), e.y(), e.button(), dx, dy) || super.mouseDragged(e, dx, dy); }
    @Override public boolean mouseScrolled(double x, double y, double h, double v) { return wheel(x, y, v) || super.mouseScrolled(x, y, h, v); }
    @Override public boolean keyPressed(KeyEvent e) { return key(Keys.toGlfw(e.key())) || super.keyPressed(e); }
    @Override public boolean keyReleased(KeyEvent e) { return keyUp(Keys.toGlfw(e.key())) || super.keyReleased(e); }
    @Override public boolean charTyped(CharacterEvent e) { return typed(Character.toString(e.codepoint())) || super.charTyped(e); }
    @Override public void onClose() { onClosing(); super.onClose(); }
    @Override public boolean isPauseScreen() { return false; }
}
