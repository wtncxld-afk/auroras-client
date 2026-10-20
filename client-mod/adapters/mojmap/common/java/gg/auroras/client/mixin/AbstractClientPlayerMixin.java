package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Optional injection (defaultRequire 0): if getSkin is renamed in
// some version, Custom Capes simply stays off there. Custom Capes, LOCAL ONLY: AurorasCape.skin changes the skin of your
// own player only (the cape texture becomes config/auroras/cape.png). Other players' skins are returned untouched and
// nothing is sent anywhere, so nobody else sees the cape.

import gg.auroras.client.AurorasCape;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.world.entity.player.PlayerSkin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(AbstractClientPlayer.class)
public abstract class AbstractClientPlayerMixin {
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void auroras$cape(CallbackInfoReturnable<PlayerSkin> cir) {
        PlayerSkin skin = cir.getReturnValue(), mine = AurorasCape.skin(this, gg.auroras.client.AurorasSkin.skin(this, skin));
        if (mine != skin) cir.setReturnValue(mine);
    }
}
