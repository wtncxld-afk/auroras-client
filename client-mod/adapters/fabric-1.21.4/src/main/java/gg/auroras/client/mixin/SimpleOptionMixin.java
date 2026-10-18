package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Fullbright: while on, the brightness option reads higher than the slider allows, which
// the lightmap turns into daylight-level brightness. The saved option is never changed, so turning Fullbright off (or
// removing the mod) restores your own brightness. Target: SimpleOption#getValue, for the gamma option only.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.SimpleOption;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(SimpleOption.class)
public abstract class SimpleOptionMixin<T> {
    @SuppressWarnings("unchecked")
    @Inject(method = "getValue", at = @At("RETURN"), cancellable = true)
    private void auroras$gamma(CallbackInfoReturnable<T> cir) {
        if (!AurorasModules.fullbright()) return;
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc != null && mc.options != null && (Object) this == mc.options.getGamma()) cir.setReturnValue((T) (Object) AurorasModules.gamma());
    }
}
