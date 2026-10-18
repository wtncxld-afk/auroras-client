package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Custom Capes: your own player wears the cape the launcher saved to
// config/auroras/cape.png. Only you see it; other players are untouched and see your Minecraft cape or none. Minecraft's
// own "Cape" skin customization switch still decides whether it is drawn. Target: AbstractClientPlayerEntity#getSkinTextures().

import gg.auroras.client.AurorasModules;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.util.SkinTextures;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(AbstractClientPlayerEntity.class)
public abstract class CapeMixin {
    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void auroras$cape(CallbackInfoReturnable<SkinTextures> cir) {
        Identifier cape = AurorasModules.capeThrottled(this); if (cape == null) return;
        SkinTextures t = cir.getReturnValue();
        cir.setReturnValue(new SkinTextures(t.texture(), t.textureUrl(), cape, t.elytraTexture(), t.model(), t.secure()));
    }
}
