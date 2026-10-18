package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Every injection here is optional (auroras.mixins.json sets
// defaultRequire 0): if a name differs in some version, that one feature stays off and the game still starts.
// Resets the CPS window when the game window loses focus, so clicks made in other programs never count. Also Player
// Glow's outline: only your own player, only in third person (Minecraft#shouldEntityAppearGlowing).

import gg.auroras.client.AurorasModules;
import gg.auroras.client.HudRendererAccess;
import net.minecraft.client.Minecraft;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Minecraft.class)
public abstract class MinecraftMixin {
    @Inject(method = "setWindowActive(Z)V", at = @At("HEAD"))
    private void auroras$focus(boolean active, CallbackInfo ci) { if (!active) HudRendererAccess.focusLost(); }
    @Inject(method = "shouldEntityAppearGlowing(Lnet/minecraft/world/entity/Entity;)Z", at = @At("RETURN"), cancellable = true)
    private void auroras$glow(Entity entity, CallbackInfoReturnable<Boolean> cir) { if (!cir.getReturnValueZ() && AurorasModules.glows(entity)) cir.setReturnValue(true); }
}
