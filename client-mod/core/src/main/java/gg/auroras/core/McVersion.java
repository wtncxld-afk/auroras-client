package gg.auroras.core;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Release versions only: 1.21, 1.21.4, and Mojang's newer year-based releases such as 26.1. Snapshots and pre-releases do not parse. */
public record McVersion(int major, int minor, int patch) implements Comparable<McVersion> {
    private static final Pattern P = Pattern.compile("^(\\d{1,3})\\.(\\d{1,3})(?:\\.(\\d{1,3}))?$");
    public static Optional<McVersion> parse(String s) {
        if (s == null) return Optional.empty();
        Matcher m = P.matcher(s); if (!m.matches()) return Optional.empty();
        return Optional.of(new McVersion(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), m.group(3) == null ? 0 : Integer.parseInt(m.group(3))));
    }
    @Override public int compareTo(McVersion o) { int c = Integer.compare(major, o.major); if (c != 0) return c; c = Integer.compare(minor, o.minor); return c != 0 ? c : Integer.compare(patch, o.patch); }
    public boolean atLeast(int maj, int min) { return compareTo(new McVersion(maj, min, 0)) >= 0; }
}
