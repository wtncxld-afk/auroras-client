package gg.auroras.client.mixin;

// ADAPTER mojmap. Optional injections (defaultRequire 0). Checked with javap -c against 1.21.11, 26.1, 26.2 and 26.3:
//  - GameRenderer#render calls FogRenderer#endFrame right after Minecraft's own post effect and before the HUD is drawn,
//    in every one of them; Color Grading and Motion Blur run there (AurorasRender.frame), so they grade the world only.
//  - bobHurt is the hurt camera shake (No Render).
//  - getFov(Camera, float, boolean) is the world FOV on 1.21.11 (Custom FOV); on 26.x it is Camera#calculateFov (RenderFxCameraMixin).

import gg.auroras.client.AurorasRender;
import net.minecraft.client.Camera;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(GameRenderer.class)
public abstract class RenderFxGameRendererMixin {
    @Inject(method = "render", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/fog/FogRenderer;endFrame()V"))
    private void auroras$postEffects(CallbackInfo ci) { AurorasRender.frame(); }

    @Inject(method = "bobHurt", at = @At("HEAD"), cancellable = true)
    private void auroras$noHurtShake(CallbackInfo ci) { if (AurorasRender.noRender().hurtShake()) ci.cancel(); }

    @Inject(method = "getFov(Lnet/minecraft/client/Camera;FZ)F", at = @At("RETURN"), cancellable = true)
    private void auroras$customFov(Camera camera, float partialTick, boolean useFovSetting, CallbackInfoReturnable<Float> cir) {
        if (useFovSetting) cir.setReturnValue(AurorasRender.fov(cir.getReturnValueF()));
    }
}
