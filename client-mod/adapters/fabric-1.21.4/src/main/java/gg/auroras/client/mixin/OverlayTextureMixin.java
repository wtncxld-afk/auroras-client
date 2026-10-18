package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Hit Color: the red tint on hurt entities comes from the top 8 rows of the overlay
// texture, which the game fills once at start-up (vanilla 0xB2FF0000). This swaps in your color, so changes apply after a
// game restart (the registry note says so). Target: NativeImage#setColorArgb(III) calls in OverlayTexture's constructor.

import gg.auroras.client.AurorasClient;
import gg.auroras.core.GameLogic;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.texture.NativeImage;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(OverlayTexture.class)
public abstract class OverlayTextureMixin {
    @Redirect(method = "<init>", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/texture/NativeImage;setColorArgb(III)V"))
    private void auroras$hitColor(NativeImage img, int x, int y, int color) {
        if (y < 8 && AurorasClient.PM.enabled("hitcolor")) {
            try { color = GameLogic.hitColor(Integer.parseInt(AurorasClient.PM.get("hitcolor.color"), 16), Integer.parseInt(AurorasClient.PM.get("hitcolor.opacity"))); } catch (RuntimeException ignored) { }
        }
        img.setColorArgb(x, y, color);
    }
}
