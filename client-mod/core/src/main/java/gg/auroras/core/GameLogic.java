package gg.auroras.core;

import java.util.*;

/**
 * Game-independent rules for the player, rendering and information modules. The Fabric adapter feeds in what the game
 * reports and draws or applies what these return; every rule here is unit-tested in ModuleTests.
 */
public final class GameLogic {
    private GameLogic() {}

    // ---------- Direction HUD ----------
    /** Heading in degrees, 0..359 (0 = north, 90 = east), from Minecraft's yaw (0 = south, 90 = west). */
    public static int heading(float yaw) { return Math.floorMod(Math.round(yaw) + 180, 360); }
    /** Compass strip centred on the heading: " W  ·  NW  ·  N  ·  NE " style, width in "slots" of 15 degrees. */
    public static String compassStrip(float yaw, int slots) {
        int h = heading(yaw), half = slots / 2; StringBuilder b = new StringBuilder();
        for (int k = -half; k <= half; k++) {
            int d = Math.floorMod((int) (Math.round(h / 15.0) * 15) + k * 15, 360);
            String lab = switch (d) { case 0 -> "N"; case 45 -> "NE"; case 90 -> "E"; case 135 -> "SE"; case 180 -> "S"; case 225 -> "SW"; case 270 -> "W"; case 315 -> "NW"; default -> "·"; };
            b.append(k == -half ? "" : " ").append(lab);
        }
        return b.toString();
    }
    public static String direction(float yaw, boolean degrees) { String c = Calc.compass(yaw); return degrees ? c + "  " + heading(yaw) + "°" : c; }

    // ---------- Information modules ----------
    public static String memory(long used, long max, boolean bar) {
        long mu = used >> 20, mm = max >> 20; int pct = max <= 0 ? 0 : (int) Math.round(used * 100.0 / max);
        String s = "Memory " + pct + "%  " + mu + " / " + mm + " MB"; if (!bar) return s;
        int n = (int) Math.round(Sky.clamp(pct / 10.0, 0, 10)); return s + "  " + "█".repeat(n) + "░".repeat(10 - n);
    }
    /** "minecraft:dark_forest" -> "Dark Forest"; other namespaces keep a small suffix so modded biomes are recognisable. */
    public static String biomeName(String id) {
        if (id == null || id.isEmpty()) return "Unknown biome"; int c = id.indexOf(':'); String ns = c < 0 ? "minecraft" : id.substring(0, c), path = c < 0 ? id : id.substring(c + 1);
        StringBuilder b = new StringBuilder(); for (String w : path.split("[_/]")) if (!w.isEmpty()) b.append(b.length() > 0 ? " " : "").append(Character.toUpperCase(w.charAt(0))).append(w.substring(1));
        return ns.equals("minecraft") ? b.toString() : b + " (" + ns + ")";
    }
    public static String dimensionName(String id) { return switch (id == null ? "" : id) { case "minecraft:overworld" -> "Overworld"; case "minecraft:the_nether" -> "Nether"; case "minecraft:the_end" -> "End"; default -> biomeName(id); }; }
    public static String biome(String biomeId, String dimId, boolean showDim) { return showDim ? biomeName(biomeId) + " · " + dimensionName(dimId) : biomeName(biomeId); }
    /** Server line; parts the game didn't report are left out instead of guessed. Singleplayer says so. */
    public static List<String> serverInfo(String address, int players, int ping, String version, boolean showAddress, boolean showPlayers, boolean showPing, boolean showVersion) {
        if (address == null) return List.of("Singleplayer");
        List<String> l = new ArrayList<>(); if (showAddress) l.add(address);
        List<String> p = new ArrayList<>(); if (showPlayers && players >= 0) p.add(players + (players == 1 ? " player" : " players")); if (showPing && ping > 0) p.add(ping + " ms"); if (showVersion && version != null && !version.isBlank()) p.add(version);
        if (!p.isEmpty()) l.add(String.join(" · ", p)); if (l.isEmpty()) l.add("Multiplayer"); return l;
    }

    /** Frame-time graph: the latest n frame times (ms) as bar heights 0..h, scaled so 50 ms (20 fps) fills the graph. */
    public static final class FrameGraph {
        private final double[] ms; private int head, count;
        public FrameGraph(int capacity) { ms = new double[Math.max(8, capacity)]; }
        public void add(double frameMs) { ms[head] = frameMs; head = (head + 1) % ms.length; count = Math.min(count + 1, ms.length); }
        public int count() { return count; }
        /** Heights for the newest n frames, oldest first, into out (length >= n). Returns how many were written. */
        public int heights(int n, int h, int[] out) { int c = Math.min(n, count); for (int k = 0; k < c; k++) { double v = ms[Math.floorMod(head - c + k, ms.length)]; out[k] = (int) Math.round(Sky.clamp(v / 50.0, 0, 1) * h); } return c; }
        public double worst(int n) { double w = 0; int c = Math.min(n, count); for (int k = 0; k < c; k++) w = Math.max(w, ms[Math.floorMod(head - 1 - k, ms.length)]); return w; }
        /** Bar color: green under 16.7 ms (60 fps), yellow under 33.3 ms (30 fps), red above. */
        public static int color(int barH, int h) { double ms = barH * 50.0 / Math.max(1, h); return ms <= 16.7 ? 0x6FCF97 : ms <= 33.4 ? 0xE0B45A : 0xE57373; }
    }

