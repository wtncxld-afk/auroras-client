package gg.auroras.client.mixin;

// ADAPTER mojmap, gui-v2 (26.x). Optional (defaultRequire 0). Time Changer: on 26.x the time of day is a world clock.
// 26.1 and 26.2 read it with ClientClockManager#getTotalTicks(Holder<WorldClock>); 26.3 hands out a
// ClientClockManager$ClientClockInstance and reads its totalTicks() (TimeClockMixin). Both return the local time instead.
// The manager's own tick() and server updates use the field directly (javap -c), so the real clock keeps running
// underneath and comes back the moment the module is off. Only what you see changes.

import gg.auroras.client.AurorasRender;
import net.minecraft.client.ClientClockManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ClientClockManager.class)
public abstract class TimeMixin {
    @Inject(method = "getTotalTicks", at = @At("RETURN"), cancellable = true)
    private void auroras$localTime(CallbackInfoReturnable<Long> cir) {
        if (AurorasRender.timeOn()) cir.setReturnValue(AurorasRender.dayTime(cir.getReturnValueJ()));
    }
}
