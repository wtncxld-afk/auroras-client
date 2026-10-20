package gg.auroras.client.mixin;

// ADAPTER mojmap, gui-v1 (1.21.11). Optional (defaultRequire 0). Time Changer: everything on the client that asks the
// time of day (sun, moon, sky colour, light) goes through ClientLevel$ClientLevelData#getDayTime, so its result is replaced
// with the local time. ClientLevel#tickTime adds one tick with setDayTime(getDayTime() + 1) (javap -c); TimeTickMixin marks
// that call so it keeps the server's own time and the real clock never drifts. Only what you see changes.

import gg.auroras.client.AurorasRender;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(targets = "net.minecraft.client.multiplayer.ClientLevel$ClientLevelData")
public abstract class TimeMixin {
    @Inject(method = "getDayTime", at = @At("RETURN"), cancellable = true)
    private void auroras$localTime(CallbackInfoReturnable<Long> cir) {
        if (AurorasRender.timeOn() && !AurorasRender.timeTicking) cir.setReturnValue(AurorasRender.dayTime(cir.getReturnValueJ()));
    }
}
