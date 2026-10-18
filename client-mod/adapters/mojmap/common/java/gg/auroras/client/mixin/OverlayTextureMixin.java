package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Every injection here is optional (auroras.mixins.json sets
// defaultRequire 0): if a name differs in some version, that one feature stays off and the game still starts.
// Hit Color: the red tint on hurt entities comes from the top 8 rows of the overlay texture, which the game fills once at
// start-up (vanilla 0xB2FF0000). This swaps in your color, so changes apply after a game restart (the module says so).

import com.mojang.blaze3d.platform.NativeImage;
import gg.auroras.client.AurorasClient;
import gg.auroras.core.GameLogic;
import net.minecraft.client.renderer.texture.OverlayTexture;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Redirect;

@Mixin(OverlayTexture.class)
public abstract class OverlayTextureMixin {
    @Redirect(method = "<init>", at = @At(value = "INVOKE", target = "Lcom/mojang/blaze3d/platform/NativeImage;setPixel(III)V"))
    private void auroras$hitColor(NativeImage img, int x, int y, int color) {
        if (y < 8 && AurorasClient.PM != null && AurorasClient.PM.enabled("hitcolor")) {
            try { color = GameLogic.hitColor(Integer.parseInt(AurorasClient.PM.get("hitcolor.color"), 16), Integer.parseInt(AurorasClient.PM.get("hitcolor.opacity"))); } catch (RuntimeException ignored) { }
        }
        img.setPixel(x, y, color);
    }
}
