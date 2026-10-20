package gg.auroras.client.mixin;

// Minecraft 1.21.11 only (versions/1.21.11): the first-person hand renderer (ItemInHandRenderer#renderArmWithItem). Swing Animation
// changes the swing progress and the held item's offsets, Weapon Inspect adds its pose, blade skins and Hand Aura mark the
// item for ItemTintMixin, and Stream Hide can skip a hand that holds something. All drawing only, on your own screen.

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import com.llamalad7.mixinextras.sugar.Local;
import com.mojang.blaze3d.vertex.PoseStack;
import gg.auroras.client.AurorasHands;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.client.renderer.ItemInHandRenderer;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemDisplayContext;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.Redirect;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(ItemInHandRenderer.class)
public abstract class HandRendererMixin {
    private static final int FULL_BRIGHT = 0xF000F0;
    /** The swing progress argument (the third float: partial tick, pitch, swing, equip). */
    @ModifyVariable(method = "renderArmWithItem", at = @At("HEAD"), argsOnly = true, ordinal = 2)
    private float auroras$swing(float progress) { return AurorasHands.swing(progress); }
    @Inject(method = "renderArmWithItem", at = @At("HEAD"), cancellable = true)
    private void auroras$hideHeld(CallbackInfo ci, @Local(argsOnly = true) ItemStack stack) { AurorasHands.idle(); if (AurorasHands.hideHeld(stack)) ci.cancel(); }
    @WrapOperation(method = "renderArmWithItem", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/renderer/ItemInHandRenderer;renderItem(Lnet/minecraft/world/entity/LivingEntity;Lnet/minecraft/world/item/ItemStack;Lnet/minecraft/world/item/ItemDisplayContext;Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;I)V"))
    private void auroras$item(ItemInHandRenderer self, LivingEntity entity, ItemStack stack, ItemDisplayContext context, PoseStack pose, SubmitNodeCollector collector, int light, Operation<Void> op, @Local(argsOnly = true) InteractionHand hand, @Local(argsOnly = true) ItemStack held) {
        boolean pushed = AurorasHands.before(pose, hand, held);
        op.call(self, entity, stack, context, pose, collector, light);
        AurorasHands.marking = 0;
        for (int i = AurorasHands.auraItemLayers() - 1; i >= 0; i--) if (AurorasHands.auraBegin(pose, i)) { op.call(self, entity, stack, context, pose, collector, FULL_BRIGHT); AurorasHands.auraEnd(pose); }
        AurorasHands.after(pose, pushed);
    }
    /** The attack-cooldown dip of the held item (Swing Animation's "no cooldown dip" and the 1.7 style). */
    @Redirect(method = "tick", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/player/LocalPlayer;getItemSwapScale(F)F"))
    private float auroras$dip(LocalPlayer player, float partial) { return AurorasHands.swapScale(player.getItemSwapScale(partial)); }
}
