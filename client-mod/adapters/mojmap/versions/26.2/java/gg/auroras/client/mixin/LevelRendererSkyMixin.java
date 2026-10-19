package gg.auroras.client.mixin;

// ADAPTER mojmap, Minecraft 26.2 only (versions/26.2). Optional injection (defaultRequire 0). Custom Skies, step 1: the
// start and end of the sky pass, the lambda LevelRenderer#addSkyPass gives the frame graph. On this release it is
// "lambda$addSkyPass$0", now an instance method taking (GpuBufferSlice, SkyRenderState) (checked with javap). The fog argument is handed to SkyDraw, which sets it before drawing (vanilla sets it only after this HEAD hook). One class per release because Mixin needs the handler to be static exactly when the
// target is, and that changed in 26.2.

import com.mojang.blaze3d.buffers.GpuBufferSlice;
import gg.auroras.client.AurorasSky;
import gg.auroras.client.platform.SkyDraw;
import net.minecraft.client.renderer.LevelRenderer;
import net.minecraft.client.renderer.state.level.SkyRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LevelRenderer.class)
public abstract class LevelRendererSkyMixin {
    @Inject(method = "lambda$addSkyPass$0", at = @At("HEAD"))
    private void auroras$skyStart(GpuBufferSlice fog, SkyRenderState state, CallbackInfo ci) { SkyDraw.setFog(fog); AurorasSky.begin(); }
    @Inject(method = "lambda$addSkyPass$0", at = @At("RETURN"))
    private void auroras$skyEnd(GpuBufferSlice fog, SkyRenderState state, CallbackInfo ci) { AurorasSky.end(); }
}
