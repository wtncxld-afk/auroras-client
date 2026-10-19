package gg.auroras.core;

import java.util.*;

/** Pure game-independent logic used by the Minecraft-side modules. No Minecraft classes here, so it is unit-testable. */
public final class Calc {
    private Calc() {}

    /** Rolling-window click counter. Time is injected, so tests do not sleep. */
    public static final class CpsCounter {
        private final long windowMs; private final long[] ring = new long[512]; private int head, size;
        public CpsCounter(long windowMs) { if (windowMs < 100 || windowMs > 10000) throw new IllegalArgumentException("window"); this.windowMs = windowMs; }
        public void click(long nowMs) { if (size == ring.length) { head = (head + 1) % ring.length; size--; } ring[(head + size) % ring.length] = nowMs; size++; }
        public int cps(long nowMs) { trim(nowMs); return (int) Math.round(size * 1000.0 / windowMs); }
        public void reset() { head = 0; size = 0; }
        private void trim(long now) { while (size > 0 && now - ring[head] >= windowMs) { head = (head + 1) % ring.length; size--; } }
    }

    /** Publishes FPS once per interval from real frame timestamps (nanoseconds). */
    public static final class FpsSmoother {
        private final long intervalNs; private long start = -1; private int frames, fps; private double frameMs;
        public FpsSmoother(long intervalMs) { this.intervalNs = intervalMs * 1_000_000L; }
        public void frame(long nowNs) {
            if (start < 0) { start = nowNs; return; }
            frames++; long el = nowNs - start;
            if (el >= intervalNs) { fps = (int) Math.round(frames * 1e9 / el); frameMs = el / 1e6 / frames; frames = 0; start = nowNs; }
        }
        public int fps() { return fps; } public double frameTimeMs() { return frameMs; }
    }

    public static String clock(int h, int m, int s, boolean h24, boolean seconds) {
        if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) throw new IllegalArgumentException("time");
        if (h24) return seconds ? String.format(Locale.ROOT, "%02d:%02d:%02d", h, m, s) : String.format(Locale.ROOT, "%02d:%02d", h, m);
        int hh = h % 12 == 0 ? 12 : h % 12; String ap = h < 12 ? "AM" : "PM";
        return seconds ? String.format(Locale.ROOT, "%d:%02d:%02d %s", hh, m, s, ap) : String.format(Locale.ROOT, "%d:%02d %s", hh, m, ap);
    }

    /** Minecraft yaw: 0 = south, 90 = west, 180 = north, -90 = east. */
    public static String compass(float yaw) {
        float y = ((yaw % 360f) + 360f) % 360f; int i = Math.round(y / 45f) % 8;
        return new String[]{"S", "SW", "W", "NW", "N", "NE", "E", "SE"}[i];
    }

    static String num(double v, int dec) {
        String s = String.format(Locale.ROOT, "%." + dec + "f", v);
        if (s.startsWith("-") && s.replaceAll("[-.0]", "").isEmpty()) s = s.substring(1);
        return s;
    }
    public static String coords(double x, double y, double z, int decimals, String dir) {
        String r = "XYZ: " + num(x, decimals) + " " + num(y, decimals) + " " + num(z, decimals);
        return dir == null ? r : r + " (" + dir + ")";
    }

    /** Remaining durability percent, or -1 for empty or unbreakable slots. */
    public static int armorPercent(int maxDamage, int damage) {
        if (maxDamage <= 0) return -1;
        int left = Math.max(0, Math.min(maxDamage, maxDamage - damage));
        return (int) Math.round(left * 100.0 / maxDamage);
    }
    public static int armorColor(int pct) { return pct < 0 ? 0xAAAAAA : pct >= 60 ? 0x55FF55 : pct >= 30 ? 0xFFFF55 : 0xFF5555; }

    /** Smooth zoom. fovMultiplier() returns exactly 1.0 once released, so normal camera behavior is restored. */
    public static final class Zoom {
        private double factor; private final double speed; private double cur = 1.0;
        public Zoom(double factor, double speed) {
            if (factor < 1.1 || factor > 20) throw new IllegalArgumentException("factor");
            this.factor = factor; this.speed = Math.max(0.01, Math.min(1.0, speed));
        }
        public void tick(boolean keyDown) { double t = keyDown ? 1.0 / factor : 1.0; cur += (t - cur) * speed; if (Math.abs(t - cur) < 1e-3) cur = t; }
        /**
         * Per-frame version of tick: the same easing (speed per 1/20 s), spread over real time, so the zoom glides at any
         * frame rate instead of stepping 20 times a second. dt is in seconds; dt = 0.05 matches one tick exactly.
         */
        public void frame(boolean keyDown, double dtSeconds) {
            double t = keyDown ? 1.0 / factor : 1.0, k = 1 - Math.pow(1 - speed, Math.max(0, Math.min(0.25, dtSeconds)) * 20);
            cur += (t - cur) * k; if (Math.abs(t - cur) < 1e-3) cur = t;
        }
        /** New settings without jumping: keeps the current zoom level and the scroll-adjusted factor while zoomed. */
        public Zoom withSettings(double newFactor, double newSpeed) { Zoom z = new Zoom(newFactor, newSpeed); z.cur = cur; return z; }
        public double fovMultiplier() { return cur; }
        public double factor() { return factor; }
        /** Scroll-wheel zoom: changes the target while zooming; the FOV eases to it like the initial zoom. */
        public void setFactor(double f) { factor = Math.max(1.1, Math.min(20, f)); }
        public boolean active() { return cur < 1.0; }
        public double sensitivityScale() { return cur; }
    }

    public static final class SprintToggle {
        private boolean on, last;
        public boolean update(boolean keyDown, boolean forward, boolean sneaking, boolean canSprint) {
            if (keyDown && !last) on = !on; last = keyDown;
            return on && forward && !sneaking && canSprint;
        }
        public boolean on() { return on; }
        /** Module turned off: forget the toggle, so turning it back on doesn't start sprinting by itself. */
        public void reset() { on = false; }
    }

    /** Returns the actions that already use this key (excluding the action being bound). Key -1 means unbound. */
    public static List<String> keyConflicts(Map<String, Integer> bindings, String action, int key) {
        List<String> out = new ArrayList<>(); if (key < 0) return out;
        for (Map.Entry<String, Integer> e : bindings.entrySet()) if (!e.getKey().equals(action) && e.getValue() == key) out.add(e.getKey());
        return out;
    }
}
