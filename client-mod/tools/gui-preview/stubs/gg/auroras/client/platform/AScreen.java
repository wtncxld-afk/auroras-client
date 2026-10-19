package gg.auroras.client.platform;
/** Preview stand-in for the adapters' AScreen: same hooks, no Minecraft. */
public abstract class AScreen extends net.minecraft.client.gui.screens.Screen {
    protected AScreen(String title) {}
    protected void init() {}
    protected abstract void draw(Gfx g, int mx, int my, float delta);
    protected boolean click(double x, double y, int button) { return false; }
    protected boolean release(double x, double y, int button) { return false; }
    protected boolean drag(double x, double y, int button, double dx, double dy) { return false; }
    protected boolean wheel(double x, double y, double v) { return false; }
    protected boolean key(int k) { return false; }
    protected boolean keyUp(int k) { return false; }
    protected boolean typed(String s) { return false; }
    public static boolean shift() { return false; }
    public static boolean alt() { return false; }
    protected void closeScreen() { onClose(); }
    protected void onClosing() {}
    public void setup(int w, int h) { width = w; height = h; init(); }
    public void frame(Gfx g, int mx, int my) { draw(g, mx, my, 0); }
}
