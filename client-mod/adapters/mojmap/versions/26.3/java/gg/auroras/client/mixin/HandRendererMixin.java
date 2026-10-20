package gg.auroras.client.mixin;

// Minecraft 26.3 only (versions/26.3): the first-person hand renderer (FirstPersonHandsAndItemsRenderer#submitArmWithItem). Swing Animation
// changes the swing progress and the held item's offsets, Weapon Inspect adds its pose, blade skins and Hand Aura mark the
// item for ItemTintMixin, and Stream Hide can skip a hand that holds something. All drawing only, on your own screen.

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.llamalad7.mixinextras.sugar.Local;
import com.mojang.blaze3d.vertex.PoseStack;
import gg.auroras.client.AurorasHands;
import net.minecraft.client.renderer.FirstPersonHandsAndItemsRenderer;
import net.minecraft.client.renderer.item.ItemStackRenderState;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(FirstPersonHandsAndItemsRenderer.class)
public abstract class HandRendererMixin {
    private static final int FULL_BRIGHT = 0xF000F0;
    /** The swing progress argument (the third float: partial tick, pitch, swing, equip). */
    @ModifyVariable(method = "submitArmWithItem", at = @At("HEAD"), argsOnly = true, ordinal = 2)
    private float auroras$swing(float progress) { return AurorasHands.swing(progress); }
    @Inject(method = "submitArmWithItem", at = @At("HEAD"), cancellable = true)
    private void auroras$hideHeld(CallbackInfo ci, @Local(argsOnly = true) ItemStack stack) { AurorasHands.idle(); if (AurorasHands.hideHeld(stack)) ci.cancel(); }
    @WrapOperation(method = "submitArmWithItem", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/item/ItemStackRenderState;submit(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;III)V"))
    private void auroras$item(ItemStackRenderState state, PoseStack pose, SubmitNodeCollector collector, int light, int overlay, int outline, Operation<Void> op, @Local(argsOnly = true) InteractionHand hand, @Local(argsOnly = true) ItemStack held) {
        boolean pushed = AurorasHands.before(pose, hand, held);
        op.call(state, pose, collector, light, overlay, outline);
        AurorasHands.marking = 0;
        for (int i = AurorasHands.auraItemLayers() - 1; i >= 0; i--) if (AurorasHands.auraBegin(pose, i)) { op.call(state, pose, collector, FULL_BRIGHT, overlay, outline); AurorasHands.auraEnd(pose); }
        AurorasHands.after(pose, pushed);
    }
    // 26.3 computes the hand height in its render state extraction; the cooldown-dip option isn't hooked here yet.
}
