package gg.auroras.client.mixin;

import gg.auroras.client.AurorasStream;
import gg.auroras.client.platform.Gfx;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.world.inventory.Slot;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Stream Hide Inventory: items in your own inventory slots (and their tooltips) aren't drawn while hiding; the slots still work. */
@Mixin(AbstractContainerScreen.class)
public abstract class ContainerScreenMixin {
    @Shadow protected Slot hoveredSlot;
    @Inject(method = "extractSlot(Lnet/minecraft/client/gui/GuiGraphicsExtractor;Lnet/minecraft/world/inventory/Slot;II)V", at = @At("HEAD"), cancellable = true)
    private void auroras$hideSlot(GuiGraphicsExtractor g, Slot slot, int mx, int my, CallbackInfo ci) {
        if (AurorasStream.hideSlot(slot)) { AurorasStream.cover(new Gfx(g), slot.x, slot.y); ci.cancel(); }
    }
    @Inject(method = "extractTooltip(Lnet/minecraft/client/gui/GuiGraphicsExtractor;II)V", at = @At("HEAD"), cancellable = true)
    private void auroras$hideTooltip(GuiGraphicsExtractor g, int mx, int my, CallbackInfo ci) { if (AurorasStream.hideTooltip(hoveredSlot)) ci.cancel(); }
}
