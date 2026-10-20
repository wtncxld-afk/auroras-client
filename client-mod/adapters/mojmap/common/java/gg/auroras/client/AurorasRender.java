package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). The game-side half of the rendering modules added in October 2026:
// Block Overlay, Color Grading, Motion Blur, Custom FOV, Custom Enchant Glint, Low Health Warning, Time Changer and
// No Render. Every rule (easing, grading maths, blur weight, warning pulse, local clock, glint pattern) is core RenderFx,
// unit-tested in ModuleTests; this class reads the game's state, calls it and applies the result. The mixins named
// below call the static hooks here; every hook starts with one boolean check, so a module that is off costs nothing.
//
//  Block Overlay   mixin/BlockOutlineMixin (colour, width, glide) + versions/<target>/mixin/BlockOverlayMixin (fade-out, fill)
//  Color Grading,  mixin/RenderFxGameRendererMixin runs our post effects (assets/auroras_client/post_effect/*.json and
//  Motion Blur     shaders/post/auroras_*.fsh) right after Minecraft's own, before the HUD. Their values come from 2 x 1
//                  parameter textures updated here, so changes apply at once.
//  Custom FOV      mixin/RenderFxGameRendererMixin (getFov, 1.21.11), mixin/RenderFxCameraMixin (calculateFov, 26.x),
//                  mixin/FovEffectMixin (dynamic FOV: AbstractClientPlayer#getFieldOfViewModifier)
//  Enchant Glint   our own glint texture registered in place of Minecraft's two glint textures (released when off),
//                  speed and scale through mixin/GlintMixin
//  Low Health      drawn by hud() under the Auroras HUD
//  Time Changer    gui-v1 mixin/TimeMixin + TimeTickMixin (ClientLevelData#getDayTime), gui-v2 mixin/TimeMixin +
//                  TimeClockMixin (world clocks)
//  No Render       mixin/NoRenderMixin (fire, water, totem), NoRenderWeatherMixin, NoRenderParticleMixin, the hurt shake
//                  in RenderFxGameRendererMixin, gui-v1/gui-v2 mixin/NoRenderGuiMixin (pumpkin, frost, vignette, portal)
//
// Everything is local: nothing is sent to the server, and nothing shows what you couldn't see anyway.

import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import gg.auroras.client.mixin.GameRendererAccess;
import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Platform;
import gg.auroras.core.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.LevelTargetBundle;
import net.minecraft.client.renderer.PostChain;
import net.minecraft.client.renderer.texture.AbstractTexture;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.client.renderer.texture.TextureManager;
import net.minecraft.core.BlockPos;
import net.minecraft.resources.Identifier;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.shapes.VoxelShape;

import java.time.LocalTime;
import java.util.List;

public final class AurorasRender {
    private AurorasRender() {}
    static int seen = -1;

    // ---- cached settings (refresh) ----
    static boolean overlayOn, overlayChroma, overlayFill, fillChroma, gradeOn, blurOn, blurTurning, fovOn, fovDynamic, glintOn, glintChroma, glintArmorSep, lowOn, lowAbs, lowPulse, timeOn;
    static int overlayRgb, overlayOpacity, overlayThick, fillRgb, fillOpacity, fovValue, glintRgb, glintArmorRgb, lowThreshold, lowRgb, lowOpacity, timeFixed;
    static double overlayChromaSpeed, fadeS, glideS, blurStrength, fovScale, glintChromaSpeed, glintSpeed = 1, glintScale = 1, glintIntensity = 1, lowDepth, lowPulseSpeed, timeSpeed = 1;
    static String timeMode = "fixed";
    static RenderFx.Grade grade = RenderFx.Grade.NEUTRAL;
    public static final RenderFx.NoRender NO = new RenderFx.NoRender();

    static boolean b(String k) { return "true".equals(AurorasClient.PM.get(k)); }
    static int i(String k) { return Integer.parseInt(AurorasClient.PM.get(k)); }
    static double d(String k) { return Double.parseDouble(AurorasClient.PM.get(k)); }
    static int rgb(String k) { return Integer.parseInt(AurorasClient.PM.get(k), 16); }

