package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Optional injections (defaultRequire 0). Custom Skies, step 2:
// while AurorasSky has drawn the themed sky in this sky pass, the vanilla layers it replaces are skipped. The sun and
// moon are left alone. The handlers take no method arguments, so they match each version's own signatures (1.21.11 to
// 26.2 pass colors and a PoseStack; 26.3 also passes the open RenderPass).

import gg.auroras.client.AurorasSky;
import net.minecraft.client.renderer.SkyRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(SkyRenderer.class)
public abstract class SkyRendererMixin {
    @Inject(method = { "renderSkyDisc", "renderSunriseAndSunset", "renderStars", "renderDarkDisc", "renderEndSky" }, at = @At("HEAD"), cancellable = true)
    private void auroras$skipVanilla(CallbackInfo ci) { if (AurorasSky.replacesVanilla()) ci.cancel(); }
}
