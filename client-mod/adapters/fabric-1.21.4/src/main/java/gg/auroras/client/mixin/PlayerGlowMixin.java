package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Player Glow (outline): only your own player, in third person. Other players'
// outlines are untouched. Target: MinecraftClient#hasOutline(Entity). The color is in PlayerGlowColorMixin.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(MinecraftClient.class)
public abstract class PlayerGlowMixin {
    @Inject(method = "hasOutline", at = @At("RETURN"), cancellable = true)
    private void auroras$outline(Entity entity, CallbackInfoReturnable<Boolean> cir) { if (!cir.getReturnValueZ() && AurorasModules.glows(entity)) cir.setReturnValue(true); }
}