    /** Re-reads settings only when the profile changed. */
    static void refresh() {
        Config.ProfileManager pm = AurorasClient.PM; if (pm == null || pm.revision() == seen) return; seen = pm.revision();
        overlayOn = pm.enabled("blockoverlay"); overlayRgb = rgb("blockoverlay.color"); overlayChroma = b("blockoverlay.chroma"); overlayChromaSpeed = d("blockoverlay.chromaSpeed");
        overlayThick = i("blockoverlay.thickness"); overlayOpacity = i("blockoverlay.opacity"); overlayFill = b("blockoverlay.fill"); fillRgb = rgb("blockoverlay.fillColor");
        fillOpacity = i("blockoverlay.fillOpacity"); fillChroma = b("blockoverlay.fillChroma"); fadeS = i("blockoverlay.fadeMs") / 1000.0; glideS = i("blockoverlay.glideMs") / 1000.0;
        boolean g = pm.enabled("colorgrade"); if (g != gradeOn) FAILED[GRADE] = false; gradeOn = g;
        grade = new RenderFx.Grade(d("colorgrade.saturation"), d("colorgrade.contrast"), d("colorgrade.brightness"), d("colorgrade.warmth"), d("colorgrade.tint"), d("colorgrade.vignette"), d("colorgrade.vignetteSize"));
        boolean m = pm.enabled("motionblur"); if (m != blurOn) FAILED[MOTION] = false; blurOn = m; blurStrength = d("motionblur.strength"); blurTurning = b("motionblur.onlyTurning");
        fovOn = pm.enabled("customfov"); fovValue = RenderFx.customFov(i("customfov.fov")); fovDynamic = b("customfov.dynamic"); fovScale = d("customfov.dynamicScale");
        glintOn = pm.enabled("glint"); glintRgb = rgb("glint.color"); glintChroma = b("glint.chroma"); glintChromaSpeed = d("glint.chromaSpeed"); glintSpeed = d("glint.speed");
        glintScale = d("glint.scale"); glintIntensity = d("glint.intensity"); glintArmorSep = b("glint.separateArmor"); glintArmorRgb = rgb("glint.armorColor"); glintDirty = true;
        lowOn = pm.enabled("lowhealth"); lowThreshold = i("lowhealth.threshold"); lowAbs = b("lowhealth.absorption"); lowRgb = rgb("lowhealth.color"); lowOpacity = i("lowhealth.opacity");
        double depth = d("lowhealth.depth"); if (depth != lowDepth) maskDirty = true; lowDepth = depth; lowPulse = b("lowhealth.pulse"); lowPulseSpeed = d("lowhealth.pulseSpeed");
        boolean t = pm.enabled("timechanger"); String mode = pm.get("timechanger.mode"); if (!t || !mode.equals(timeMode)) timeStart = -1; timeOn = t; timeMode = mode; timeFixed = i("timechanger.time"); timeSpeed = d("timechanger.speed");
        NO.on = pm.enabled("norender"); NO.fire = b("norender.fire"); NO.pumpkin = b("norender.pumpkin"); NO.freeze = b("norender.freeze"); NO.vignette = b("norender.vignette"); NO.totem = b("norender.totem");
        NO.hurtShake = b("norender.hurtShake"); NO.weather = b("norender.weather"); NO.explosions = b("norender.explosions"); NO.water = b("norender.water"); NO.portal = b("norender.portal");
    }
    static double seconds() { return System.nanoTime() / 1e9; }

    // =====================================================================================================
    // Once per frame, on the render thread, after Minecraft's own post effect and before the HUD
    // (GameRenderer#render, just before FogRenderer#endFrame; RenderFxGameRendererMixin).
    // =====================================================================================================
    static final Identifier GRADE_CHAIN = Identifier.fromNamespaceAndPath("auroras_client", "color_grade"), MOTION_CHAIN = Identifier.fromNamespaceAndPath("auroras_client", "motion_blur");
    // PostChain loads a texture input "auroras_client:x" from textures/effect/x.png; we register our live textures there first.
    static final Identifier GRADE_PARAMS = Identifier.fromNamespaceAndPath("auroras_client", "textures/effect/grade_params.png"), MOTION_PARAMS = Identifier.fromNamespaceAndPath("auroras_client", "textures/effect/motion_params.png");
    static final int GRADE = 0, MOTION = 1;
    static final boolean[] FAILED = new boolean[2]; static final int[] MISSES = new int[2];
    static final Platform.Live GRADE_TEX = new Platform.Live(GRADE_PARAMS), MOTION_TEX = new Platform.Live(MOTION_PARAMS);
    static final int[] gradePx = new int[2], motionPx = new int[2], lastGrade = {-1, -1}, lastMotion = {-1, -1};
    static double blurW; static float lastYaw, lastPitch; static long lastFrameNs;

