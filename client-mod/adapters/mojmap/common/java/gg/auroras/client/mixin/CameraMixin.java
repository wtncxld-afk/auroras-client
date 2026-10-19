package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). Every injection here is optional (auroras.mixins.json sets
// defaultRequire 0): if a name differs in some version, that one feature stays off and the game still starts.
// Freelook: while active, the camera takes the freelook rotation instead of the player's, so you can look around while
// the player keeps facing forward. Changes only the arguments of the two setRotation calls that align the camera with the
// player (in a minecart and normally): in Camera#setup on 1.21.11, Camera#alignWithEntity on 26.x (checked with javap -c).
// Zoom on 26.x: the world's field of view moved from GameRenderer#getFov to Camera#calculateFov (the hand has its own
// calculateHudFov, left alone). On 1.21.11 GameRendererMixin does it.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyArg;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(Camera.class)
public abstract class CameraMixin {
    // ordinal 0 is the camera riding a new-style minecart, ordinal 1 the normal case; the front-view mirror after them
    // reads the camera's own (already replaced) rotation, so it follows.
    @ModifyArg(method = { "setup", "alignWithEntity" }, at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V", ordinal = 0), index = 0)
    private float auroras$cartYaw(float yaw) { return AurorasModules.freelook() ? AurorasModules.freelookYaw() : yaw; }
    @ModifyArg(method = { "setup", "alignWithEntity" }, at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V", ordinal = 0), index = 1)
    private float auroras$cartPitch(float pitch) { return AurorasModules.freelook() ? AurorasModules.freelookPitch() : pitch; }
    @ModifyArg(method = { "setup", "alignWithEntity" }, at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V", ordinal = 1), index = 0)
    private float auroras$yaw(float yaw) { return AurorasModules.freelook() ? AurorasModules.freelookYaw() : yaw; }
    @ModifyArg(method = { "setup", "alignWithEntity" }, at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V", ordinal = 1), index = 1)
    private float auroras$pitch(float pitch) { return AurorasModules.freelook() ? AurorasModules.freelookPitch() : pitch; }
    @Inject(method = "calculateFov(F)F", at = @At("RETURN"), cancellable = true)
    private void auroras$zoom(float partialTick, CallbackInfoReturnable<Float> cir) { cir.setReturnValue(AurorasModules.fov(cir.getReturnValueF())); }
}
