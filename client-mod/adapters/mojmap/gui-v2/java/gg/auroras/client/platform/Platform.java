package gg.auroras.client.platform;

// Minecraft 26.x (gui-v2): key mappings (Fabric's KeyMappingHelper, SDL key codes via Keys), the HUD layer (Fabric's
// HudElementRegistry: our elements before chat, and replacements for the vanilla crosshair and boss bar), textures, and
// the two places Custom Skies touches the renderer (the day time and drawing the sky quads).

import com.mojang.blaze3d.platform.InputConstants;
import com.mojang.blaze3d.platform.NativeImage;
import gg.auroras.client.AurorasClient;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElement;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;


public final class Platform {
    private Platform() {}
    public static final String NAME = "gui-v2";
    /** Modules this GUI line can't do yet (locked in the menu with a reason). Low Fire: its mixin (ScreenEffectRenderer#renderFire) is written only for 1.21.11; the 26.x fire overlay isn't hooked yet. */
    public static final java.util.List<String> NOT_PORTED = java.util.List.of("lowfire");
    static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("auroras_client", "main"));
    /** Registers a key mapping with a default given as a GLFW key code (the format the launcher and settings files use). */
    public static KeyMapping key(String name, int glfwKey) {
        return KeyMappingHelper.registerKeyMapping(new KeyMapping(name, Mc.KEYBOARD, glfwKey < 0 ? InputConstants.UNKNOWN.getValue() : Keys.fromGlfw(glfwKey), CATEGORY));
    }
    /** Moves an existing key mapping to a GLFW key code (-1 unbinds) and refreshes Minecraft's key lookup. */
    public static void rebind(KeyMapping k, int glfwKey) {
        k.setKey(glfwKey < 0 ? InputConstants.UNKNOWN : Mc.KEYBOARD.getOrCreate(Keys.fromGlfw(glfwKey))); KeyMapping.resetMapping();
    }
    /** HUD: our layer (before chat), and the crosshair and boss bar wrapped so modules can replace or move them. */
    public static void hud() {
        // world overlays (nameplates, damage numbers, health bars, emblem) go under every vanilla HUD element
        HudElementRegistry.attachElementBefore(VanillaHudElements.MISC_OVERLAYS, Identifier.fromNamespaceAndPath("auroras_client", "world"), (g, tick) -> gg.auroras.client.AurorasWorld.draw(new Gfx(g)));
        HudElementRegistry.attachElementBefore(VanillaHudElements.CHAT, Identifier.fromNamespaceAndPath("auroras_client", "hud"), (g, tick) -> AurorasClient.renderHud(new Gfx(g)));
        HudElementRegistry.replaceElement(VanillaHudElements.CROSSHAIR, vanilla -> (g, tick) -> { if (!AurorasClient.crosshair(new Gfx(g))) vanilla.extractRenderState(g, tick); });
        HudElementRegistry.replaceElement(VanillaHudElements.BOSS_BAR, vanilla -> (g, tick) -> {
            Gfx x = new Gfx(g); if (AurorasClient.bossBarBefore(x)) { vanilla.extractRenderState(g, tick); AurorasClient.bossBarAfter(x); } });
    }
    /** Uploads straight-ARGB pixels (w x h) as a GUI texture. Safe to call only on the render thread. */
    public static void texture(Identifier id, int[] argb, int w, int h) { texture(id, image(argb, w, h)); }
    /** Builds the image off the render thread if wanted; uploading happens in texture(). */
    public static NativeImage image(int[] argb, int w, int h) { NativeImage img = new NativeImage(w, h, false); for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) img.setPixel(x, y, argb[y * w + x]); return img; }
    /** Uploads an image as a GUI texture (Spotify cover art). Call on the render thread. */
    public static void texture(Identifier id, NativeImage img) { Minecraft.getInstance().getTextureManager().register(id, new DynamicTexture(id::toString, img)); }
    /** A GUI texture whose pixels change while it's on screen (the menu's 3D head): one texture, updated in place. Render thread only. */
    public static final class Live {
        private final Identifier id; private DynamicTexture tex; private int w, h;
        public Live(Identifier id) { this.id = id; }
        public void set(int[] argb, int w, int h) {
            if (tex == null || w != this.w || h != this.h) {
                this.w = w; this.h = h; tex = new DynamicTexture(id::toString, image(argb, w, h)); Minecraft.getInstance().getTextureManager().register(id, tex); return;
            }
            NativeImage px = tex.getPixels(); for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) px.setPixel(x, y, argb[y * w + x]);
            tex.upload();
        }
    }

    // ---- Custom Skies ----
    // The drawing calls differ per 26.x release (26.1 still has MultiBufferSource; 26.2 drops it and moves to render
    // passes; 26.3 moves the GPU API to com.mojang.renderpearl), so each release has its own versions/<target>/
    // platform/SkyDraw, compiled against that release.
    /** Whether this release can draw Custom Skies. */
    public static boolean skySupported() { return SkyDraw.supported(); }
    /** Time of day in ticks (0 = sunrise), as core Sky expects. 26.x moved it to the world clocks (Iris reads the same call). */
    public static long dayTime(ClientLevel level) { return level.getDefaultClockTime(); }
    /** Draws the frame's sky quads (core SkyMesh: camera at the origin, 4 vertices each, in blend runs) at the start of the sky pass. */
    public static boolean skyQuads(float[] pos, int[] col, int quads, int runs, int[] runEnd, boolean[] runAdd) {
        SkyDraw.draw(pos, col, quads, runs, runEnd, runAdd); return true;
    }
}
