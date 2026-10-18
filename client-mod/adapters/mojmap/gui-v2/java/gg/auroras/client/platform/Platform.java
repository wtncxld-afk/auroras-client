package gg.auroras.client.platform;

// Minecraft 26.x (gui-v2): key mappings (Fabric's KeyMappingHelper, SDL key codes via Keys), the HUD layer (Fabric's
// HudElementRegistry: our elements before chat, and replacements for the vanilla crosshair and boss bar), and textures.

import com.mojang.blaze3d.platform.InputConstants;
import com.mojang.blaze3d.platform.NativeImage;
import gg.auroras.client.AurorasClient;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElement;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;

public final class Platform {
    private Platform() {}
    public static final String NAME = "gui-v2";
    static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("auroras_client", "main"));
    /** Registers a key mapping with a default given as a GLFW key code (the format the launcher and settings files use). */
    public static KeyMapping key(String name, int glfwKey) {
        return KeyMappingHelper.registerKeyMapping(new KeyMapping(name, InputConstants.Type.KEYBOARD, glfwKey < 0 ? InputConstants.UNKNOWN.getValue() : Keys.fromGlfw(glfwKey), CATEGORY));
    }
    /** Moves an existing key mapping to a GLFW key code (-1 unbinds) and refreshes Minecraft's key lookup. */
    public static void rebind(KeyMapping k, int glfwKey) {
        k.setKey(glfwKey < 0 ? InputConstants.UNKNOWN : InputConstants.Type.KEYBOARD.getOrCreate(Keys.fromGlfw(glfwKey))); KeyMapping.resetMapping();
    }
    /** HUD: our layer (before chat), and the crosshair and boss bar wrapped so modules can replace or move them. */
    public static void hud() {
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
}
