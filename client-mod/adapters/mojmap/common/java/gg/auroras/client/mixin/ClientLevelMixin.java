package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Optional like every injection here (defaultRequire 0).
// Particle Settings "Hide block breaking": the block-break and block-crack effects live in ClientLevel
// (addDestroyBlockEffect, and addBreakingBlockEffect, renamed addBreakingBlockEffects with a boolean in 26.3). Names
// checked with javap against the 1.21.11, 26.1, 26.2 and 26.3 jars.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.world.level.block.state.BlockState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ClientLevel.class)
public abstract class ClientLevelMixin {
    @Inject(method = "addDestroyBlockEffect(Lnet/minecraft/core/BlockPos;Lnet/minecraft/world/level/block/state/BlockState;)V", at = @At("HEAD"), cancellable = true)
    private void auroras$noBreak(BlockPos pos, BlockState state, CallbackInfo ci) { if (AurorasModules.hideBlockBreak()) ci.cancel(); }
    @Inject(method = "addBreakingBlockEffect(Lnet/minecraft/core/BlockPos;Lnet/minecraft/core/Direction;)V", at = @At("HEAD"), cancellable = true)
    private void auroras$noCrack(BlockPos pos, Direction side, CallbackInfo ci) { if (AurorasModules.hideBlockBreak()) ci.cancel(); }
    // 26.3 renamed the crack effect to addBreakingBlockEffects(BlockPos, Direction, boolean)
    @Inject(method = "addBreakingBlockEffects(Lnet/minecraft/core/BlockPos;Lnet/minecraft/core/Direction;Z)V", at = @At("HEAD"), cancellable = true)
    private void auroras$noCracks(BlockPos pos, Direction side, boolean flag, CallbackInfo ci) { if (AurorasModules.hideBlockBreak()) ci.cancel(); }
}
