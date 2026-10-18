package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Player Glow (color): your own player's outline uses your color while the module is
// on. Target: Entity#getTeamColorValue(). Costs one boolean check for every other entity.

import gg.auroras.client.AurorasModules;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Entity.class)
public abstract class PlayerGlowColorMixin {
    @Inject(method = "getTeamColorValue", at = @At("RETURN"), cancellable = true)
    private void auroras$color(CallbackInfoReturnable<Integer> cir) { if (AurorasModules.glows((Object) this)) cir.setReturnValue(AurorasModules.glowColor()); }
}
