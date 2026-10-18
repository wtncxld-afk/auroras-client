package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Every injection here is optional (auroras.mixins.json sets
// defaultRequire 0): if a name differs in some version, that one feature stays off and the game still starts.
// Zoom (the world's field of view, not the hand's) and the totem pop hook (GameRenderer#displayItemActivation is what
// the game calls when your own totem of undying is used).

import gg.auroras.client.AurorasModules;
import net.minecraft.client.Camera;
import net.minecraft.client.renderer.GameRenderer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
    @Inject(method = "getFov(Lnet/minecraft/client/Camera;FZ)F", at = @At("RETURN"), cancellable = true)
    private void auroras$zoom(Camera camera, float partialTick, boolean useFovSetting, CallbackInfoReturnable<Float> cir) {
        if (useFovSetting) cir.setReturnValue(AurorasModules.fov(cir.getReturnValueF()));
    }
    @Inject(method = "displayItemActivation(Lnet/minecraft/world/item/ItemStack;)V", at = @At("HEAD"))
    private void auroras$totem(ItemStack stack, CallbackInfo ci) { if (stack.is(Items.TOTEM_OF_UNDYING)) AurorasModules.totemPopped(); }
}
