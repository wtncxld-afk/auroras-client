package gg.auroras.client.mixin;

// ADAPTER mojmap. Optional (defaultRequire 0). Custom FOV on 26.x, where the world field of view is Camera#calculateFov
// (the hand keeps calculateHudFov). On 1.21.11 RenderFxGameRendererMixin does it in GameRenderer#getFov.

import gg.auroras.client.AurorasRender;
import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Camera.class)
public abstract class RenderFxCameraMixin {
    @Inject(method = "calculateFov(F)F", at = @At("RETURN"), cancellable = true)
    private void auroras$customFov(float partialTick, CallbackInfoReturnable<Float> cir) { cir.setReturnValue(AurorasRender.fov(cir.getReturnValueF())); }
}
