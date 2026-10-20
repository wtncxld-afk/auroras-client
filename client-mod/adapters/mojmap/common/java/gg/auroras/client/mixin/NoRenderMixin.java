package gg.auroras.client.mixin;

// ADAPTER mojmap. Optional (defaultRequire 0). No Render's first-person screen effects, in ScreenEffectRenderer: the fire
// overlay (renderFire on 1.21.11 and 26.1, submitFire on 26.2 and 26.3), the underwater overlay (renderWater /
// submitWater) and the floating totem animation (renderItemActivationAnimation, all four). Names from javap. Totem
// Effects still sees the totem pop (it hooks displayItemActivation), so its particles and flash keep working.
// Low Fire (gui-v1 ScreenEffectRendererMixin) lowers the fire instead; with No Render's fire toggle on, it's hidden.

import gg.auroras.client.AurorasRender;
import net.minecraft.client.renderer.ScreenEffectRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ScreenEffectRenderer.class)
public abstract class NoRenderMixin {
    @Inject(method = { "renderFire", "submitFire" }, at = @At("HEAD"), cancellable = true)
    private static void auroras$noFire(CallbackInfo ci) { if (AurorasRender.noRender().fire()) ci.cancel(); }
    @Inject(method = { "renderWater", "submitWater" }, at = @At("HEAD"), cancellable = true)
    private static void auroras$noWater(CallbackInfo ci) { if (AurorasRender.noRender().water()) ci.cancel(); }
    @Inject(method = "renderItemActivationAnimation", at = @At("HEAD"), cancellable = true)
    private void auroras$noTotem(CallbackInfo ci) { if (AurorasRender.noRender().totem()) ci.cancel(); }
}
