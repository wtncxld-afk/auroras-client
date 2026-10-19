package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Optional injection (defaultRequire 0). Custom Skies, step 1:
// the start and end of the sky pass, the (static) lambda LevelRenderer#addSkyPass gives the frame graph. Its name is
// "method_62215" on 1.21.11 (an intermediary name: Mojang's mappings don't name lambdas, so it isn't remapped) and
// "lambda$addSkyPass$0" on 26.x, which ships unobfuscated. Both names are the ones Iris (open source, LGPL) targets for
// the same lambda on those versions. Drawing here, before vanilla opens any render pass of its own, also suits 26.3,
// where SkyRenderer's methods receive an already open pass.

import gg.auroras.client.AurorasSky;
import net.minecraft.client.renderer.LevelRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LevelRenderer.class)
public abstract class LevelRendererSkyMixin {
    @Inject(method = { "method_62215", "lambda$addSkyPass$0" }, at = @At("HEAD"))
    private static void auroras$skyStart(CallbackInfo ci) { AurorasSky.begin(); }
    @Inject(method = { "method_62215", "lambda$addSkyPass$0" }, at = @At("RETURN"))
    private static void auroras$skyEnd(CallbackInfo ci) { AurorasSky.end(); }
}
