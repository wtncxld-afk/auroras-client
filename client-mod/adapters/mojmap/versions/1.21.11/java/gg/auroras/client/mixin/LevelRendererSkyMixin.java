package gg.auroras.client.mixin;

// ADAPTER mojmap, Minecraft 1.21.11 only (versions/1.21.11). Optional injection (defaultRequire 0). Custom Skies, step 1: the
// start and end of the sky pass, the lambda LevelRenderer#addSkyPass gives the frame graph. On this release it is
// "method_62215" (an intermediary name: Mojang's mappings don't name lambdas, so Loom leaves it as is), a static method taking (GpuBufferSlice, SkyRenderState, SkyRenderer) (checked with javap). One class per release because Mixin needs the handler to be static exactly when the
// target is, and that changed in 26.2.

import gg.auroras.client.AurorasSky;
import net.minecraft.client.renderer.LevelRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LevelRenderer.class)
public abstract class LevelRendererSkyMixin {
    @Inject(method = "method_62215", at = @At("HEAD"))
    private static void auroras$skyStart(CallbackInfo ci) { AurorasSky.begin(); }
    @Inject(method = "method_62215", at = @At("RETURN"))
    private static void auroras$skyEnd(CallbackInfo ci) { AurorasSky.end(); }
}
