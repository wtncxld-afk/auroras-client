package gg.auroras.core;

import java.nio.file.*;
import java.util.*;

/** Cross-check for the launcher's tests: reads <dir>/emotes the way the mod does and prints {custom, errors, wheel} as JSON. */
public class EmoteCheck {
    public static void main(String[] a) throws Exception {
        Path visuals = Path.of(a[1]); List<Emotes.Emote> lib = Emotes.parseLibrary(Files.readString(visuals.resolve("emotes.json")));
        List<String> errs = new ArrayList<>(); List<Emotes.Emote> custom = Emotes.loadCustom(Path.of(a[0]).resolve("emotes"), errs);
        Set<String> known = new LinkedHashSet<>(); lib.forEach(e -> known.add(e.id())); custom.forEach(e -> known.add(e.id()));
        Path wf = Path.of(a[0]).resolve("emotes").resolve("wheel.txt"); String[] wheel = Emotes.parseWheel(Files.exists(wf) ? Files.readString(wf) : null, known);
        StringBuilder b = new StringBuilder("{\"custom\":["); for (int k = 0; k < custom.size(); k++) { Emotes.Emote e = custom.get(k); int keys = 0; for (Emotes.Key[] ks : e.keys()) keys += ks.length; b.append(k > 0 ? "," : "").append("{\"id\":\"").append(e.id()).append("\",\"duration\":").append(e.duration()).append(",\"keys\":").append(keys).append("}"); }
        b.append("],\"errors\":").append(errs.size()).append(",\"wheel\":["); for (int k = 0; k < wheel.length; k++) b.append(k > 0 ? "," : "").append(wheel[k] == null ? "null" : "\"" + wheel[k] + "\""); b.append("]}");
        System.out.println(b);
    }
}
