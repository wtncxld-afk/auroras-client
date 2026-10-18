package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Freelook: while active, the camera uses the freelook rotation instead of the
// player's, so you can look around while the player keeps facing forward. Target: the setRotation(FF) call inside
// Camera#update(BlockView, Entity, boolean thirdPerson, boolean inverseView, float tickDelta).

import gg.auroras.client.AurorasModules;
import net.minecraft.client.render.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(Camera.class)
public abstract class CameraMixin {
    @Shadow protected abstract void setRotation(float yaw, float pitch);
    @Redirect(method = "update", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/Camera;setRotation(FF)V", ordinal = 0))
    private void auroras$freelook(Camera self, float yaw, float pitch) {
        if (AurorasModules.freelook()) setRotation(AurorasModules.freelookYaw(), AurorasModules.freelookPitch()); else setRotation(yaw, pitch);
    }
}
