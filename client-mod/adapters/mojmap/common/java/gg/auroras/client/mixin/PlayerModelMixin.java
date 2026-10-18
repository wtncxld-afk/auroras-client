package gg.auroras.client.mixin;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Every injection here is optional (auroras.mixins.json sets
// defaultRequire 0): if a name differs in some version, that one feature stays off and the game still starts.
// Emotes, step 2: poses your own player model with the current emote after vanilla has set its angles. Mixes per part:
// angle = vanilla * (1 - weight) + emote * weight, so blending in and out is smooth and parts an emote doesn't animate
// keep their normal motion. The outer layers are children of these parts, so they follow.

import gg.auroras.client.AurorasEmotesAccess;
import gg.auroras.core.Emotes;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.player.PlayerModel;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(PlayerModel.class)
public abstract class PlayerModelMixin {
    private static final float D2R = (float) (Math.PI / 180);

    @Inject(method = "setupAnim(Lnet/minecraft/client/renderer/entity/state/AvatarRenderState;)V", at = @At("RETURN"))
    private void auroras$emote(AvatarRenderState state, CallbackInfo ci) {
        if (!Boolean.TRUE.equals(state.getData(AurorasEmotesAccess.LOCAL_PLAYER)) || !AurorasEmotesAccess.sample()) return;
        HumanoidModel<?> m = (HumanoidModel<?>) (Object) this; double[] p = AurorasEmotesAccess.pose(), w = AurorasEmotesAccess.weight();
        ModelPart[] parts = {m.head, m.body, m.rightArm, m.leftArm, m.rightLeg, m.leftLeg};
        float lift = (float) (p[Emotes.ROOT * 4 + 3] * w[Emotes.ROOT]);
        for (int i = 0; i < parts.length; i++) {
            ModelPart part = parts[i]; float k = (float) w[i];
            if (k > 0) { part.xRot += (p[i * 4] * D2R - part.xRot) * k; part.yRot += (p[i * 4 + 1] * D2R - part.yRot) * k; part.zRot += (p[i * 4 + 2] * D2R - part.zRot) * k; }
            if (lift != 0) part.y += lift;
        }
    }
}
