package gg.auroras.client.mixin;

// ADAPTER mojmap, Minecraft 1.21.11 only (gui-v1) — UNCOMPILED, optional (defaultRequire 0). Low Fire: lowers the
// first-person fire overlay and makes it more see-through, by changing the arguments of the calls renderFire makes
// (its own translate and vertex color), so no other part of the renderer is touched.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.renderer.ScreenEffectRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyArg;

@Mixin(ScreenEffectRenderer.class)
public abstract class ScreenEffectRendererMixin {
    @ModifyArg(method = "renderFire", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/PoseStack;translate(FFF)V"), index = 1)
    private static float auroras$lower(float y) { return AurorasModules.lowFire() ? y - AurorasModules.fireOffset() : y; }
    @ModifyArg(method = "renderFire", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/vertex/VertexConsumer;setColor(FFFF)Lcom/mojang/blaze3d/vertex/VertexConsumer;"), index = 3)
    private static float auroras$alpha(float a) { return AurorasModules.fireAlpha(a); }
}
