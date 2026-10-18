package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Resets the CPS window when the game window loses focus, so clicks made in other
// programs never show up. Target: net.minecraft.client.MinecraftClient#onWindowFocusChanged(boolean).

import gg.auroras.client.HudRendererAccess;
import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
    @Inject(method = "onWindowFocusChanged", at = @At("HEAD"))
    private void auroras$focus(boolean focused, CallbackInfo ci) { if (!focused) HudRendererAccess.focusLost(); }
}
