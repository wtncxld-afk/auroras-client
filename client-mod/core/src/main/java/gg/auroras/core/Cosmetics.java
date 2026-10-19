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
    /**
     * The old 22x17 cape layout uses the same texture coordinates as the top-left corner of the 64x32 one, so it becomes a
     * 64x32 image by copying it there and leaving the rest transparent. argb is row-major, 22 * 17 pixels.
     */
    public static int[] legacyCape(int[] argb) {
        if (argb == null || argb.length != 22 * 17) throw new IllegalArgumentException("A legacy cape is 22x17 pixels");
        int[] out = new int[64 * 32]; for (int y = 0; y < 17; y++) System.arraycopy(argb, y * 22, out, y * 64, 22); return out;
    }

    /**
     * When the game should (re)load config/auroras/cape.png. The adapter asks due() every tick, which is cheap; only when it
     * says yes does it look at the file (at most once a second, or at once after Custom Capes is switched on or off) and
     * pass what it found to update(), which says what to do with the texture.
     */
    public static final class CapeWatch {
        public enum Action { KEEP, LOAD, CLEAR }
        public static final long INTERVAL_MS = 1000;
        long checkedMs; boolean checkedOnce, lastOn, loaded, lastExists; long lastStamp = Long.MIN_VALUE, lastSize = -1;

        /** True when the file should be looked at now: the setting changed, or a second passed while it is on. */
        public boolean due(long nowMs, boolean on) {
            if (!checkedOnce || on != lastOn) return true;
            return on && nowMs - checkedMs >= INTERVAL_MS;
        }
        /** What to do after looking at the file (exists, last-modified time, size in bytes). Call loaded() after a LOAD. */
        public Action update(long nowMs, boolean on, boolean exists, long modifiedMs, long size) {
            checkedOnce = true; checkedMs = nowMs; lastOn = on;
            if (!on || !exists) { lastStamp = Long.MIN_VALUE; lastSize = -1; lastExists = exists; if (loaded) { loaded = false; return Action.CLEAR; } return Action.KEEP; }
            // the launcher replaces the file by renaming a finished copy over it, so a new time or size means a whole new image
            if (modifiedMs == lastStamp && size == lastSize && lastExists) return Action.KEEP;
            lastStamp = modifiedMs; lastSize = size; lastExists = true; return Action.LOAD;
        }
        /** Result of a LOAD. A file that couldn't be used isn't retried until it changes; the previous texture is dropped. */
        public Action loaded(boolean ok) { boolean had = loaded; loaded = ok; return !ok && had ? Action.CLEAR : Action.KEEP; }
        /** True while a cape from the file is in use. */
        public boolean active() { return loaded && lastOn; }
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