    public static void frame() {
        refresh();
        long now = System.nanoTime(); double dt = lastFrameNs == 0 ? 0 : Math.min(0.25, (now - lastFrameNs) / 1e9); lastFrameNs = now;
        glintFrame();
        Minecraft mc = Minecraft.getInstance(); if (mc.level == null || mc.player == null) return;
        if (blurOn && !FAILED[MOTION]) {
            float yaw = mc.player.getYRot(), pitch = mc.player.getXRot();
            double turn = dt > 0 ? RenderFx.turnDegrees(lastYaw, lastPitch, yaw, pitch) / dt : 0; lastYaw = yaw; lastPitch = pitch;
            blurW = RenderFx.blurWeight(turn, blurStrength, blurTurning, blurW, dt);
            RenderFx.gradeTexture(RenderFx.Grade.NEUTRAL, blurW, motionPx); upload(MOTION_TEX, motionPx, lastMotion);
            process(mc, MOTION_CHAIN, MOTION);
        } else blurW = 0;
        if (gradeOn && !FAILED[GRADE] && !grade.neutral()) {
            RenderFx.gradeTexture(grade, 0, gradePx); upload(GRADE_TEX, gradePx, lastGrade);
            process(mc, GRADE_CHAIN, GRADE);
        }
    }
    /** Uploads a parameter texture only when its pixels changed (the first call registers it). */
    static void upload(Platform.Live tex, int[] px, int[] last) {
        if (px[0] == last[0] && px[1] == last[1]) return; last[0] = px[0]; last[1] = px[1]; tex.set(px, 2, 1);
    }
    static void process(Minecraft mc, Identifier id, int which) {
        try {
            PostChain chain = mc.getShaderManager().getPostChain(id, LevelTargetBundle.MAIN_TARGETS);
            if (chain == null) { if (++MISSES[which] > 3) { FAILED[which] = true; System.out.println("[Auroras] " + id + " could not be loaded; that module stays off (see the shader errors above)"); } return; }
            MISSES[which] = 0;
            chain.process(gg.auroras.client.platform.Mc.mainTarget(mc), ((GameRendererAccess) mc.gameRenderer).auroras$resourcePool());
        } catch (RuntimeException e) { FAILED[which] = true; System.out.println("[Auroras] " + id + " failed and was turned off: " + e); }
    }

    // =====================================================================================================
    // Block Overlay
    // =====================================================================================================
    static final RenderFx.BlockOverlay OVERLAY = new RenderFx.BlockOverlay();
    static final double[] BOUNDS = new double[6]; static long outlineNs;
    public static boolean outlineOn() { return overlayOn; }
    /**
     * Called by the per-version BlockOverlayMixin when Minecraft is about to draw the block outline (several times a
     * frame is fine). pos/shape: the outlined block, or null when there is none. Returns true while the overlay is still
     * fading out with no block, so the mixin keeps drawing the last one.
     */
    public static boolean outlineFrame(BlockPos pos, VoxelShape shape) {
        long now = System.nanoTime(); double dt = outlineNs == 0 ? 0 : Math.min(0.25, (now - outlineNs) / 1e9); outlineNs = now;
        boolean hit = pos != null && shape != null && !shape.isEmpty();
        if (hit) { AABB a = shape.bounds(); BOUNDS[0] = pos.getX() + a.minX; BOUNDS[1] = pos.getY() + a.minY; BOUNDS[2] = pos.getZ() + a.minZ; BOUNDS[3] = pos.getX() + a.maxX; BOUNDS[4] = pos.getY() + a.maxY; BOUNDS[5] = pos.getZ() + a.maxZ; }
        OVERLAY.update(hit, BOUNDS, dt, AurorasModules.reducedMotion() ? 0 : glideS, AurorasModules.reducedMotion() ? 0 : fadeS);
        return !hit && OVERLAY.visible();
    }
    /** Outline colour (vanilla's argument replaced while on): ours, faded. */
    public static int outlineColor(int vanilla) { return overlayOn ? RenderFx.withAlpha(RenderFx.overlayColor(overlayRgb, overlayChroma, overlayChromaSpeed, seconds()), overlayOpacity, OVERLAY.alpha) : vanilla; }
    /** Outline width: vanilla's width scaled by thickness (2 = vanilla). */
    public static float outlineWidth(float vanilla) { return overlayOn ? vanilla * overlayThick / 2f : vanilla; }
    /** The glide: how far the drawn box trails behind the block it's heading to (world units). */
    public static float glideX() { return overlayOn ? (float) (OVERLAY.box[0] - OVERLAY.target[0]) : 0; }
    public static float glideY() { return overlayOn ? (float) (OVERLAY.box[1] - OVERLAY.target[1]) : 0; }
    public static float glideZ() { return overlayOn ? (float) (OVERLAY.box[2] - OVERLAY.target[2]) : 0; }
    /** Fill colour ARGB this moment, or 0 for no fill. */
    public static int fillColor() {
        if (!overlayOn || !overlayFill || fillOpacity <= 0) return 0;
        int c = fillChroma ? RenderFx.overlayColor(overlayRgb, true, overlayChromaSpeed, seconds()) : fillRgb; int argb = RenderFx.withAlpha(c, fillOpacity, OVERLAY.alpha);
        return argb >>> 24 == 0 ? 0 : argb;
    }
    /** Writes the shape's boxes as filled quads (debug filled box: position + colour quads), relative to the block's corner, nudged out a hair so faces don't flicker. */
    public static void fill(PoseStack.Pose pose, VertexConsumer vc, VoxelShape shape, int argb) {
        List<AABB> boxes = shape.toAabbs(); float e = 0.002f;
        for (int k = 0, n = Math.min(boxes.size(), 64); k < n; k++) {
            AABB a = boxes.get(k); float x0 = (float) a.minX - e, y0 = (float) a.minY - e, z0 = (float) a.minZ - e, x1 = (float) a.maxX + e, y1 = (float) a.maxY + e, z1 = (float) a.maxZ + e;
            quad(pose, vc, argb, x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1); // bottom
            quad(pose, vc, argb, x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0); // top
            quad(pose, vc, argb, x0, y0, z0, x0, y1, z0, x1, y1, z0, x1, y0, z0); // north
            quad(pose, vc, argb, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1); // south
            quad(pose, vc, argb, x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0); // west
            quad(pose, vc, argb, x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1); // east
        }
    }
    static void quad(PoseStack.Pose p, VertexConsumer vc, int c, float ax, float ay, float az, float bx, float by, float bz, float cx, float cy, float cz, float dx, float dy, float dz) {
        vc.addVertex(p, ax, ay, az).setColor(c); vc.addVertex(p, bx, by, bz).setColor(c); vc.addVertex(p, cx, cy, cz).setColor(c); vc.addVertex(p, dx, dy, dz).setColor(c);
    }

