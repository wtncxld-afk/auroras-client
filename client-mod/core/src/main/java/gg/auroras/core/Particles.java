package gg.auroras.core;

import java.util.List;

/**
 * Fixed-capacity particle pool (structure of arrays): spawning, updating and culling allocate nothing.
 * When the pool is disabled or nothing is visible, update() returns at once.
 */
public final class Particles {
    public static final List<String> STYLE_IDS = List.of("aurora", "cyanViolet", "sakura", "magic", "geometric", "cosmic", "activation");
    public final int capacity; public final float[] x, y, z, vx, vy, vz, age, life, size; public final int[] color; public int count;
    private int budget; private double carry; private final Sky.Rng rng;
    public boolean enabled = true;
    public Particles(int capacity, int seed) {
        this.capacity = capacity; x = new float[capacity]; y = new float[capacity]; z = new float[capacity]; vx = new float[capacity]; vy = new float[capacity]; vz = new float[capacity];
        age = new float[capacity]; life = new float[capacity]; size = new float[capacity]; color = new int[capacity]; budget = capacity; rng = new Sky.Rng(seed);
    }
    /** The most particles alive at once: min(capacity, user maximum, quality budget x governor factor). */
    public void setBudget(int maxCount, Quality q, double governorFactor) { budget = (int) Math.max(0, Math.min(capacity, Math.min(maxCount, Math.round(q.particleBudget * Sky.clamp(governorFactor, 0, 1))))); while (count > budget) kill(count - 1); }
    public int budget() { return budget; }
    /** Spawns rate*dt particles (fractions carry to the next frame) around a point, never above the budget. Returns how many were spawned. */
    public int emit(double rate, double dt, float ox, float oy, float oz, float spread, float speed, float lifetime, float sz, int rgb) {
        if (!enabled || rate <= 0) return 0;
        carry += rate * dt; int n = (int) carry; carry -= n; int spawned = 0;
        while (n-- > 0 && count < budget) {
            int k = count++; x[k] = ox + (float) (rng.next() * 2 - 1) * spread; y[k] = oy + (float) (rng.next() * 2 - 1) * spread; z[k] = oz + (float) (rng.next() * 2 - 1) * spread;
            vx[k] = (float) (rng.next() * 2 - 1) * speed * 0.3f; vy[k] = (float) (rng.next() * 0.5 + 0.25) * speed; vz[k] = (float) (rng.next() * 2 - 1) * speed * 0.3f;
            age[k] = 0; life[k] = lifetime * (float) (0.75 + rng.next() * 0.5); size[k] = sz; color[k] = rgb; spawned++;
        }
        return spawned;
    }
    /**
     * Adds one particle at an exact point (shapes such as an aura ring place their own particles). Returns false when the
     * pool is off or at its budget, so callers can stop spawning. Used in game as the live count behind the budget.
     */
    public boolean spawn(float px, float py, float pz, float pvx, float pvy, float pvz, float lifetime, float sz, int rgb) {
        if (!enabled || count >= budget) return false;
        int k = count++; x[k] = px; y[k] = py; z[k] = pz; vx[k] = pvx; vy[k] = pvy; vz[k] = pvz; age[k] = 0; life[k] = Math.max(0.05f, lifetime); size[k] = sz; color[k] = rgb; return true;
    }
    /** How many particles rate*dt asks for this frame (fractions carry over), without spawning them. */
    public int due(double rate, double dt) { if (!enabled || rate <= 0) return 0; carry += rate * dt; int n = (int) carry; carry -= n; return Math.min(n, Math.max(0, budget - count)); }
    /** Advances and removes expired particles. Skips everything when disabled or when the camera is farther than maxDistance from the emitter. */
    public int update(float dt, float gravity, double camDistance, double maxDistance) {
        if (!enabled || count == 0) return count;
        if (camDistance > maxDistance) { count = 0; return 0; }
        for (int k = count - 1; k >= 0; k--) {
            age[k] += dt; if (age[k] >= life[k]) { kill(k); continue; }
            vy[k] -= gravity * dt; x[k] += vx[k] * dt; y[k] += vy[k] * dt; z[k] += vz[k] * dt;
        }
        return count;
    }
    /** 1 when a particle is new, 0 when it expires. */
    public float fade(int k) { return 1 - age[k] / life[k]; }
    private void kill(int k) { int l = --count; x[k] = x[l]; y[k] = y[l]; z[k] = z[l]; vx[k] = vx[l]; vy[k] = vy[l]; vz[k] = vz[l]; age[k] = age[l]; life[k] = life[l]; size[k] = size[l]; color[k] = color[l]; }
    public void clear() { count = 0; carry = 0; }

    /** Lowers the particle budget when frames take too long and restores it when they recover. */
    public static final class Governor {
        private final double targetMs; private double ema = -1, factor = 1;
        public Governor(double targetFps) { targetMs = 1000.0 / targetFps; }
        public double update(double frameMs) {
            ema = ema < 0 ? frameMs : ema + (frameMs - ema) * 0.1;
            if (ema > targetMs * 1.25) factor = Math.max(0.1, factor * 0.9); else if (ema < targetMs * 0.8) factor = Math.min(1, factor * 1.05);
            return factor;
        }
        public double factor() { return factor; }
    }
}
