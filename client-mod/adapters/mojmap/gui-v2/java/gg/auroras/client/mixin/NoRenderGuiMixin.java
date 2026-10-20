package gg.auroras.client.mixin;

// ADAPTER mojmap, gui-v2 (26.x). Optional (defaultRequire 0). No Render's HUD overlays: extractTextureOverlay draws the
// carved pumpkin's blur (any helmet's camera overlay) and the powder snow frost, extractVignette the dark screen edges and
// extractPortalOverlay the nether portal swirl (javap). They are on Gui in 26.1 and moved to Gui's new Hud class in 26.2
// and 26.3, so this targets both by name (@Pseudo): on each release only the class that has them is changed.

import gg.auroras.client.AurorasRender;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.resources.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Pseudo;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Pseudo
@Mixin(targets = { "net.minecraft.client.gui.Gui", "net.minecraft.client.gui.Hud" })
public abstract class NoRenderGuiMixin {
    @Inject(method = "extractTextureOverlay", at = @At("HEAD"), cancellable = true)
    private void auroras$noOverlay(GuiGraphicsExtractor g, Identifier texture, float alpha, CallbackInfo ci) {
        if (AurorasRender.noRender().hidesOverlay(texture.getPath())) ci.cancel();
    }
    @Inject(method = "extractVignette", at = @At("HEAD"), cancellable = true)
    private void auroras$noVignette(CallbackInfo ci) { if (AurorasRender.noRender().vignette()) ci.cancel(); }
    @Inject(method = "extractPortalOverlay", at = @At("HEAD"), cancellable = true)
    private void auroras$noPortal(CallbackInfo ci) { if (AurorasRender.noRender().portal()) ci.cancel(); }
}
