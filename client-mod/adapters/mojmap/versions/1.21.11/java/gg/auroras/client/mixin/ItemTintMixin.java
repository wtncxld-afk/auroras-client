package gg.auroras.client.mixin;

import com.llamalad7.mixinextras.injector.ModifyExpressionValue;
import com.llamalad7.mixinextras.sugar.Local;
import gg.auroras.client.AurorasHands;
import net.minecraft.client.renderer.entity.ItemRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Minecraft 1.21.11: blade skins and Hand Aura colour the quads of items the hand renderer marked (AurorasHands' tint
 * arrays, passed through untouched to here). Untinted quads normally skip the tint lookup, so marked ones are treated as
 * tinted; every other item is drawn exactly as before.
 */
@Mixin(ItemRenderer.class)
public abstract class ItemTintMixin {
    @ModifyExpressionValue(method = "renderQuadList", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/block/model/BakedQuad;isTinted()Z"))
    private static boolean auroras$tinted(boolean tinted, @Local(argsOnly = true) int[] tints) { return tinted || AurorasHands.marked(tints); }
    @Inject(method = "getLayerColorSafe([II)I", at = @At("HEAD"), cancellable = true)
    private static void auroras$color(int[] tints, int index, CallbackInfoReturnable<Integer> cir) {
        int c = AurorasHands.markedColor(tints); if (c != Integer.MIN_VALUE) cir.setReturnValue(c);
    }
}
