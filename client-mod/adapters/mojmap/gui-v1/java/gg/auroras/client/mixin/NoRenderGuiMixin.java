package gg.auroras.client.mixin;

// ADAPTER mojmap, gui-v1 (1.21.11). Optional (defaultRequire 0). No Render's HUD overlays, in Gui (javap -c of
// renderCameraOverlays): renderTextureOverlay draws the carved pumpkin's blur (any helmet's camera overlay) and the powder
// snow frost, renderVignette the dark screen edges and renderPortalOverlay the nether portal swirl. gui-v2 has the same
// hooks under their 26.x names.

import gg.auroras.client.AurorasRender;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.resources.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Gui.class)
public abstract class NoRenderGuiMixin {
    @Inject(method = "renderTextureOverlay", at = @At("HEAD"), cancellable = true)
    private void auroras$noOverlay(GuiGraphics g, Identifier texture, float alpha, CallbackInfo ci) {
        if (AurorasRender.noRender().hidesOverlay(texture.getPath())) ci.cancel();
    }
    @Inject(method = "renderVignette", at = @At("HEAD"), cancellable = true)
    private void auroras$noVignette(CallbackInfo ci) { if (AurorasRender.noRender().vignette()) ci.cancel(); }
    @Inject(method = "renderPortalOverlay", at = @At("HEAD"), cancellable = true)
    private void auroras$noPortal(CallbackInfo ci) { if (AurorasRender.noRender().portal()) ci.cancel(); }
}