    // =====================================================================================================
    // Custom FOV
    // =====================================================================================================
    /** The world FOV with the custom base value instead of the slider's (sprint, water and zoom effects still apply). */
    public static float fov(float fov) {
        if (!fovOn) return fov; Minecraft mc = Minecraft.getInstance(); int slider = mc.options.fov().get();
        return slider <= 0 ? fov : fov * fovValue / slider;
    }
    /** FOV Effects scale for sprinting, speed and bows: 0 with dynamic FOV off. */
    public static float fovEffect(float vanilla) { return fovOn ? (float) RenderFx.fovEffects(fovDynamic, fovScale) : vanilla; }

    // =====================================================================================================
    // Custom Enchant Glint
    // =====================================================================================================
    static final Identifier GLINT_ITEM = Identifier.withDefaultNamespace("textures/misc/enchanted_glint_item.png"), GLINT_ARMOR = Identifier.withDefaultNamespace("textures/misc/enchanted_glint_armor.png");
    static final int GLINT_SIZE = 64;
    static final int[] glintPx = new int[GLINT_SIZE * GLINT_SIZE];
    static GlintTexture glintItem, glintArmor; static boolean glintDirty, glintApplied; static double glintLast;
    /** Our glint texture: a dynamic texture that keeps the sampler (repeat, filtering) of the Minecraft texture it replaces. */
    static final class GlintTexture extends DynamicTexture {
        GlintTexture(String name, NativeImage img, AbstractTexture like) { super(() -> name, img); if (like != null && like.getSampler() != null) this.sampler = like.getSampler(); }
    }
    static void glintFrame() {
        if (!glintOn) { if (glintApplied) releaseGlint(); return; }
        double now = seconds(); if (!glintDirty && !(glintChroma && now - glintLast >= RenderFx.GLINT_REFRESH)) return;
        glintDirty = false; glintLast = now;
        try {
            int item = RenderFx.glintColor(glintRgb, glintChroma, glintChromaSpeed, now), armor = glintArmorSep ? glintArmorRgb : item;
            glintItem = glintPaint(glintItem, GLINT_ITEM, item); glintArmor = glintPaint(glintArmor, GLINT_ARMOR, armor); glintApplied = true;
        } catch (RuntimeException e) { glintOn = false; System.out.println("[Auroras] Custom Enchant Glint is off: " + e); }
    }
    static GlintTexture glintPaint(GlintTexture tex, Identifier id, int rgb) {
        RenderFx.glintTexture(GLINT_SIZE, rgb, glintIntensity, glintPx);
        if (tex == null) {
            TextureManager tm = Minecraft.getInstance().getTextureManager(); AbstractTexture vanilla = tm.getTexture(id);
            NativeImage img = new NativeImage(GLINT_SIZE, GLINT_SIZE, false); write(img); tex = new GlintTexture("auroras_glint", img, vanilla); tm.register(id, tex); return tex;
        }
        write(tex.getPixels()); tex.upload(); return tex;
    }
    static void write(NativeImage img) { for (int y = 0; y < GLINT_SIZE; y++) for (int x = 0; x < GLINT_SIZE; x++) img.setPixel(x, y, glintPx[y * GLINT_SIZE + x]); }
    /** Module off: give Minecraft its own glint back (it reloads the texture the next time it's used). */
    static void releaseGlint() {
        TextureManager tm = Minecraft.getInstance().getTextureManager(); if (glintItem != null) tm.release(GLINT_ITEM); if (glintArmor != null) tm.release(GLINT_ARMOR);
        glintItem = null; glintArmor = null; glintApplied = false; glintDirty = true;
    }
    /** GlintMixin: the glint's scroll clock scaled by Speed (vanilla's own speed option still applies on top). */
    public static long glintTime(long t) { return glintOn ? (long) (t * Math.max(0, glintSpeed)) : t; }
    /** GlintMixin: texture scale; a bigger Scale setting makes the pattern larger. */
    public static float glintScale(float s) { return glintOn ? (float) (s / Math.max(0.25, glintScale)) : s; }

