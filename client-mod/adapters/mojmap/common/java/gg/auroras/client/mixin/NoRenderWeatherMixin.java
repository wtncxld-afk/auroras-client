package gg.auroras.client.mixin;

// ADAPTER mojmap. Optional (defaultRequire 0). No Render "weather": skips drawing rain and snow. WeatherEffectRenderer
// has render(...) on every version (different arguments; "render*" targets all of them) and renderOit on 26.3 (javap).
// Only the drawing: the server's weather, sounds and the darker sky are unchanged.

import gg.auroras.client.AurorasRender;
import net.minecraft.client.renderer.WeatherEffectRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(WeatherEffectRenderer.class)
public abstract class NoRenderWeatherMixin {
    @Inject(method = { "render*", "renderOit*" }, at = @At("HEAD"), cancellable = true)
    private void auroras$noWeather(CallbackInfo ci) { if (AurorasRender.noRender().weather()) ci.cancel(); }
}
