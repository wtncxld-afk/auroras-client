package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Every injection here is optional (auroras.mixins.json sets
// defaultRequire 0): if a name differs in some version, that one feature stays off and the game still starts.
// Particle Settings: keeps the chosen share of new particles and drops the types you turned off (returning null is what
// the game itself does when it skips a particle), and can skip block-breaking particles.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleEngine;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ParticleEngine.class)
public abstract class ParticleEngineMixin {
    @Inject(method = "createParticle(Lnet/minecraft/core/particles/ParticleOptions;DDDDDD)Lnet/minecraft/client/particle/Particle;", at = @At("HEAD"), cancellable = true)
    private void auroras$filter(ParticleOptions options, double x, double y, double z, double vx, double vy, double vz, CallbackInfoReturnable<Particle> cir) {
        if (!AurorasModules.particles()) return;
        Identifier id = BuiltInRegistries.PARTICLE_TYPE.getKey(options.getType());
        if (!AurorasModules.keepParticle(id == null ? "" : id.toString())) cir.setReturnValue(null);
    }
    @Inject(method = "destroy(Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/state/BlockState;)V", at = @At("HEAD"), cancellable = true)
    private void auroras$noBreak(BlockPos pos, BlockState state, CallbackInfo ci) { if (AurorasModules.hideBlockBreak()) ci.cancel(); }
    @Inject(method = "crack(Lnet/minecraft/core/BlockPos;Lnet/minecraft/core/Direction;)V", at = @At("HEAD"), cancellable = true)
    private void auroras$noCrack(BlockPos pos, Direction side, CallbackInfo ci) { if (AurorasModules.hideBlockBreak()) ci.cancel(); }
}
