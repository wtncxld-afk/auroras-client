package gg.auroras.client.mixin;

// ADAPTER mojmap, Minecraft 26.1 only (versions/26.1; the same as 1.21.11 with the state.level package).
// Optional (defaultRequire 0). Block Overlay's fade-out and fill. LevelRenderer#renderBlockOutline(BufferSource, PoseStack,
// boolean translucent, LevelRenderState) runs twice a frame (opaque, translucent) and draws state.blockOutlineRenderState
// when its isTranslucent() matches (javap -c). At its start we tell AurorasRender which block is outlined; while the
// overlay is still fading out with no block we put the last outline back for this call (restored at the end), and when
// the fill is on we draw the shape's boxes as see-through quads (RenderTypes.debugFilledBox) under the outline.

import com.mojang.blaze3d.vertex.PoseStack;
import gg.auroras.client.AurorasRender;
import net.minecraft.client.renderer.LevelRenderer;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.client.renderer.state.level.BlockOutlineRenderState;
import net.minecraft.client.renderer.state.level.LevelRenderState;
import net.minecraft.world.phys.Vec3;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LevelRenderer.class)
public abstract class BlockOverlayMixin {
    @Unique private static BlockOutlineRenderState auroras$last;
    @Unique private static boolean auroras$restored;

    @Inject(method = "renderBlockOutline", at = @At("HEAD"))
    private void auroras$overlay(MultiBufferSource.BufferSource buffers, PoseStack pose, boolean translucent, LevelRenderState state, CallbackInfo ci) {
        if (!AurorasRender.outlineOn()) { auroras$last = null; return; }
        BlockOutlineRenderState o = state.blockOutlineRenderState;
        if (o != null) auroras$last = o;
        boolean fading = AurorasRender.outlineFrame(o == null ? null : o.pos(), o == null ? null : o.shape());
        if (o == null && fading && auroras$last != null) { state.blockOutlineRenderState = o = auroras$last; auroras$restored = true; }
        if (o == null || o.isTranslucent() != translucent) return;
        int argb = AurorasRender.fillColor(); if (argb == 0) return;
        Vec3 cam = state.cameraRenderState.pos;
        pose.pushPose();
        pose.translate(o.pos().getX() - cam.x + AurorasRender.glideX(), o.pos().getY() - cam.y + AurorasRender.glideY(), o.pos().getZ() - cam.z + AurorasRender.glideZ());
        AurorasRender.fill(pose.last(), buffers.getBuffer(RenderTypes.debugFilledBox()), o.shape(), argb);
        pose.popPose();
    }
    @Inject(method = "renderBlockOutline", at = @At("RETURN"))
    private void auroras$overlayDone(MultiBufferSource.BufferSource buffers, PoseStack pose, boolean translucent, LevelRenderState state, CallbackInfo ci) {
        if (auroras$restored) { state.blockOutlineRenderState = null; auroras$restored = false; }
    }
}
