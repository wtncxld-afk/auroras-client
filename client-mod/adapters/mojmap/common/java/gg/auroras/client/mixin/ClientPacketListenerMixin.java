package gg.auroras.client.mixin;

import gg.auroras.client.AurorasSpirit;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.network.protocol.game.ClientboundEntityEventPacket;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Totem Spirit: entity event 35 is a totem of undying popping. TAIL runs on the render thread only (the packet is re-queued there first). */
@Mixin(ClientPacketListener.class)
public abstract class ClientPacketListenerMixin {
    @Inject(method = "handleEntityEvent", at = @At("TAIL"))
    private void auroras$totem(ClientboundEntityEventPacket packet, CallbackInfo ci) {
        if (packet.getEventId() != 35) return; Minecraft mc = Minecraft.getInstance();
        if (mc.level != null) AurorasSpirit.popped(packet.getEntity(mc.level));
    }
}
