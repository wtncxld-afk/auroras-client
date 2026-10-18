package gg.auroras.core;

import java.util.List;

/** Cape motion, cape texture rules and the totem pop animation. Mirrored in visuals/visuals.js for the launcher previews. */
public final class Cosmetics {
    private Cosmetics() {}
    public static final List<String> CAPE_DESIGNS = List.of("aurora", "sakura", "cosmic", "midnight", "void", "custom");

    /**
     * Cape swing, modeled on how Minecraft moves capes: a trailing point follows the player at 25% per tick, and the
     * difference between them sets the angles. Units: blocks and degrees.
     */
    public static final class CapeSim {
        private double cx, cy, cz, px, py, pz; private boolean init; public float swing, sideways, rise;
        public void tick(double x, double y, double z, double bodyYawDeg, boolean sneaking, double strideAmount, double walkPhase) {
            if (!init || Math.abs(x - cx) > 10 || Math.abs(y - cy) > 10 || Math.abs(z - cz) > 10) { cx = x; cy = y; cz = z; init = true; }
            cx += (x - cx) * 0.25; cy += (y - cy) * 0.25; cz += (z - cz) * 0.25;
            double dx = cx - x, dy = cy - y, dz = cz - z, s = Math.sin(Math.toRadians(bodyYawDeg)), c = -Math.cos(Math.toRadians(bodyYawDeg));
            float q = (float) Sky.clamp(dy * 10, -6, 32), r = (float) Sky.clamp((dx * s + dz * c) * 100, 0, 150), side = (float) Sky.clamp((dx * c - dz * s) * 100, -20, 20);
            q += (float) (Math.sin(walkPhase * 6) * 32 * strideAmount); if (sneaking) q += 25;
            rise = q; swing = 6 + r / 2 + q; sideways = side / 2; px = x; py = y; pz = z;
        }
    }

    /** Accepted cape images: 64x32 and its 2x/4x/8x versions, plus the old 22x17 layout. Returns the scale, or throws with a reason. */
    public static int capeScale(int w, int h) {
        if (w == 22 && h == 17) return 0;
        for (int s = 1; s <= 8; s *= 2) if (w == 64 * s && h == 32 * s) return s;
        throw new IllegalArgumentException("Cape images must be 64x32 (or 128x64, 256x128, 512x256), or the old 22x17 layout. This one is " + w + "x" + h + ".");
    }
    /** Texture rectangles {x, y, w, h} (at scale 1) for the cape box faces: front, back, left, right, top, bottom. */
    public static final int[][] CAPE_FACES = {{1, 1, 10, 16}, {12, 1, 10, 16}, {0, 1, 1, 16}, {11, 1, 1, 16}, {1, 0, 10, 1}, {11, 0, 10, 1}};

    /**
     * Pose of the floating totem a moment after it activates, modeled on Minecraft's pop animation. t is 0..1 over 40 ticks.
     * Returns {x offset, y offset (both in quarter-screen units), scale, yaw degrees, roll degrees}.
     */
    public static void totemPose(double t, double randX, double randY, double[] out) {
        double f = Sky.clamp(t, 0, 1), g = f * f, h = f * g, i = 10.25 * h * g - 24.95 * g * g + 25.5 * h - 13.8 * g + 4.0 * f, j = i * Math.PI;
        out[0] = randX * Math.abs(Math.sin(j * 2)); out[1] = randY * Math.abs(Math.sin(j * 2)); out[2] = 50 + 175 * Math.sin(j);
        out[3] = 900 * Math.abs(Math.sin(j)); out[4] = 6 * Math.cos(f * 8);
    }
}
