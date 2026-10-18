package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Low Fire: lowers the first-person fire overlay and makes it more see-through.
// Target: InGameOverlayRenderer#renderFireOverlay(MatrixStack, VertexConsumerProvider) (static in 1.21.4) and the
// alpha of its VertexConsumer#color(FFFF) calls.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.gui.hud.InGameOverlayRenderer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyArg;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(InGameOverlayRenderer.class)
public abstract class InGameOverlayRendererMixin {
    @Inject(method = "renderFireOverlay", at = @At("HEAD"))
    private static void auroras$lower(MatrixStack matrices, VertexConsumerProvider consumers, CallbackInfo ci) {
        matrices.push(); if (AurorasModules.lowFire()) matrices.translate(0, -AurorasModules.fireOffset(), 0);
    }
    @Inject(method = "renderFireOverlay", at = @At("RETURN"))
    private static void auroras$restore(MatrixStack matrices, VertexConsumerProvider consumers, CallbackInfo ci) { matrices.pop(); }
    @ModifyArg(method = "renderFireOverlay", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/VertexConsumer;color(FFFF)Lnet/minecraft/client/render/VertexConsumer;"), index = 3)
    private static float auroras$alpha(float a) { return AurorasModules.fireAlpha(a); }
}
