package gg.auroras.core;

import java.lang.management.ManagementFactory;

/** Microbenchmarks of the shared logic on this machine. These are NOT in-game numbers. Run: java -cp out gg.auroras.core.Bench */
public final class Bench {
    static long alloc() { return ((com.sun.management.ThreadMXBean) ManagementFactory.getThreadMXBean()).getThreadAllocatedBytes(Thread.currentThread().threadId()); }
    interface Op { long run(int i); }
    static void bench(String name, Op op) {
        long s = 0; for (int i = 0; i < 300_000; i++) s += op.run(i);
        int n = 2_000_000; long a0 = alloc(), t0 = System.nanoTime(); for (int i = 0; i < n; i++) s += op.run(i); long dt = System.nanoTime() - t0, da = alloc() - a0;
        System.out.printf("%-60s %8.1f ns/op %10.1f B/op%s%n", name, dt / (double) n, da / (double) n, s == 42 ? "!" : "");
    }
    public static void main(String[] x) {
        Calc.CpsCounter cps = new Calc.CpsCounter(1000); Calc.FpsSmoother fps = new Calc.FpsSmoother(500); Perf.CachedText ct = new Perf.CachedText(); Perf.FrameStats st = new Perf.FrameStats(4096); int[] out = new int[2];
        bench("CpsCounter click + cps", i -> { cps.click(i); return cps.cps(i); });
        bench("FpsSmoother.frame", i -> { fps.frame(i * 16_000_000L); return fps.fps(); });
        bench("FrameStats.record", i -> { st.record(16_000_000L); return 0; });
        bench("Hud.resolveInto", i -> { Hud.resolveInto(Hud.Anchor.TR, 4, 4, 100, 9, 854, 480, out); return out[0]; });
        ct.set(1, "x");
        bench("CachedText.stale, inputs unchanged (frame fast path)", i -> ct.stale(1) ? 1 : 0);
        bench("Calc.coords every frame (what caching avoids)", i -> Calc.coords(i * .01, 64, i * .02, 1, "N").length());
        bench("Calc.clock every frame (what caching avoids)", i -> Calc.clock(i % 24, i % 60, i % 60, true, true).length());
        try {
            java.util.Map<String, Sky.Theme> th = Sky.load(java.nio.file.Files.readString(java.nio.file.Path.of("../../visuals/themes.json"))); Sky.Theme t = th.get("aurora");
            Sky.StarField f = new Sky.StarField(1337, 1.0, 1.0); int rings = Quality.BALANCED.domeRings; int[] ring = new int[rings + 1];
            bench("Sky frame, Balanced: 17 ring colors + 1500 star brightnesses", i -> { long z = 0; for (int r = 0; r <= rings; r++) ring[r] = Sky.skyColor(t, r / (double) rings, 18000 + i, Sky.Adjust.NONE); for (int k = 0; k < f.count; k++) z += (long) (f.brightness(k, i * 0.016, 1, 1, 1) * 8); return z + ring[3]; });
            Particles p = new Particles(1024, 1); p.setBudget(1024, Quality.BALANCED, 1);
            bench("Particles frame, Balanced (256 alive): emit + update", i -> { p.emit(200, 0.016, 0, 64, 0, 1, 1, 1.5f, 1, 0); return p.update(0.016f, 0.5f, 1, 32); });
            Particles off = new Particles(1024, 1); off.enabled = false;
            bench("Particles frame, module disabled", i -> { off.emit(200, 0.016, 0, 64, 0, 1, 1, 1.5f, 1, 0); return off.update(0.016f, 0.5f, 1, 32); });
        } catch (java.io.IOException e) { System.out.println("themes.json not found, skipping sky benchmarks"); }
        bench("Hud.resolve (allocating; JIT may elide the allocation here)", i -> Hud.resolve(new Hud.Placement(Hud.Anchor.TR, 4, 4), 100, 9, 854, 480)[0]);
    }
}
