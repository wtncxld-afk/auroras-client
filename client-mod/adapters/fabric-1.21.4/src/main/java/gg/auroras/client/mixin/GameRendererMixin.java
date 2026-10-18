package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Zoom (field of view) and the totem pop hook.
// Targets: GameRenderer#getFov(Camera, float, boolean) -> float; GameRenderer#showFloatingItem(ItemStack), which the
// game calls when the local player's totem of undying is used.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.render.Camera;
import net.minecraft.client.render.GameRenderer;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
    @Inject(method = "getFov", at = @At("RETURN"), cancellable = true)
    private void auroras$zoom(Camera camera, float tickDelta, boolean changingFov, CallbackInfoReturnable<Float> cir) {
        if (changingFov) cir.setReturnValue(AurorasModules.fov(cir.getReturnValueF()));
    }
    @Inject(method = "showFloatingItem", at = @At("HEAD"))
    private void auroras$totem(ItemStack floatingItem, CallbackInfo ci) { if (floatingItem.isOf(Items.TOTEM_OF_UNDYING)) AurorasModules.totemPopped(); }
}
