package gg.auroras.client;

/** Public bridge so the mixin package can reach the package-private HUD renderer. */
public final class HudRendererAccess {
    private HudRendererAccess() {}
    public static void click(int button) { HudRenderer.click(button); }
    public static void focusLost() { HudRenderer.focusLost(); }
}
