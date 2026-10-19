package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Custom Skies on versions where Fabric API has no sky hook.
//
// How it works: LevelRendererSkyMixin calls begin() at the start of Minecraft's sky pass (the lambda LevelRenderer
// hands to the frame graph). If the dimension has a theme, begin() asks core SkyMesh for this frame's quads (dome,
// ground, nebula, constellations, stars, shooting stars, layered aurora, clouds, petals: the same Sky / SkyFx maths as
// the launcher preview) and Platform.skyQuads() draws them. SkyRendererMixin then skips the vanilla sky disc, sunrise
// glow, stars, dark disc and End sky for that frame, but only when begin() really drew, so a failed hook leaves the
// vanilla sky instead of a hole. Minecraft's own sun and moon are still drawn on top.
//
// The Nether has no sky pass in vanilla, so Nether themes do nothing on these versions. Fog isn't applied to the
// themed sky. Settings are re-read when the profile changes, and switching the module on or off applies at once.

import gg.auroras.client.platform.Platform;
import gg.auroras.core.*;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.world.level.Level;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public final class AurorasSky {
    private AurorasSky() {}
    static SkyMesh mesh; static int seen = -1; static boolean broken, covering; static final long START = System.nanoTime();

    /** Called once at startup: loads the themes bundled from visuals/themes.json. Returns false (module locked) if they can't be read. */
    static boolean init() {
        try (InputStream in = AurorasSky.class.getResourceAsStream("/assets/auroras_client/themes.json")) {
            if (in == null) throw new IllegalStateException("themes.json is missing from the jar");
            mesh = new SkyMesh(Sky.load(new String(in.readAllBytes(), StandardCharsets.UTF_8))); return true;
        } catch (Exception e) { System.out.println("[Auroras] sky themes couldn't be loaded, keeping the vanilla sky: " + e.getMessage()); return false; }
    }

    /** LevelRendererSkyMixin, start of the sky pass (render thread). Draws the themed sky if this dimension has one. */
    public static void begin() {
        covering = false;
        if (broken || mesh == null || AurorasClient.PM == null || !AurorasClient.PM.enabled("sky")) return;
        ClientLevel level = Minecraft.getInstance().level; if (level == null) return;
        try {
            Config.ProfileManager pm = AurorasClient.PM; if (pm.revision() != seen) { seen = pm.revision(); mesh.configure(pm::get); }
            String dim = level.dimension() == Level.NETHER ? "minecraft:the_nether" : level.dimension() == Level.END ? "minecraft:the_end" : "minecraft:overworld";
            if (!mesh.build(dim, Platform.dayTime(level), (System.nanoTime() - START) / 1e9)) return;
            covering = Platform.skyQuads(mesh.pos, mesh.col, mesh.quads);
        } catch (RuntimeException e) {
            // never break the frame: log once and leave the vanilla sky for the rest of the session
            broken = true; covering = false; System.out.println("[Auroras] Custom Skies turned off for this session, the renderer refused it: " + e);
        }
    }
    /** LevelRendererSkyMixin, end of the sky pass. */
    public static void end() { covering = false; }
    /** SkyRendererMixin: true while the themed sky has been drawn in this sky pass, so the vanilla layers are skipped. */
    public static boolean replacesVanilla() { return covering; }
}
