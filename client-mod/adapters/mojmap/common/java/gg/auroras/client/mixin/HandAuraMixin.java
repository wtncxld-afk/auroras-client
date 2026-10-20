package gg.auroras.client.mixin;

import com.mojang.blaze3d.vertex.PoseStack;
import gg.auroras.client.AurorasHands;
import gg.auroras.client.platform.HandDraw;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.player.AvatarRenderer;
import net.minecraft.resources.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Hand Aura: after your first-person arm is submitted, a few slightly larger translucent copies glow around it. */
@Mixin(AvatarRenderer.class)
public abstract class HandAuraMixin {
    @Inject(method = "renderHand(Lcom/mojang/blaze3d/vertex/PoseStack;Lnet/minecraft/client/renderer/SubmitNodeCollector;ILnet/minecraft/resources/Identifier;Lnet/minecraft/client/model/geom/ModelPart;Z)V", at = @At("TAIL"))
    private void auroras$armGlow(PoseStack pose, SubmitNodeCollector collector, int light, Identifier skin, ModelPart arm, boolean sleeve, CallbackInfo ci) {
        if (!AurorasHands.auraHand()) return;
        for (int i = AurorasHands.auraLayers() - 1; i >= 0; i--) {
            int c = AurorasHands.auraArm(i); if (c == 0) continue; float s = AurorasHands.auraArmScale(i);
            pose.pushPose(); pose.scale(s, s, s); HandDraw.armShell(collector, pose, arm, skin, c); pose.popPose();
        }
    }
}