    /** Session statistics from what the client sees. Counts only grow; the session restarts when you join a world. */
    public static final class Session {
        public long startMs; public double distance; public int blocks, deaths; private double lx = Double.NaN, ly, lz; private boolean wasDead;
        public void start(long nowMs) { startMs = nowMs; distance = 0; blocks = 0; deaths = 0; lx = Double.NaN; wasDead = false; }
        /** Call each tick with the player's position. Teleports (more than 20 blocks in a tick) aren't counted as walking. */
        public void move(double x, double y, double z) { if (!Double.isNaN(lx)) { double d = Math.sqrt((x - lx) * (x - lx) + (y - ly) * (y - ly) + (z - lz) * (z - lz)); if (d < 20) distance += d; } lx = x; ly = y; lz = z; }
        public void blockBroken() { blocks++; }
        /** Call each tick; counts a death once when health drops to 0. */
        public void health(float hp) { boolean dead = hp <= 0; if (dead && !wasDead) deaths++; wasDead = dead; }
        public List<String> lines(long nowMs, boolean time, boolean dist, boolean blk, boolean dth) {
            List<String> l = new ArrayList<>(); if (time) l.add("Session " + HudKit.session(nowMs - startMs));
            if (dist) l.add(distance < 1000 ? "Walked " + Math.round(distance) + " m" : "Walked " + Calc.num(distance / 1000, 1) + " km");
            if (blk) l.add("Blocks broken " + blocks); if (dth) l.add("Deaths " + deaths); return l.isEmpty() ? List.of("Session") : l;
        }
    }

    // ---------- Player modules ----------
    /** Toggle on key press (rising edge). Used for toggle sneak; toggle sprint uses Calc.SprintToggle (which also checks it's allowed). */
    public static final class Toggle { private boolean on, last; public boolean update(boolean keyDown) { if (keyDown && !last) on = !on; last = keyDown; return on; } public boolean on() { return on; } public void reset() { on = false; } }

    /**
     * Toggle Sprint / Toggle Sneak status line ("Show status"), or null when there is nothing to show. Sneaking wins,
     * because the game stops sprinting while you sneak. sprinting = the toggle is actually holding sprint right now.
     */
    public static String toggleStatus(boolean sprintShow, boolean sprintToggled, boolean sprinting, boolean sneakShow, boolean sneakToggled) {
        if (sneakShow && sneakToggled) return "Sneaking (toggled)";
        if (sprintShow && sprintToggled) return sprinting ? "Sprinting (toggled)" : "Sprint toggled";
        return null;
    }

    /** Zoom factor changed by the scroll wheel while zooming, clamped to the setting's range. */
    public static double zoomScroll(double factor, double scroll) { return Sky.clamp(Math.round(factor * Math.pow(1.15, scroll) * 100) / 100.0, 1.1, 10); }

    /**
     * Freelook: while active, mouse movement turns a separate camera instead of the player, so you can look around while
     * running in one direction. Pitch is clamped like vanilla. On release the camera snaps back to where the player faces.
     */
    public static final class Freelook {
        public boolean active; public float yaw, pitch; private boolean last;
        /** mode "hold" or "toggle". Returns whether freelook is active after this key state. */
        public boolean key(boolean down, String mode, float playerYaw, float playerPitch) {
            boolean want = "toggle".equals(mode) ? (down && !last ? !active : active) : down; last = down;
            if (want && !active) { yaw = playerYaw; pitch = playerPitch; } active = want; return active;
        }
        public void look(double dx, double dy, double sensitivity) { yaw += (float) (dx * 0.15 * sensitivity); pitch = (float) Sky.clamp(pitch + dy * 0.15 * sensitivity, -90, 90); }
    }

    /** Perspective cycling (F5): first person -> back -> front, optionally skipping the front view. 0 first, 1 back, 2 front. */
    public static int nextPerspective(int cur, boolean skipFront) { int n = (cur + 1) % 3; return skipFront && n == 2 ? 0 : n; }

