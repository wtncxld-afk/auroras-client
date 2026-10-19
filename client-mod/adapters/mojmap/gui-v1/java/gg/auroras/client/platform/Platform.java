package gg.auroras.client.platform;

// Minecraft 1.21.11 (gui-v1): key mappings (Fabric's KeyBindingHelper, GLFW key codes), the HUD layer (Fabric's
// HudElementRegistry: our elements before chat, and replacements for the vanilla crosshair and boss bar), textures, and
// the two places Custom Skies touches the renderer (the day time and drawing the sky quads).

import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.blaze3d.platform.InputConstants;
import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.ByteBufferBuilder;
import com.mojang.blaze3d.vertex.VertexConsumer;
import gg.auroras.client.AurorasClient;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElement;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;

public final class Platform {
    private Platform() {}
    public static final String NAME = "gui-v1";
    /** Modules this GUI line can't do yet (locked in the menu with a reason). Nothing: every module the common code has is hooked up here. */
    public static final java.util.List<String> NOT_PORTED = java.util.List.of();
    static final KeyMapping.Category CATEGORY = KeyMapping.Category.register(Identifier.fromNamespaceAndPath("auroras_client", "main"));
    /** Registers a key mapping with a default given as a GLFW key code (the format the launcher and settings files use). */
    public static KeyMapping key(String name, int glfwKey) {
        return KeyBindingHelper.registerKeyBinding(new KeyMapping(name, InputConstants.Type.KEYSYM, glfwKey < 0 ? InputConstants.UNKNOWN.getValue() : Keys.fromGlfw(glfwKey), CATEGORY));
    }
    /** Moves an existing key mapping to a GLFW key code (-1 unbinds) and refreshes Minecraft's key lookup. */
    public static void rebind(KeyMapping k, int glfwKey) {
        k.setKey(glfwKey < 0 ? InputConstants.UNKNOWN : InputConstants.Type.KEYSYM.getOrCreate(Keys.fromGlfw(glfwKey))); KeyMapping.resetMapping();
    }
    /** HUD: our layer (before chat), and the crosshair and boss bar wrapped so modules can replace or move them. */
    public static void hud() {
        HudElementRegistry.attachElementBefore(VanillaHudElements.CHAT, Identifier.fromNamespaceAndPath("auroras_client", "hud"), (g, tick) -> AurorasClient.renderHud(new Gfx(g)));
        HudElementRegistry.replaceElement(VanillaHudElements.CROSSHAIR, vanilla -> (g, tick) -> { if (!AurorasClient.crosshair(new Gfx(g))) vanilla.render(g, tick); });
        HudElementRegistry.replaceElement(VanillaHudElements.BOSS_BAR, vanilla -> (g, tick) -> {
            Gfx x = new Gfx(g); if (AurorasClient.bossBarBefore(x)) { vanilla.render(g, tick); AurorasClient.bossBarAfter(x); } });
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
    /** Whether this line can draw Custom Skies. 1.21.11 uses the calls below directly, so a mismatch shows up when it's built. */
    public static boolean skySupported() { return true; }
    /** Time of day in ticks (0 = sunrise), as core Sky expects. 1.21.11 still has Level#getDayTime. */
    public static long dayTime(ClientLevel level) { return level.getDayTime(); }
    static MultiBufferSource.BufferSource skySource;
    /**
     * Draws the frame's sky quads (core SkyMesh: camera at the origin, 4 vertices each) at the start of the sky pass.
     * RenderTypes.debugFilledBox is Minecraft's own translucent position-color quad type (Fabric API's 1.21.11 test mod
     * draws with it). In case it writes depth, the depth buffer is cleared afterwards: nothing else has been drawn into the
     * frame yet (the sky pass comes first and vanilla's sky never writes depth), so terrain beyond 100 blocks still shows.
     * Uses the modelview Minecraft set for the level (camera rotation only). Returns true when it drew.
     */
    public static boolean skyQuads(float[] pos, int[] col, int quads) {
        if (skySource == null) skySource = MultiBufferSource.immediate(new ByteBufferBuilder(1 << 18));
        RenderType type = RenderTypes.debugFilledBox(); VertexConsumer b = skySource.getBuffer(type);
        for (int i = 0, n = quads * 4; i < n; i++) b.addVertex(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).setColor(col[i]);
        skySource.endBatch(type);
        RenderTarget main = Minecraft.getInstance().getMainRenderTarget();
        if (main.getDepthTexture() != null) RenderSystem.getDevice().createCommandEncoder().clearDepthTexture(main.getDepthTexture(), 1.0);
        return true;
    }
}
