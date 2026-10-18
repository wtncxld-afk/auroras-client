package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Every injection here is optional (auroras.mixins.json sets
// defaultRequire 0): if a name differs in some version, that one feature stays off and the game still starts.
// Player Glow's color: your own player's outline uses your color while the module is on (Entity#getTeamColor).

import gg.auroras.client.AurorasModules;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Entity.class)
public abstract class EntityMixin {
    @Inject(method = "getTeamColor()I", at = @At("RETURN"), cancellable = true)
    private void auroras$color(CallbackInfoReturnable<Integer> cir) { if (AurorasModules.glows((Object) this)) cir.setReturnValue(AurorasModules.glowColor()); }
}
