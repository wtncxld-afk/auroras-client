package gg.auroras.core;

import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Maps the running Minecraft version to the adapter that knows its APIs. Version-specific code lives in adapters only.
 * If no adapter covers a version the client must load nothing and say why; it never guesses.
 */
public final class Adapters {
    private Adapters() {}
    public enum Status { SCAFFOLD, VALIDATED }
    /** Client features an adapter can provide. The launcher's compatibility matrix lists one column per feature. */
    public enum Feature {
        MODULE_GUI("Module menu"), HUD("HUD"), HUD_EDITOR("HUD editor"), SKY("Custom skies"), EMOTES("Emotes");
        public final String label; Feature(String label) { this.label = label; }
    }
    /** features = what this adapter has code for. Having code is not the same as working: the matrix only says "Tested" after a recorded in-game test. */
    public record Adapter(String id, String loader, McVersion min, McVersion max, Status status, Set<Feature> features, String note) {
        public Adapter { features = Set.copyOf(features); }
        public boolean has(Feature f) { return features.contains(f); }
    }

    /** The 1.21.11+ adapter has no sky hook (Fabric has none for these versions), so it doesn't claim Custom Skies. */
    private static final Set<Feature> MOJMAP = EnumSet.of(Feature.MODULE_GUI, Feature.HUD, Feature.HUD_EDITOR, Feature.EMOTES);
    private static final String MOJMAP_NOTE = "Written against Mojang's names and Fabric API for this version; never compiled or run. Custom skies and capes aren't ported";
    /** Add an entry here (and an adapter module) to support another release. VALIDATED only after a real in-game test pass. */
    public static final List<Adapter> ALL = List.of(
        new Adapter("y1_21_4", "fabric", new McVersion(1, 21, 4), new McVersion(1, 21, 4), Status.SCAFFOLD, EnumSet.allOf(Feature.class), "Written against Fabric API 1.21.4; never compiled or run"),
        // client-mod/adapters/mojmap: one source for 1.21.11 and the 26.x lines, built per target by the release workflow.
        new Adapter("m1_21_11", "fabric", new McVersion(1, 21, 11), new McVersion(1, 21, 11), Status.SCAFFOLD, MOJMAP, MOJMAP_NOTE),
        new Adapter("m26_1", "fabric", new McVersion(26, 1, 0), new McVersion(26, 1, 99), Status.SCAFFOLD, MOJMAP, MOJMAP_NOTE),
        new Adapter("m26_2", "fabric", new McVersion(26, 2, 0), new McVersion(26, 2, 99), Status.SCAFFOLD, MOJMAP, MOJMAP_NOTE),
        new Adapter("m26_3", "fabric", new McVersion(26, 3, 0), new McVersion(26, 3, 99), Status.SCAFFOLD, MOJMAP, MOJMAP_NOTE));

    public static Optional<Adapter> select(String mc) {
        Optional<McVersion> v = McVersion.parse(mc); if (v.isEmpty()) return Optional.empty();
        for (Adapter a : ALL) if (v.get().compareTo(a.min()) >= 0 && v.get().compareTo(a.max()) <= 0) return Optional.of(a);
        return Optional.empty();
    }
    public static String describe(String mc) {
        Optional<Adapter> a = select(mc);
        if (a.isPresent()) return "Minecraft " + mc + ": adapter " + a.get().id() + " (" + (a.get().status() == Status.VALIDATED ? "validated" : "not validated") + ")";
        return "Minecraft " + mc + ": no Auroras adapter for this version yet, so the client is staying disabled";
    }
}
