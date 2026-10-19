package gg.auroras.client.platform;

// ADAPTER mojmap, Minecraft 26.1 only (versions/26.1). Custom Skies: draws one frame of core SkyMesh quads at the start of
// the sky pass through Minecraft's immediate buffer source, one blend run at a time in drawing order:
//  - normal runs with RenderTypes.debugFilledBox() (position-color quads, translucent blend, no culling issues: every
//    SkyMesh quad faces the camera);
//  - additive runs with RenderTypes.dragonRays() (position-color triangles, BlendFunction.LIGHTNING = add rgb * alpha,
//    no depth write, drawn to the main target). Each quad becomes the triangles (0,1,2) and (0,2,3). Additive vertices
//    are pulled in to a tenth of their distance (same direction, so the same place on screen) so that the lightning
//    shader's fog can't tint them: the sky sits 100 blocks out, inside the fog at short render distances.
//    RenderTypes.lightning() is not used: it draws to the weather target, which Fabulous graphics composites later.
// Checked against javap of this release (ci/javap-*.txt in mod-check.yml). Then depth is cleared: nothing else has
// been drawn into the frame yet (the sky pass comes first), so terrain beyond 100 blocks still shows.

import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.ByteBufferBuilder;
import com.mojang.blaze3d.vertex.VertexConsumer;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.MultiBufferSource;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.renderer.rendertype.RenderTypes;

public final class SkyDraw {
    private SkyDraw() {}
    /** Additive vertices are drawn at this fraction of their distance. */
    static final float NEAR = 0.1f;
    static MultiBufferSource.BufferSource source;
    /** Whether this release can draw Custom Skies (it calls Minecraft directly, so a mismatch shows when it's built). */
    public static boolean supported() { return true; }
    /** Draws quads [0, quads) in the given blend runs (core SkyMesh.runs / runEnd / runAdd). Render thread only. */
    public static void draw(float[] pos, int[] col, int quads, int runs, int[] runEnd, boolean[] runAdd) {
        if (source == null) source = MultiBufferSource.immediate(new ByteBufferBuilder(1 << 20));
        for (int r = 0, from = 0; r < runs; from = runEnd[r], r++) {
            boolean add = runAdd[r]; RenderType type = add ? RenderTypes.dragonRays() : RenderTypes.debugFilledBox();
            VertexConsumer b = source.getBuffer(type);
            for (int q = from, end = Math.min(runEnd[r], quads); q < end; q++) {
                int v = q * 4;
                if (add) { put(b, pos, col, v, NEAR); put(b, pos, col, v + 1, NEAR); put(b, pos, col, v + 2, NEAR); put(b, pos, col, v, NEAR); put(b, pos, col, v + 2, NEAR); put(b, pos, col, v + 3, NEAR); }
                else for (int k = 0; k < 4; k++) put(b, pos, col, v + k, 1);
            }
            source.endBatch(type);
        }
        RenderTarget main = Minecraft.getInstance().getMainRenderTarget();
        if (main.getDepthTexture() != null) RenderSystem.getDevice().createCommandEncoder().clearDepthTexture(main.getDepthTexture(), 1.0);
    }
    static void put(VertexConsumer b, float[] pos, int[] col, int i, float s) { b.addVertex(pos[i * 3] * s, pos[i * 3 + 1] * s, pos[i * 3 + 2] * s).setColor(col[i]); }
}
