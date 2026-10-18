package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Crosshair Customizer: draws the Auroras crosshair instead of Minecraft's (or none in
// third person when that setting is on). Only cancels when the module is on. Target: InGameHud#renderCrosshair(DrawContext, RenderTickCounter).

import gg.auroras.client.AurorasModules;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.render.RenderTickCounter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(InGameHud.class)
public abstract class InGameHudMixin {
    @Inject(method = "renderCrosshair", at = @At("HEAD"), cancellable = true)
    private void auroras$crosshair(DrawContext ctx, RenderTickCounter tick, CallbackInfo ci) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player != null && !mc.player.isSpectator() && !mc.getDebugHud().shouldShowDebugHud() && AurorasModules.crosshair(ctx, mc)) ci.cancel();
    }
}
