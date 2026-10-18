package gg.auroras.core;

// Reads nowplaying.json, written by the launcher's
// Spotify bridge, on a background daemon thread every 2 seconds, only when the file changed. The render thread just reads
// the latest immutable snapshot, so it never waits on the disk.

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class NowPlaying {
    private NowPlaying() {}
    public record Snap(String title, String artist, boolean playing, int progressMs, int durationMs, String status, long at, long version, String artId, boolean art) {
        /** Progress advanced by the time since the launcher read it, while playing. */
        public int progressNow(long nowMs) { return playing ? (int) Math.min(durationMs, progressMs + Math.max(0, nowMs - at)) : progressMs; }
    }
    /** Cover art the launcher saved next to nowplaying.json (64x64 PNG), for the track whose artId matches. */
    public static final String ART_FILE = "nowplaying-art.png";
    public static volatile Snap current;
    static long version;
    public static void start(Path file) {
        Thread t = new Thread(() -> {
            long seen = -1;
            while (true) {
                try {
                    if (Files.exists(file)) { long m = Files.getLastModifiedTime(file).toMillis(); if (m != seen) { seen = m; current = parse(Files.readString(file)); } }
                    else current = null;
                    Thread.sleep(2000);
                } catch (InterruptedException e) { return; } catch (Exception e) { current = new Snap("", "", false, 0, 0, "unavailable", System.currentTimeMillis(), ++version, "", false); }
            }
        }, "Auroras now-playing reader");
        t.setDaemon(true); t.setPriority(Thread.MIN_PRIORITY); t.start();
    }
    static String str(String json, String key) { Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.){0,240})\"").matcher(json); return m.find() ? m.group(1).replace("\\\"", "\"").replace("\\\\", "\\") : ""; }
    static long num(String json, String key) { Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*(-?\\d{1,15})").matcher(json); return m.find() ? Long.parseLong(m.group(1)) : 0; }
    public static Snap parse(String j) {
        if (j.length() > 8192) return new Snap("", "", false, 0, 0, "unavailable", System.currentTimeMillis(), ++version, "", false);
        return new Snap(str(j, "title"), str(j, "artist"), j.matches("(?s).*\"playing\"\\s*:\\s*true.*"), (int) num(j, "progressMs"), (int) num(j, "durationMs"), str(j, "status"), num(j, "at"), ++version, str(j, "artId").replaceAll("[^A-Za-z0-9]", ""), j.matches("(?s).*\"art\"\\s*:\\s*true.*"));
    }
}
