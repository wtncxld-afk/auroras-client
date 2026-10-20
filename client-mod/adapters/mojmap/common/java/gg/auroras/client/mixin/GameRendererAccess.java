package gg.auroras.client.mixin;

// ADAPTER mojmap. GameRenderer's frame resource pool, which Minecraft's own post effects render with; Color Grading and
// Motion Blur (AurorasRender) use it the same way. The field has this name on 1.21.11, 26.1, 26.2 and 26.3 (javap).

import com.mojang.blaze3d.resource.CrossFrameResourcePool;
import net.minecraft.client.renderer.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

@Mixin(GameRenderer.class)
public interface GameRendererAccess {
    @Accessor("resourcePool") CrossFrameResourcePool auroras$resourcePool();
}
