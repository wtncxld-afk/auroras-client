package gg.auroras.client.mixin;

// ADAPTER mojmap, gui-v2 (26.3; the class doesn't exist on 26.1/26.2, hence @Pseudo). Optional (defaultRequire 0).
// Time Changer on 26.3: ClientClockManager$ClientClockInstance#totalTicks() returns the local time (see TimeMixin).

import gg.auroras.client.AurorasRender;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Pseudo;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Pseudo
@Mixin(targets = "net.minecraft.client.ClientClockManager$ClientClockInstance")
public abstract class TimeClockMixin {
    @Inject(method = "totalTicks", at = @At("RETURN"), cancellable = true)
    private void auroras$localTime(CallbackInfoReturnable<Long> cir) {
        if (AurorasRender.timeOn()) cir.setReturnValue(AurorasRender.dayTime(cir.getReturnValueJ()));
    }
}
