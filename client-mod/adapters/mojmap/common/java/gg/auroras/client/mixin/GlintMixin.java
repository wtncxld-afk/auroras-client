package gg.auroras.client.mixin;

// ADAPTER mojmap. Optional (defaultRequire 0). Custom Enchant Glint's speed and scale: TextureTransform#setupGlintTexturing
// stores the glint clock (milliseconds x Minecraft's glint speed) in its first long local and ends with Matrix4f#scale;
// the same on 1.21.11 and 26.x (javap -c). The colour is the texture itself (AurorasRender.glintFrame).

import gg.auroras.client.AurorasRender;
import net.minecraft.client.renderer.rendertype.TextureTransform;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyArg;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(TextureTransform.class)
public abstract class GlintMixin {
    @ModifyVariable(method = "setupGlintTexturing", at = @At("STORE"), ordinal = 0)
    private static long auroras$glintSpeed(long clock) { return AurorasRender.glintTime(clock); }
    @ModifyArg(method = "setupGlintTexturing", at = @At(value = "INVOKE", target = "Lorg/joml/Matrix4f;scale(F)Lorg/joml/Matrix4f;"), index = 0)
    private static float auroras$glintScale(float scale) { return AurorasRender.glintScale(scale); }
}
