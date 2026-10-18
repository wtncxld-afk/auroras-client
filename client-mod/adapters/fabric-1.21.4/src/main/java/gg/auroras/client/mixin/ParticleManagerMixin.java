package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Particle Settings: keeps the chosen share of new particles and drops the types you
// turned off. Targets: ParticleManager#addParticle(ParticleEffect, 6 doubles) -> Particle (returning null is what the
// game does when it skips a particle), addBlockBreakParticles(BlockPos, BlockState) and addBlockBreakingParticles(BlockPos, Direction).

import gg.auroras.client.AurorasModules;
import net.minecraft.block.BlockState;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleManager;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ParticleManager.class)
public abstract class ParticleManagerMixin {
    @Inject(method = "addParticle(Lnet/minecraft/particle/ParticleEffect;DDDDDD)Lnet/minecraft/client/particle/Particle;", at = @At("HEAD"), cancellable = true)
    private void auroras$filter(ParticleEffect effect, double x, double y, double z, double vx, double vy, double vz, CallbackInfoReturnable<Particle> cir) {
        if (!AurorasModules.particles()) return;
        Identifier id = Registries.PARTICLE_TYPE.getId(effect.getType());
        if (!AurorasModules.keepParticle(id == null ? "" : id.toString())) cir.setReturnValue(null);
    }
    @Inject(method = "addBlockBreakParticles", at = @At("HEAD"), cancellable = true)
    private void auroras$noBreak(BlockPos pos, BlockState state, CallbackInfo ci) { if (AurorasModules.hideBlockBreak()) ci.cancel(); }
    @Inject(method = "addBlockBreakingParticles", at = @At("HEAD"), cancellable = true)
    private void auroras$noBreaking(BlockPos pos, Direction dir, CallbackInfo ci) { if (AurorasModules.hideBlockBreak()) ci.cancel(); }
}
