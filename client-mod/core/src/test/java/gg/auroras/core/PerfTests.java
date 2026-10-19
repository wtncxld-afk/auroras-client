package gg.auroras.core;

import java.lang.management.ManagementFactory;
import java.util.Arrays;
import java.util.List;

public final class PerfTests {
    static int pass, fail;
    static void check(String n, boolean ok, Object... info) { if (ok) pass++; else fail++; System.out.println((ok ? "PASS  " : "FAIL  ") + n + (ok || info.length == 0 ? "" : "  " + Arrays.toString(info))); }
    static long allocated() { return ((com.sun.management.ThreadMXBean) ManagementFactory.getThreadMXBean()).getThreadAllocatedBytes(Thread.currentThread().threadId()); }

    static double skyFrame(SkyFx.Budget bu, double t, float[] mo, float[] o4) {
        double acc = SkyFx.meteors(11, 4, t, bu.meteors(), mo);
        for (int k = 0; k < bu.petals(); k++) { SkyFx.petal(3, k, t, o4); acc += o4[3]; }
        for (int k = 0; k < bu.cloudPuffs(); k++) { SkyFx.cloud(5, k, t, o4); acc += o4[3]; }
        for (int k = 0; k < bu.nebulaBlobs(); k++) { SkyFx.nebula(7, k, t, 1, o4); acc += o4[3]; }
        for (int r = 0; r < 3; r++) for (int l = 0; l < bu.auroraLayers(); l++) for (int s = 0; s <= bu.ribbonSteps(); s++) { double az = s * Math.PI * 2 / bu.ribbonSteps(); acc += SkyFx.auroraWave(az, t, r, l, 0.32, 1, 1) * SkyFx.auroraShimmer(az, t, r, l, 1); }
        return acc;
    }
    public static void main(String[] a) {
        check("version: ordering across 1.21.x and year-based releases", McVersion.parse("1.21").get().compareTo(McVersion.parse("1.21.1").get()) < 0 && McVersion.parse("1.21.9").get().compareTo(McVersion.parse("1.21.10").get()) < 0 && McVersion.parse("1.21.11").get().compareTo(McVersion.parse("26.1").get()) < 0 && McVersion.parse("26.1").get().compareTo(McVersion.parse("26.1.1").get()) < 0);
        check("version: snapshots, pre-releases and junk do not parse", List.of("24w14a", "1.21.4-pre1", "1.21-rc1", "", "1.21.4.1", "latest", "1..2").stream().allMatch(s -> McVersion.parse(s).isEmpty()) && McVersion.parse(null).isEmpty());
        check("version: 1.20.6 is below the 1.21 floor, 1.21 and 26.1 are above", !McVersion.parse("1.20.6").get().atLeast(1, 21) && McVersion.parse("1.21").get().atLeast(1, 21) && McVersion.parse("26.1").get().atLeast(1, 21));
        check("adapter: 1.21.4 selects the 1.21.4 adapter, marked not validated", Adapters.select("1.21.4").map(x -> x.id().equals("y1_21_4") && x.status() == Adapters.Status.SCAFFOLD).orElse(false));
        check("adapter: versions without an adapter get none (1.21, 1.21.5, 1.21.10, 26.4, snapshot, null)", Adapters.select("1.21").isEmpty() && Adapters.select("1.21.5").isEmpty() && Adapters.select("1.21.10").isEmpty() && Adapters.select("26.4").isEmpty() && Adapters.select("25w14a").isEmpty() && Adapters.select(null).isEmpty());
        check("adapter: 1.21.11 and every 26.1, 26.2 and 26.3 release (hotfixes included) have the Mojang-names adapter, which now has code for custom skies (still unvalidated)", Adapters.select("1.21.11").get().id().equals("m1_21_11") && Adapters.select("26.1").get().id().equals("m26_1") && Adapters.select("26.1.2").get().id().equals("m26_1") && Adapters.select("26.3.1").get().id().equals("m26_3") && Adapters.select("26.2").get().has(Adapters.Feature.SKY) && Adapters.select("1.21.11").get().has(Adapters.Feature.SKY) && Adapters.select("26.3").get().status() == Adapters.Status.SCAFFOLD && Adapters.select("26.2").get().has(Adapters.Feature.EMOTES));
        check("adapter: the 1.21.4 adapter is for Fabric and lists the features it has code for", Adapters.select("1.21.4").map(x -> x.loader().equals("fabric") && x.has(Adapters.Feature.SKY) && x.has(Adapters.Feature.EMOTES)).orElse(false));
        check("adapter: message says the client stays disabled when unsupported", Adapters.describe("1.21.5").contains("disabled") && Adapters.describe("1.21.4").contains("not validated"));
        Perf.UpdateGate g = new Perf.UpdateGate(100); long t0 = Long.MAX_VALUE - 50_000_000L;
        check("gate: first call is due, then once per interval, also across nanoTime overflow", g.due(t0) && !g.due(t0 + 50_000_000L) && g.due(t0 + 100_000_000L) && !g.due(t0 + 120_000_000L));
        Perf.CachedText ct = new Perf.CachedText(); int builds = 0;
        for (int i = 0; i < 1000; i++) { long k = Perf.key(i / 100, 5, 7); if (ct.stale(k)) { builds++; ct.set(k, "FPS: " + (i / 100)); } }
        check("cached text: rebuilt only when its inputs change (10 builds for 1000 frames)", builds == 10 && ct.text().equals("FPS: 9"), builds);
        Perf.FrameStats fs = new Perf.FrameStats(1000); for (int i = 0; i < 99; i++) fs.record(10_000_000L); fs.record(100_000_000L);
        Perf.FrameStats.Summary s = fs.summary();
        check("frame stats: average FPS and frame time from real durations", Math.abs(s.avgFps() - 91.74) < 0.05 && Math.abs(s.avgFrameMs() - 10.9) < 0.01, s);
        check("frame stats: 1% low reflects the slowest 1% of frames", Math.abs(s.onePercentLowFps() - 10.0) < 0.01, s);
        Perf.FrameStats steady = new Perf.FrameStats(500); for (int i = 0; i < 500; i++) steady.record(16_666_667L);
        check("frame stats: steady 60 fps has equal average and 1% low", Math.abs(steady.summary().avgFps() - 60) < 0.01 && Math.abs(steady.summary().onePercentLowFps() - 60) < 0.01);
        Perf.FrameStats ring = new Perf.FrameStats(4); for (int i = 0; i < 100; i++) ring.record(1_000_000_000L); for (int i = 0; i < 4; i++) ring.record(10_000_000L);
        check("frame stats: ring buffer keeps only the latest frames", Math.abs(ring.summary().avgFps() - 100) < 0.01 && ring.summary().frames() == 4);
        check("frame stats: empty run is safe", new Perf.FrameStats(10).summary().frames() == 0);
        check("memory: used is positive and below max", Perf.usedMemoryBytes() > 0 && Perf.usedMemoryBytes() <= Perf.maxMemoryBytes());
        Perf.GcSampler gc = new Perf.GcSampler(); gc.sample(); long[] junk = null; for (int i = 0; i < 50; i++) junk = new long[200_000]; System.gc(); long[] d = gc.sample();
        check("gc sampler: sees collections after a forced GC", d[0] >= 1 && d[1] >= 0 && junk != null, d[0], d[1]);
        Calc.CpsCounter cps = new Calc.CpsCounter(1000); Calc.FpsSmoother fps = new Calc.FpsSmoother(500); Perf.UpdateGate gate = new Perf.UpdateGate(500); Perf.CachedText txt = new Perf.CachedText(); Perf.FrameStats stats = new Perf.FrameStats(4096); int[] out = new int[2]; Hud.Anchor an = Hud.Anchor.TR;
        long sink = 0;
        for (int w = 0; w < 200_000; w++) { cps.click(w); sink += cps.cps(w); fps.frame(w * 16_000_000L); gate.due(w * 16_000_000L); if (txt.stale(w % 7)) txt.set(w % 7, "x"); stats.record(16_000_000L); Hud.resolveInto(an, 4, 4, 100, 9, 854, 480, out); sink += out[0]; }
        long b0 = allocated(); int N = 1_000_000;
        for (int w = 0; w < N; w++) { cps.click(w); sink += cps.cps(w); fps.frame(w * 16_000_000L); sink += fps.fps(); gate.due(w * 16_000_000L); if (txt.stale(w % 7)) txt.set(w % 7, "x"); stats.record(16_000_000L); Hud.resolveInto(an, 4, 4, 100, 9, 854, 480, out); sink += out[0] + out[1]; }
        long bytes = allocated() - b0;
        check("allocation: CPS, FPS, update gate, cached text, frame stats and HUD placement allocate ~nothing per frame", bytes < 20_000, bytes + " bytes over " + N + " iterations (" + sink + ")");
        Config.ProfileManager pm = new Config.ProfileManager(new Config.Registry()); int r0 = pm.revision(); pm.setEnabled("fps", true); int r1 = pm.revision(); pm.switchTo("Casual"); int r2 = pm.revision();
        check("config revision bumps on every change so renderers re-read settings only then", r1 > r0 && r2 > r1 && pm.revision() == r2);
        { // a High-quality animated sky frame: 4 meteor slots, 220 petals, 36 clouds, 16 nebula blobs, 3x3 aurora ribbons at 96 steps
          float[] mo = new float[24], o4 = new float[4]; double acc = 0; SkyFx.Budget bu = SkyFx.budget(Quality.HIGH);
          for (int w = 0; w < 2000; w++) acc += skyFrame(bu, w / 60.0, mo, o4);
          long a0 = allocated(), st = System.nanoTime(); int F = 20_000; for (int fr = 0; fr < F; fr++) acc += skyFrame(bu, fr / 60.0, mo, o4); long ns = System.nanoTime() - st, by = allocated() - a0;
          check("animated sky: a High-quality effects frame allocates nothing", by < 20_000, by + " bytes over " + F + " frames (" + (acc > 0) + ")");
          check("animated sky: a High-quality effects frame computes in under 0.15 ms", ns / (double) F < 150_000, String.format("%.4f ms", ns / 1e6 / F)); }
        System.out.println("\n" + pass + " passed, " + fail + " failed"); if (fail > 0) System.exit(1);
    }
}