    // =====================================================================================================
    // Low Health Warning (drawn just below the Auroras HUD)
    // =====================================================================================================
    static final Identifier MASK = Identifier.fromNamespaceAndPath("auroras_client", "low_health_mask");
    static final Platform.Live MASK_TEX = new Platform.Live(MASK);
    static final int MASK_SIZE = 256; static int[] maskPx; static boolean maskDirty = true, maskReady;
    static final HudKit.Smooth LOW = new HudKit.Smooth(); static long lowNs;
    public static void hud(Gfx g, Minecraft mc) {
        refresh(); if (!lowOn || mc.player == null || mc.player.isCreative() || mc.player.isSpectator()) { LOW.value = 0; return; }
        long now = System.nanoTime(); double dt = lowNs == 0 ? 0 : Math.min(0.25, (now - lowNs) / 1e9); lowNs = now;
        double want = RenderFx.lowHealth(mc.player.getHealth(), mc.player.getAbsorptionAmount(), lowThreshold, lowAbs, lowPulse && !AurorasModules.reducedMotion(), lowPulseSpeed, seconds());
        double a = LOW.update(want, dt, 0.12, false); if (a < 0.01) return;
        if (maskDirty || !maskReady) { if (maskPx == null) maskPx = new int[MASK_SIZE * MASK_SIZE]; RenderFx.edgeMask(MASK_SIZE, lowDepth, maskPx); MASK_TEX.set(maskPx, MASK_SIZE, MASK_SIZE); maskDirty = false; maskReady = true; }
        g.texture(MASK, 0, 0, g.w(), g.h(), HudKit.argb(lowRgb, (int) Math.round(lowOpacity * a), 1));
    }

    // =====================================================================================================
    // Time Changer
    // =====================================================================================================
    static long timeStart = -1, timeStartNs;
    /** gui-v1 TimeTickMixin: true while ClientLevel#tickTime advances the real clock (it must read the real time). */
    public static boolean timeTicking;
    public static boolean timeOn() { return timeOn; }
    /** The day time you see, keeping the server's day count. server: the time the server sent. */
    public static long dayTime(long server) {
        if (!timeOn) return server;
        if (timeStart < 0) { timeStart = Math.floorMod(server, 24000L); timeStartNs = System.nanoTime(); }
        LocalTime clock = "real".equals(timeMode) ? LocalTime.now() : null;
        long t = RenderFx.localTime(timeMode, server, timeFixed, timeSpeed, timeStart, (System.nanoTime() - timeStartNs) / 1e9, clock == null ? 0 : clock.getHour(), clock == null ? 0 : clock.getMinute());
        return RenderFx.withDay(server, t);
    }

    // =====================================================================================================
    // No Render (the toggles are read straight from NO by the mixins)
    // =====================================================================================================
    public static RenderFx.NoRender noRender() { refresh(); return NO; }
}
