package gg.auroras.client.mixin;

// ADAPTER mojmap. Optional injection (defaultRequire 0). Totem Effects on 26.3, where the totem pop animation moved from
// GameRenderer#displayItemActivation to LocalPlayer#displayItemActivation (checked with javap). Earlier versions are
// handled by GameRendererMixin; LocalPlayer has no such method there, so this does nothing on them.

import gg.auroras.client.AurorasModules;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LocalPlayer.class)
public abstract class LocalPlayerMixin {
    @Inject(method = "displayItemActivation(Lnet/minecraft/world/item/ItemStack;)V", at = @At("HEAD"))
    private void auroras$totem(ItemStack stack, CallbackInfo ci) { if (stack.is(Items.TOTEM_OF_UNDYING)) AurorasModules.totemPopped(); }
}
