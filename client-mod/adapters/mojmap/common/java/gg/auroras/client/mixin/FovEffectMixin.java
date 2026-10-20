package gg.auroras.client.mixin;

// ADAPTER mojmap. Optional (defaultRequire 0). Custom FOV's "dynamic FOV": AbstractClientPlayer#getFieldOfViewModifier
// (boolean firstPerson, float effectScale) is where sprinting, Speed, Slowness and drawing a bow change the FOV, scaled by
// the FOV Effects slider passed in as its float (the same on 1.21.11 and 26.x; on 26.x Camera#tickFov calls it, javap -c).
// With Custom FOV on we pass our own scale instead: 0 when dynamic FOV is off, else the Dynamic scale setting.

import gg.auroras.client.AurorasRender;
import net.minecraft.client.player.AbstractClientPlayer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(AbstractClientPlayer.class)
public abstract class FovEffectMixin {
    @ModifyVariable(method = "getFieldOfViewModifier", at = @At("HEAD"), argsOnly = true, ordinal = 0)
    private float auroras$fovEffect(float scale) { return AurorasRender.fovEffect(scale); }
}
