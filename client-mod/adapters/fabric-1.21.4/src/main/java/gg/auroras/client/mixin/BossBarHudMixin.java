package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Boss Bar: hides Minecraft's boss bars, or moves and scales them around the top
// centre of the screen. Target: BossBarHud#render(DrawContext).

import gg.auroras.client.AurorasModules;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.BossBarHud;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(BossBarHud.class)
public abstract class BossBarHudMixin {
    private boolean auroras$pushed;
    @Inject(method = "render", at = @At("HEAD"), cancellable = true)
    private void auroras$before(DrawContext ctx, CallbackInfo ci) {
        auroras$pushed = false; if (!AurorasModules.bossBar()) return;
        if (AurorasModules.bossHidden()) { ci.cancel(); return; }
        float s = AurorasModules.bossScale(), cx = ctx.getScaledWindowWidth() / 2f;
        ctx.getMatrices().push(); ctx.getMatrices().translate(cx, AurorasModules.bossOffY(), 0); ctx.getMatrices().scale(s, s, 1f); ctx.getMatrices().translate(-cx, 0, 0); auroras$pushed = true;
    }
    @Inject(method = "render", at = @At("RETURN"))
    private void auroras$after(DrawContext ctx, CallbackInfo ci) { if (auroras$pushed) { ctx.getMatrices().pop(); auroras$pushed = false; } }
}
