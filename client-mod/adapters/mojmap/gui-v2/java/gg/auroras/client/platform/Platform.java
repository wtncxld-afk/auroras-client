package gg.auroras.client.platform;

// Minecraft 26.x (gui-v2): key mappings (Fabric's KeyMappingHelper, SDL key codes via Keys), the HUD layer (Fabric's
// HudElementRegistry: our elements before chat, and replacements for the vanilla crosshair and boss bar), textures, and
// the two places Custom Skies touches the renderer (the day time and drawing the sky quads).

import com.mojang.blaze3d.platform.InputConstants;
import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.blaze3d.vertex.VertexConsumer;
import gg.auroras.client.AurorasClient;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElement;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.resources.Identifier;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

public final class Platform {
    private Platform() {}
    public static final String NAME = "gui-v2";
    /** Modules this GUI line can't do yet (locked in the menu with a reason). Low Fire: its mixin (ScreenEffectRenderer#renderFire) is written only for 1.21.11; the 26.x fire overlay isn't hooked yet. */
    public static final java.util.List<String> NOT_PORTED = java.util.List.of("lowfire");
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

    // ---- Custom Skies ----
    // 26.3 replaced much of the low-level renderer (Iris's 26.3 sources import com.mojang.renderpearl.api.commands.RenderPass,
    // and SkyRenderer's methods receive an open pass), so the immediate buffer source and the depth clear are looked up by
    // name here instead of compiled against. 26.x ships unobfuscated, so these are the real runtime names. If any is
    // missing, skySupported() says so at startup and the menu keeps Custom Skies locked; the build is never broken by it.
    // RenderTypes.debugFilledBox and VertexConsumer are used directly: Fabric API's own 26.1 and 26.3 test mods use both.
    static Method immediate, getBuffer, endBatch, getDevice, createEncoder, mainTarget, depthTexture, clearDepth; static Constructor<?> bytes;
    static Object skySource; static Boolean skyOk;
    /** Whether the renderer calls Custom Skies needs exist in this game (looked up once, no drawing). */
    public static boolean skySupported() {
        if (skyOk != null) return skyOk;
        try {
            Class<?> bb = Class.forName("com.mojang.blaze3d.vertex.ByteBufferBuilder"); bytes = bb.getConstructor(int.class);
            immediate = Class.forName("net.minecraft.client.renderer.MultiBufferSource").getMethod("immediate", bb);
            getBuffer = immediate.getReturnType().getMethod("getBuffer", RenderType.class); endBatch = immediate.getReturnType().getMethod("endBatch", RenderType.class);
            getDevice = Class.forName("com.mojang.blaze3d.systems.RenderSystem").getMethod("getDevice"); createEncoder = getDevice.getReturnType().getMethod("createCommandEncoder");
            mainTarget = Minecraft.class.getMethod("getMainRenderTarget"); depthTexture = mainTarget.getReturnType().getMethod("getDepthTexture");
            clearDepth = createEncoder.getReturnType().getMethod("clearDepthTexture", depthTexture.getReturnType(), double.class);
            skyOk = true;
        } catch (ReflectiveOperationException | LinkageError e) {
            System.out.println("[Auroras] Custom Skies can't hook this Minecraft version's renderer (" + e + "); keeping the vanilla sky"); skyOk = false;
        }
        return skyOk;
    }
    /** Time of day in ticks (0 = sunrise), as core Sky expects. 26.x moved it to the world clocks (Iris reads the same call). */
    public static long dayTime(ClientLevel level) { return level.getDefaultClockTime(); }
    /**
     * Draws the frame's sky quads (core SkyMesh: camera at the origin, 4 vertices each) at the start of the sky pass, through
     * Minecraft's translucent position-color quad type, then clears depth (see gui-v1's Platform for why that is safe).
     */
    public static boolean skyQuads(float[] pos, int[] col, int quads) {
        if (!skySupported()) return false;
        try {
            if (skySource == null) skySource = immediate.invoke(null, bytes.newInstance(1 << 18));
            RenderType type = RenderTypes.debugFilledBox(); VertexConsumer b = (VertexConsumer) getBuffer.invoke(skySource, type);
            for (int i = 0, n = quads * 4; i < n; i++) b.addVertex(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).setColor(col[i]);
            endBatch.invoke(skySource, type);
            Object depth = depthTexture.invoke(mainTarget.invoke(Minecraft.getInstance()));
            if (depth != null) clearDepth.invoke(createEncoder.invoke(getDevice.invoke(null)), depth, 1.0);
            return true;
        } catch (InvocationTargetException e) { throw new IllegalStateException(String.valueOf(e.getCause()), e.getCause());
        } catch (ReflectiveOperationException e) { throw new IllegalStateException(e.toString(), e); }
    }
}
