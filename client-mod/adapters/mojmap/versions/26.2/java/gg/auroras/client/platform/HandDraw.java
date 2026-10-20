package gg.auroras.client.platform;

// Minecraft 26.2 only (versions/26.2): Hand Aura's glow shell around the first-person arm, submitted with this
// release's model-part call (the tinted overload differs between releases).

import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.client.renderer.texture.TextureAtlasSprite;
import net.minecraft.resources.Identifier;

public final class HandDraw {
    private HandDraw() {}
    /** One translucent, full-bright copy of the arm in argb (the pose is already scaled out by the caller). */
    public static void armShell(SubmitNodeCollector c, PoseStack pose, ModelPart arm, Identifier skin, int argb) {
        c.submitModelPart(arm, pose, RenderTypes.entityTranslucentEmissive(skin), 0xF000F0, OverlayTexture.NO_OVERLAY, (TextureAtlasSprite) null, argb, null);
    }
}
