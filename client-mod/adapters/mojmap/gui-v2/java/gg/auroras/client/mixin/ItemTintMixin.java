package gg.auroras.client.mixin;

import gg.auroras.client.AurorasHands;
import net.minecraft.client.renderer.Sheets;
import net.minecraft.client.renderer.feature.ItemFeatureRenderer;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.resources.model.geometry.BakedQuad;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyArg;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Minecraft 26.x: blade skins and Hand Aura colour the quads of items the hand renderer marked (AurorasHands' tint
 * arrays). 26.x looks every quad's colour up through getLayerColorSafe(tints, material), so that is where a marked item
 * gets its colour; aura quads then take the translucent item sheet for the vertex buffer chosen right after
 * (26.1 asks the buffer source in renderItem, 26.2 and 26.3 call getVertexBuilder in prepareMainSubmit).
 */
@Mixin(ItemFeatureRenderer.class)
public abstract class ItemTintMixin {
    @Inject(method = "getLayerColorSafe([ILnet/minecraft/client/resources/model/geometry/BakedQuad$MaterialInfo;)I", at = @At("HEAD"), cancellable = true)
    private static void auroras$color(int[] tints, BakedQuad.MaterialInfo info, CallbackInfoReturnable<Integer> cir) {
        AurorasHands.auraQuad = tints == AurorasHands.AURA_MARK;
        int c = AurorasHands.markedColor(tints); if (c != Integer.MIN_VALUE) cir.setReturnValue(c);
    }
    @ModifyArg(method = "renderItem", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/MultiBufferSource$BufferSource;getBuffer(Lnet/minecraft/client/renderer/rendertype/RenderType;)Lcom/mojang/blaze3d/vertex/VertexConsumer;"))
    private RenderType auroras$auraBuffer(RenderType type) { if (!AurorasHands.auraQuad) return type; AurorasHands.auraQuad = false; return Sheets.translucentItemSheet(); }
    @ModifyArg(method = "prepareMainSubmit", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/feature/ItemFeatureRenderer;getVertexBuilder(Lnet/minecraft/client/renderer/rendertype/RenderType;)Lcom/mojang/blaze3d/vertex/VertexConsumer;"))
    private RenderType auroras$auraBuilder(RenderType type) { if (!AurorasHands.auraQuad) return type; AurorasHands.auraQuad = false; return Sheets.translucentItemSheet(); }
}
