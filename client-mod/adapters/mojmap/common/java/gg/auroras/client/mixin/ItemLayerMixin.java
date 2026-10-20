package gg.auroras.client.mixin;

import gg.auroras.client.AurorasHands;
import net.minecraft.client.renderer.Sheets;
import net.minecraft.client.renderer.item.ItemStackRenderState;
import net.minecraft.client.renderer.rendertype.RenderType;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyArg;

/**
 * Blade skins and Hand Aura: while the hand renderer submits a marked item (AurorasHands.marking), its empty tint array is
 * swapped for one of ours, which ItemTintMixin recognises when the item is really drawn. The submit call's descriptor
 * differs per release (1.21.11 passes a render type, 26.1/26.2 a quad list, 26.3 ItemQuads), so there is one handler per
 * shape; the ones that don't match this release simply don't apply.
 */
@Mixin(ItemStackRenderState.LayerRenderState.class)
public abstract class ItemLayerMixin {
    // 1.21.11
    @ModifyArg(method = "submit", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/SubmitNodeCollector;submitItem(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/world/item/ItemDisplayContext;III[ILjava/util/List;Lnet/minecraft/client/renderer/rendertype/RenderType;Lnet/minecraft/client/renderer/item/ItemStackRenderState$FoilType;)V"), index = 5)
    private int[] auroras$tintsA(int[] tints) { return AurorasHands.tints(tints); }
    // 1.21.11: the aura is drawn translucent
    @ModifyArg(method = "submit", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/SubmitNodeCollector;submitItem(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/world/item/ItemDisplayContext;III[ILjava/util/List;Lnet/minecraft/client/renderer/rendertype/RenderType;Lnet/minecraft/client/renderer/item/ItemStackRenderState$FoilType;)V"), index = 7)
    private RenderType auroras$typeA(RenderType type) { return AurorasHands.marking == 2 ? Sheets.translucentItemSheet() : type; }
    // 26.1, 26.2
    @ModifyArg(method = "submit", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/SubmitNodeCollector;submitItem(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/world/item/ItemDisplayContext;III[ILjava/util/List;Lnet/minecraft/client/renderer/item/ItemStackRenderState$FoilType;)V"), index = 5)
    private int[] auroras$tintsB(int[] tints) { return AurorasHands.tints(tints); }
    // 26.3
    @ModifyArg(method = "submit", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/SubmitNodeCollector;submitItem(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/world/item/ItemDisplayContext;III[ILnet/minecraft/client/resources/model/geometry/ItemQuads;Lnet/minecraft/client/renderer/item/ItemStackRenderState$FoilType;)V"), index = 5)
    private int[] auroras$tintsC(int[] tints) { return AurorasHands.tints(tints); }
}
