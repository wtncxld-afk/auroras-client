package gg.auroras.client;

/** Public bridge so the mixin package can reach the package-private emote state. */
public final class AurorasEmotesAccess {
    private AurorasEmotesAccess() {}
    public static boolean sample(int entityId) { return AurorasEmotes.sample(entityId); }
    public static double[] pose() { return AurorasEmotes.POSE; }
    public static double[] weight() { return AurorasEmotes.WEIGHT; }
}
