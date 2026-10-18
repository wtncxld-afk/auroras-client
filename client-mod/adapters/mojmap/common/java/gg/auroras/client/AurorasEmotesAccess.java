package gg.auroras.client;

/** Public bridge so the mixin package can reach the package-private emote state. */
public final class AurorasEmotesAccess {
    private AurorasEmotesAccess() {}
    /** Set on your own player's render state by AvatarRendererMixin; the model mixin poses only states that carry it. */
    public static final net.fabricmc.fabric.api.client.rendering.v1.RenderStateDataKey<Boolean> LOCAL_PLAYER = net.fabricmc.fabric.api.client.rendering.v1.RenderStateDataKey.create(() -> "auroras local player");
    public static boolean sample() { return AurorasEmotes.sample(); }
    public static double[] pose() { return AurorasEmotes.POSE; }
    public static double[] weight() { return AurorasEmotes.WEIGHT; }
}
