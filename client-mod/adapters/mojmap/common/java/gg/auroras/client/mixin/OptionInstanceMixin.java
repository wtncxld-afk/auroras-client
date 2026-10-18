package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Every injection here is optional (auroras.mixins.json sets
// defaultRequire 0): if a name differs in some version, that one feature stays off and the game still starts.
// Fullbright: while on, the brightness option reads higher than the slider allows. The saved option is never changed,
// so turning Fullbright off (or removing the mod) restores your own brightness. Only the gamma option is affected.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.Minecraft;
import net.minecraft.client.OptionInstance;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(OptionInstance.class)
public abstract class OptionInstanceMixin<T> {
    @SuppressWarnings("unchecked")
    @Inject(method = "get()Ljava/lang/Object;", at = @At("RETURN"), cancellable = true)
    private void auroras$gamma(CallbackInfoReturnable<T> cir) {
        if (!AurorasModules.fullbright()) return;
        Minecraft mc = Minecraft.getInstance();
        if (mc != null && mc.options != null && (Object) this == mc.options.gamma()) cir.setReturnValue((T) (Object) AurorasModules.gamma());
    }
}
