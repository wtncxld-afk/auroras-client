package gg.auroras.core;

import java.nio.file.*;

/** Prints how the mod reads a nowplaying.json file: title|artist|playing|progress|duration|status|progressNow(at+1000). */
public final class NowPlayingCheck {
    public static void main(String[] a) throws Exception {
        NowPlaying.Snap s = NowPlaying.parse(Files.readString(Path.of(a[0])));
        if (a.length > 1) { System.out.println(s.artId() + "|" + s.art()); return; }
        System.out.println(s.title() + "|" + s.artist() + "|" + s.playing() + "|" + s.progressMs() + "|" + s.durationMs() + "|" + s.status() + "|" + s.progressNow(s.at() + 1000));
    }
}
