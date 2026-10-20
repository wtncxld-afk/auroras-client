package gg.auroras.client.mixin;

// ADAPTER mojmap. Optional (defaultRequire 0). No Render "explosions": drops explosion (and wind charge gust) particles,
// whether or not Particle Settings is on. Same hook as ParticleEngineMixin (returning null is how the game skips a particle).

import gg.auroras.client.AurorasRender;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleEngine;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ParticleEngine.class)
public abstract class NoRenderParticleMixin {
    @Inject(method = "createParticle(Lnet/minecraft/core/particles/ParticleOptions;DDDDDD)Lnet/minecraft/client/particle/Particle;", at = @At("HEAD"), cancellable = true)
    private void auroras$noExplosions(ParticleOptions options, double x, double y, double z, double vx, double vy, double vz, CallbackInfoReturnable<Particle> cir) {
        if (!AurorasRender.noRender().explosions()) return;
        Identifier id = BuiltInRegistries.PARTICLE_TYPE.getKey(options.getType());
        if (id != null && AurorasRender.NO.hidesParticle(id.toString())) cir.setReturnValue(null);
    }
}
