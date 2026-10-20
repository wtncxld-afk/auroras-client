package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). Optional injection (defaultRequire 0): if the name differs in some version,
// Nameplate Styling simply leaves Minecraft's nametags alone there. Nameplate Styling: when Minecraft decides to show a
// player's nametag (AvatarRenderer#shouldShowName, checked with javap on all four targets), the player is handed to
// AurorasWorld, which draws the glass plate itself, only when that player is in your line of sight; the vanilla tag is
// then skipped. Players Minecraft would hide (teams, sneaking, invisibility) stay hidden: nothing new is revealed.

import gg.auroras.client.AurorasWorld;
import net.minecraft.client.renderer.entity.player.AvatarRenderer;
import net.minecraft.world.entity.Avatar;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(AvatarRenderer.class)
public abstract class AvatarNameMixin {
    @Inject(method = "shouldShowName(Lnet/minecraft/world/entity/Avatar;D)Z", at = @At("RETURN"), cancellable = true)
    private void auroras$plate(Avatar entity, double distanceSq, CallbackInfoReturnable<Boolean> cir) {
        if (cir.getReturnValueZ() && AurorasWorld.takeNameplate(entity)) cir.setReturnValue(false);
    }
}
