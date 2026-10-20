package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). Optional injection (defaultRequire 0). Particle System "Totem pops": when
// any entity in view pops a totem, Minecraft starts a tracking emitter of totem particles on it
// (ParticleEngine#createTrackingEmitter(Entity, ParticleOptions, int), same signature on all four targets, checked with
// javap). AurorasWorld adds a themed burst there, and can replace the vanilla particles. Local only.

import gg.auroras.client.AurorasWorld;
import net.minecraft.client.particle.ParticleEngine;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ParticleEngine.class)
public abstract class ParticleTotemMixin {
    @Inject(method = "createTrackingEmitter(Lnet/minecraft/world/entity/Entity;Lnet/minecraft/core/particles/ParticleOptions;I)V", at = @At("HEAD"), cancellable = true)
    private void auroras$totem(Entity entity, ParticleOptions options, int lifetime, CallbackInfo ci) {
        if (options.getType() == ParticleTypes.TOTEM_OF_UNDYING && AurorasWorld.totemPop(entity)) ci.cancel();
    }
}