    // ---------- Rendering modules ----------
    /**
     * Crosshair pieces as rectangles {x, y, w, h} relative to the screen centre. style: cross, dot, circle (8 short arcs), square.
     * spread (0..1) widens the gap while moving when dynamic is on. outline adds 1 px dark rectangles drawn first.
     */
    public static List<int[]> crosshair(String style, int size, int thickness, int gap, boolean dot, double spread) {
        List<int[]> r = new ArrayList<>(); int t = Math.max(1, thickness), g = gap + (int) Math.round(Sky.clamp(spread, 0, 1) * 4), h0 = -t / 2;
        switch (style) {
            case "dot" -> r.add(new int[]{-t, -t, t * 2, t * 2});
            case "square" -> { int s = g + size; r.add(new int[]{-s, -s, s * 2, t}); r.add(new int[]{-s, s - t, s * 2, t}); r.add(new int[]{-s, -s, t, s * 2}); r.add(new int[]{s - t, -s, t, s * 2}); }
            case "circle" -> { int rad = g + size / 2 + 1; for (int k = 0; k < 8; k++) { double a = k * Math.PI / 4; int x = (int) Math.round(Math.cos(a) * rad), y = (int) Math.round(Math.sin(a) * rad); r.add(new int[]{x + h0, y + h0, t, t}); } }
            default -> { r.add(new int[]{-g - size, h0, size, t}); r.add(new int[]{g + 1, h0, size, t}); r.add(new int[]{h0, -g - size, t, size}); r.add(new int[]{h0, g + 1, t, size}); }
        }
        if (dot && !style.equals("dot")) r.add(new int[]{h0, h0, t, t});
        return r;
    }
    public static List<int[]> outline(List<int[]> pieces) { List<int[]> o = new ArrayList<>(); for (int[] p : pieces) o.add(new int[]{p[0] - 1, p[1] - 1, p[2] + 2, p[3] + 2}); return o; }

    /** Low fire: how far (in screen fractions) the first-person fire overlay is pushed down, and its opacity. */
    public static double fireOffset(double height) { return Sky.clamp(1 - height, 0, 1) * 0.3; }

    /**
     * Particle Settings: keeps roughly `multiplier` of new particles using a running fraction (no randomness, so the same
     * amount is kept every frame), and drops particle types the player turned off.
     */
    public static final class ParticleFilter {
        private double carry; public double multiplier = 1; public final Set<String> hidden = new HashSet<>();
        public boolean keep(String typeId) { if (hidden.contains(typeId)) return false; if (multiplier >= 1) return true; carry += multiplier; if (carry >= 1) { carry -= 1; return true; } return false; }
        public static Set<String> hiddenTypes(boolean explosions, boolean blockBreak, boolean rain) {
            Set<String> s = new HashSet<>(); if (explosions) { s.add("minecraft:explosion"); s.add("minecraft:explosion_emitter"); } if (blockBreak) s.add("minecraft:block"); if (rain) { s.add("minecraft:rain"); s.add("minecraft:splash"); } return s;
        }
    }

    /** Fullbright: brightness added to the lightmap so dark areas read as day; level 0.1..1. */
    public static float fullbrightGamma(double level) { return (float) (1 + Sky.clamp(level, 0, 1) * 15); }

    /** Hit Color: the packed ARGB used for the damage overlay texture (vanilla is 0xB2FF0000). */
    public static int hitColor(int rgb, int opacityPct) { return (((int) Sky.clamp(opacityPct, 0, 100) * 255 / 100) << 24) | (rgb & 0xFFFFFF); }

    /** Boss bar placement: y offset and scale applied around the top centre; hidden returns null. */
    public static double[] bossBar(boolean hide, double scale, int offY) { return hide ? null : new double[]{Sky.clamp(scale, 0.5, 1.5), offY}; }

    // ---------- Cosmetics ----------
    /**
     * Totem effects schedule: how many particles to spawn this frame (spawned evenly over `duration` seconds after the totem
     * pops), and the screen overlay alpha (fades out over overlayDuration). Fractional counts carry over between frames.
     */
    public static final class TotemFx {
        private double t = -1, carry; public double density = 1, duration = 1.5, overlayIntensity = 0.4, overlayDuration = 0.8; public boolean overlay;
        public void pop() { t = 0; carry = 0; }
        public boolean active() { return t >= 0 && t < Math.max(duration, overlay ? overlayDuration : 0); }
        /** Advances by dt seconds; returns particles to spawn now. */
        public int update(double dt) { if (t < 0) return 0; double before = t; t += dt; if (before >= duration) return 0; double rate = 40 * density / duration; carry += rate * (Math.min(t, duration) - before); int n = (int) carry; carry -= n; return n; }
        public double overlayAlpha() { if (!overlay || t < 0 || t >= overlayDuration) return 0; double x = t / overlayDuration; return overlayIntensity * (1 - x) * (1 - x); }
    }
    /** Menu animation speed applied to the Auroras screens' easing time constants (reduced motion jumps straight to the end). */
    public static double animTau(double baseTau, double speed, boolean reduced) { return reduced ? 0 : baseTau / Sky.clamp(speed, 0.25, 2); }
}
