package gg.auroras.client.mixin;

import gg.auroras.client.AurorasHands;
import net.minecraft.world.entity.LivingEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Swing Animation: how long your own swing animation lasts on your screen (drawing only; attack timing is separate). */
@Mixin(LivingEntity.class)
public abstract class LivingEntityMixin {
    @Inject(method = "getCurrentSwingDuration()I", at = @At("RETURN"), cancellable = true)
    private void auroras$swingLength(CallbackInfoReturnable<Integer> cir) {
        int v = cir.getReturnValueI(), n = AurorasHands.swingTicks(this, v); if (n != v) cir.setReturnValue(n);
    }
}
