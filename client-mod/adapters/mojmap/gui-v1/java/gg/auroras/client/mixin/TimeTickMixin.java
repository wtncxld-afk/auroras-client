package gg.auroras.client.mixin;

// ADAPTER mojmap, gui-v1 (1.21.11). Optional (defaultRequire 0). Time Changer: while ClientLevel#tickTime advances the
// server's clock, TimeMixin hands it the real time (not the local one), so the local time never leaks into the clock.

import gg.auroras.client.AurorasRender;
import net.minecraft.client.multiplayer.ClientLevel;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ClientLevel.class)
public abstract class TimeTickMixin {
    @Inject(method = "tickTime", at = @At("HEAD"))
    private void auroras$tickStart(CallbackInfo ci) { AurorasRender.timeTicking = true; }
    @Inject(method = "tickTime", at = @At("RETURN"))
    private void auroras$tickEnd(CallbackInfo ci) { AurorasRender.timeTicking = false; }
}
