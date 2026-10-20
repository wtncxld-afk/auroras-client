package gg.auroras.client.mixin;

// ADAPTER mojmap. Optional (defaultRequire 0). Block Overlay: Minecraft still draws the outline of the block you look at
// (so it shows exactly the blocks Minecraft would outline), with our colour, width and glide. The method that draws one
// outline is LevelRenderer#renderHitOutline (1.21.11, 26.1: PoseStack, VertexConsumer, camera x/y/z, state, int colour,
// float width) or #submitHitOutline (26.2, 26.3: PoseStack, SubmitNodeCollector, RenderType, state, int colour, float
// width, boolean); in both the first PoseStack, int and float arguments are the pose, colour and width (javap -c).
// The glide moves the pose by how far the animated box still trails the block, and is undone when the method returns.
// Fade-out and the fill are per version (versions/<target>/mixin/BlockOverlayMixin).

import com.mojang.blaze3d.vertex.PoseStack;
import gg.auroras.client.AurorasRender;
import net.minecraft.client.renderer.LevelRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LevelRenderer.class)
public abstract class BlockOutlineMixin {
    @Unique private static PoseStack auroras$glided;

    @ModifyVariable(method = { "renderHitOutline", "submitHitOutline" }, at = @At("HEAD"), argsOnly = true, ordinal = 0)
    private PoseStack auroras$glide(PoseStack pose) {
        if (AurorasRender.outlineOn() && auroras$glided == null) { pose.pushPose(); pose.translate(AurorasRender.glideX(), AurorasRender.glideY(), AurorasRender.glideZ()); auroras$glided = pose; }
        return pose;
    }
    @Inject(method = { "renderHitOutline", "submitHitOutline" }, at = @At("RETURN"))
    private void auroras$unglide(CallbackInfo ci) { if (auroras$glided != null) { auroras$glided.popPose(); auroras$glided = null; } }

    @ModifyVariable(method = { "renderHitOutline", "submitHitOutline" }, at = @At("HEAD"), argsOnly = true, ordinal = 0)
    private int auroras$color(int color) { return AurorasRender.outlineColor(color); }
    @ModifyVariable(method = { "renderHitOutline", "submitHitOutline" }, at = @At("HEAD"), argsOnly = true, ordinal = 0)
    private float auroras$width(float width) { return AurorasRender.outlineWidth(width); }
}
