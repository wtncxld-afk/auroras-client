package gg.auroras.core;

import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.util.Arrays;

/** Allocation-free helpers for hot paths, plus benchmark statistics. */
public final class Perf {
    private Perf() {}

    /** True at most once per interval. Uses monotonic nanoseconds, safe across overflow. */
    public static final class UpdateGate {
        private final long intervalNs; private long next; private boolean started;
        public UpdateGate(long intervalMs) { this.intervalNs = intervalMs * 1_000_000L; }
        public boolean due(long nowNs) { if (!started || nowNs - next >= 0) { started = true; next = nowNs + intervalNs; return true; } return false; }
    }

    /** Rebuild a string only when the numbers behind it change: if (t.stale(key)) t.set(key, build()); draw(t.text()). */
    public static final class CachedText {
        private long key; private boolean has; private String text = "";
        public boolean stale(long k) { return !has || k != key; }
        public String set(long k, String s) { key = k; has = true; text = s; return s; }
        public String text() { return text; }
    }
    public static long key(long a, long b, long c) { return (a * 31 + b) * 31 + c; }

    /** Records frame durations without allocating. summary() allocates and is meant for the end of a benchmark run. */
    public static final class FrameStats {
        private final long[] ring; private int n, head;
        public FrameStats(int capacity) { ring = new long[capacity]; }
        public void record(long frameNs) { ring[head] = frameNs; head = (head + 1) % ring.length; if (n < ring.length) n++; }
        public record Summary(int frames, double avgFps, double avgFrameMs, double p99FrameMs, double onePercentLowFps) {}
        public Summary summary() {
            if (n == 0) return new Summary(0, 0, 0, 0, 0);
            long[] a = Arrays.copyOf(ring, n); long total = 0; for (long v : a) total += v; Arrays.sort(a);
            int worst = Math.max(1, (int) Math.ceil(n * 0.01)); long wsum = 0; for (int i = n - worst; i < n; i++) wsum += a[i];
            double avgMs = total / 1e6 / n, lowMs = wsum / 1e6 / worst;
            return new Summary(n, 1e9 * n / total, avgMs, a[Math.min(n - 1, (int) Math.ceil(n * 0.99) - 1)] / 1e6, 1000.0 / lowMs);
        }
    }

    /**
     * long -> object map with open addressing, so per-frame lookups (texture caches keyed by shape and size) don't box
     * keys or build strings. Not thread-safe; grows when 60% full.
     */
    public static final class LongMap<V> {
        private long[] keys = new long[64]; private Object[] vals = new Object[64]; private int size;
        public static long key(int kind, int a, int b) { return ((long) kind << 48) ^ ((long) (a & 0xFFFFFF) << 24) ^ (b & 0xFFFFFF); }
        private static int mix(long k) { k ^= k >>> 33; k *= 0xff51afd7ed558ccdL; k ^= k >>> 33; return (int) k; }
        @SuppressWarnings("unchecked") public V get(long k) { int m = keys.length - 1; for (int i = mix(k) & m; vals[i] != null; i = (i + 1) & m) if (keys[i] == k) return (V) vals[i]; return null; }
        public void put(long k, V v) {
            if (v == null) throw new IllegalArgumentException("null value");
            if ((size + 1) * 5 > keys.length * 3) grow();
            int m = keys.length - 1, i = mix(k) & m; for (; vals[i] != null; i = (i + 1) & m) if (keys[i] == k) { vals[i] = v; return; }
            keys[i] = k; vals[i] = v; size++;
        }
        public int size() { return size; }
        private void grow() { long[] ok = keys; Object[] ov = vals; keys = new long[ok.length * 2]; vals = new Object[ok.length * 2]; size = 0; for (int i = 0; i < ok.length; i++) if (ov[i] != null) { @SuppressWarnings("unchecked") V v = (V) ov[i]; put(ok[i], v); } }
    }

    public static long usedMemoryBytes() { Runtime r = Runtime.getRuntime(); return r.totalMemory() - r.freeMemory(); }
    public static long maxMemoryBytes() { return Runtime.getRuntime().maxMemory(); }

    /** Collections and pause time since the previous call. Call from a slow timer, not every frame. */
    public static final class GcSampler {
        private long lastCount, lastMs;
        public long[] sample() {
            long c = 0, t = 0; for (GarbageCollectorMXBean b : ManagementFactory.getGarbageCollectorMXBeans()) { if (b.getCollectionCount() > 0) c += b.getCollectionCount(); if (b.getCollectionTime() > 0) t += b.getCollectionTime(); }
            long[] d = {c - lastCount, t - lastMs}; lastCount = c; lastMs = t; return d;
        }
    }
}
