package gg.auroras.client.platform;

// ADAPTER mojmap, Minecraft 26.3 only (versions/26.3). Custom Skies: draws one frame of core SkyMesh quads at the start of
// the sky pass. MultiBufferSource is gone on this release, so this follows vanilla SkyRenderer#renderStars instead: the
// quads go into one GPU vertex buffer (POSITION_COLOR, 16 bytes a vertex, grown when needed and reused), then each blend
// run is drawn in its own render pass on the main target with the shared sequential QUADS index buffer:
//  - normal runs with RenderPipelines.DEBUG_QUADS (position-color quads, translucent blend, no culling);
//  - additive runs with RenderPipelines.LIGHTNING (position-color quads, BlendFunction.LIGHTNING = add rgb * alpha).
//    Additive vertices are pulled in to a tenth of their distance (same direction, same place on screen) so that the
//    pipeline's fog can't tint them.
// Every pass clears depth when it opens (this release uses reverse Z, hence RenderSystem.DEFAULT_DEPTH_CLEAR_VALUE), and a
// last empty pass clears it again: nothing else has been drawn yet (the sky pass comes first), so a run can't hide the
// next one and terrain beyond 100 blocks still shows. On 26.3 the GPU classes live in com.mojang.renderpearl.api and a
// pass takes RenderSystem.getCompiledPipeline(pipeline). Checked against javap of this release (ci/javap-*.txt).

import com.mojang.renderpearl.api.pipeline.PrimitiveTopology;
import com.mojang.renderpearl.api.buffers.GpuBuffer;
import com.mojang.renderpearl.api.buffers.GpuBufferSlice;
import com.mojang.renderpearl.api.pipeline.RenderPipeline;
import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.renderpearl.api.commands.CommandEncoder;
import com.mojang.renderpearl.api.device.GpuDevice;
import com.mojang.renderpearl.api.commands.RenderPass;
import com.mojang.blaze3d.systems.RenderSystem;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Optional;
import java.util.OptionalDouble;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.RenderPipelines;
import org.joml.Matrix4f;
import org.joml.Vector4f;

public final class SkyDraw {
    private SkyDraw() {}
    /** Additive vertices are drawn at this fraction of their distance. */
    static final float NEAR = 0.1f;
    static final int VERTEX = 16;
    static ByteBuffer bytes;
    static GpuBuffer gpu;
    static GpuBufferSlice fog;
    static final Matrix4f MODEL = new Matrix4f();
    static final Vector4f WHITE = new Vector4f(1, 1, 1, 1);
    /** Whether this release can draw Custom Skies (it calls Minecraft directly, so a mismatch shows when it's built). */
    public static boolean supported() { return true; }
    /** The sky pass's fog, from the sky lambda's first argument; set before AurorasSky.begin(). */
    public static void setFog(GpuBufferSlice f) { fog = f; }
    /** Draws quads [0, quads) in the given blend runs (core SkyMesh.runs / runEnd / runAdd). Render thread only. */
    public static void draw(float[] pos, int[] col, int quads, int runs, int[] runEnd, boolean[] runAdd) {
        RenderTarget main = Minecraft.getInstance().gameRenderer.mainRenderTarget();
        if (quads <= 0 || main.getDepthTextureView() == null) return;
        long size = (long) quads * 4 * VERTEX;
        if (bytes == null || bytes.capacity() < size) bytes = ByteBuffer.allocateDirect((int) (size + size / 2)).order(ByteOrder.nativeOrder());
        bytes.clear();
        for (int r = 0, from = 0; r < runs; from = runEnd[r], r++) {
            float s = runAdd[r] ? NEAR : 1;
            for (int v = from * 4, end = Math.min(runEnd[r], quads) * 4; v < end; v++) {
                int c = col[v];
                bytes.putFloat(pos[v * 3] * s).putFloat(pos[v * 3 + 1] * s).putFloat(pos[v * 3 + 2] * s)
                     .put((byte) (c >> 16)).put((byte) (c >> 8)).put((byte) c).put((byte) (c >>> 24));
            }
        }
        bytes.flip();
        GpuDevice device = RenderSystem.getDevice();
        CommandEncoder encoder = device.createCommandEncoder();
        if (gpu == null || gpu.size() < size) {
            if (gpu != null) gpu.close();
            gpu = device.createBuffer(() -> "Auroras sky", GpuBuffer.USAGE_VERTEX | GpuBuffer.USAGE_COPY_DST, (long) bytes.capacity());
        }
        encoder.writeToBuffer(gpu.slice(0, size), bytes);
        if (fog != null) RenderSystem.setShaderFog(fog);
        GpuBufferSlice transform = RenderSystem.getDynamicUniforms().writeTransform(MODEL.set(RenderSystem.getModelViewMatrixCopy()), WHITE);
        RenderSystem.AutoStorageIndexBuffer indices = RenderSystem.getSequentialBuffer(PrimitiveTopology.QUADS);
        OptionalDouble clear = OptionalDouble.of(RenderSystem.DEFAULT_DEPTH_CLEAR_VALUE);
        for (int r = 0, from = 0; r < runs; from = runEnd[r], r++) {
            int n = Math.min(runEnd[r], quads) - from;
            if (n <= 0) continue;
            RenderPipeline pipeline = runAdd[r] ? RenderPipelines.LIGHTNING : RenderPipelines.DEBUG_QUADS;
            GpuBuffer index = indices.getBuffer(n * 6);
            try (RenderPass pass = encoder.createRenderPass(() -> "Auroras sky", main.getColorTextureView(), Optional.empty(), main.getDepthTextureView(), clear)) {
                pass.setPipeline(RenderSystem.getCompiledPipeline(pipeline));
                RenderSystem.bindDefaultUniforms(pass);
                pass.setUniform("DynamicTransforms", transform);
                pass.setVertexBuffer(0, gpu.slice((long) from * 4 * VERTEX, (long) n * 4 * VERTEX));
                pass.setIndexBuffer(index, indices.type());
                pass.drawIndexed(n * 6, 1, 0, 0, 0);
            }
        }
        try (RenderPass pass = encoder.createRenderPass(() -> "Auroras sky depth", main.getColorTextureView(), Optional.empty(), main.getDepthTextureView(), clear)) { }
    }
}
