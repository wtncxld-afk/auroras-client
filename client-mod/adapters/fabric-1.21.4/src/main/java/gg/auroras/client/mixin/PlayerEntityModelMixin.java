package gg.auroras.client.mixin;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Poses your own player model with the current emote after vanilla has set its
// angles. Mixes per part: angle = vanilla * (1 - weight) + emote * weight, so blending in and out is smooth and parts
// an emote doesn't animate keep their normal motion. The hat, jacket, sleeves and pants layers are children of these
// parts in 1.21.4, so they follow. Assumes PlayerEntityRenderState exposes the entity id (field "id"); adjust if the
// mapped name differs on first build.

import gg.auroras.client.AurorasEmotesAccess;
import gg.auroras.core.Emotes;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.render.entity.model.BipedEntityModel;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(PlayerEntityModel.class)
public abstract class PlayerEntityModelMixin {
    private static final float D2R = (float) (Math.PI / 180);

    @Inject(method = "setAngles(Lnet/minecraft/client/render/entity/state/PlayerEntityRenderState;)V", at = @At("TAIL"))
    private void auroras$emote(PlayerEntityRenderState state, CallbackInfo ci) {
        if (!AurorasEmotesAccess.sample(state.id)) return;
        BipedEntityModel<?> m = (BipedEntityModel<?>) (Object) this; double[] p = AurorasEmotesAccess.pose(), w = AurorasEmotesAccess.weight();
        ModelPart[] parts = {m.head, m.body, m.rightArm, m.leftArm, m.rightLeg, m.leftLeg};
        float lift = (float) (p[Emotes.ROOT * 4 + 3] * w[Emotes.ROOT]);
        for (int i = 0; i < parts.length; i++) {
            ModelPart part = parts[i]; float k = (float) w[i];
            if (k > 0) { part.pitch += (p[i * 4] * D2R - part.pitch) * k; part.yaw += (p[i * 4 + 1] * D2R - part.yaw) * k; part.roll += (p[i * 4 + 2] * D2R - part.roll) * k; }
            if (lift != 0) part.originY += lift;
        }
    }
}
