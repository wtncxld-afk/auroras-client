package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Every injection here is optional (auroras.mixins.json sets
// defaultRequire 0): if a name differs in some version, that one feature stays off and the game still starts.
// Freelook: while active, the camera takes the freelook rotation instead of the player's, so you can look around while
// the player keeps facing forward. Changes only the arguments of the first setRotation call in Camera#setup.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyArg;

@Mixin(Camera.class)
public abstract class CameraMixin {
    @ModifyArg(method = "setup", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V", ordinal = 0), index = 0)
    private float auroras$yaw(float yaw) { return AurorasModules.freelook() ? AurorasModules.freelookYaw() : yaw; }
    @ModifyArg(method = "setup", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V", ordinal = 0), index = 1)
    private float auroras$pitch(float pitch) { return AurorasModules.freelook() ? AurorasModules.freelookPitch() : pitch; }
}
