package gg.auroras.client.mixin;

// ADAPTER mojmap, Minecraft 26.3 only (versions/26.3). Optional injection (defaultRequire 0). Custom Skies, step 1: the
// start and end of the sky pass, the lambda LevelRenderer#addSkyPass gives the frame graph. On this release it is
// "lambda$addSkyPass$0", an instance method taking (GpuBufferSlice, SkyRenderState); SkyRenderer#render then draws into an already open pass, so drawing here, before it, is still first (checked with javap). One class per release because Mixin needs the handler to be static exactly when the
// target is, and that changed in 26.2.

import gg.auroras.client.AurorasSky;
import net.minecraft.client.renderer.LevelRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LevelRenderer.class)
public abstract class LevelRendererSkyMixin {
    @Inject(method = "lambda$addSkyPass$0", at = @At("HEAD"))
    private void auroras$skyStart(CallbackInfo ci) { AurorasSky.begin(); }
    @Inject(method = "lambda$addSkyPass$0", at = @At("RETURN"))
    private void auroras$skyEnd(CallbackInfo ci) { AurorasSky.end(); }
}
