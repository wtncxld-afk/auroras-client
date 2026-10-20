package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Written against Mojang's names and Fabric API without the
// game jars (checked against Fabric API's own sources for these versions where they use the same classes), so expect
// small fixes on the first build. Only this folder knows Minecraft classes; all logic is in ../../core.
//
// Performance rules followed here (see core Perf):
//  - settings are parsed only when the profile revision changes, never per frame
//  - HUD strings are rebuilt only when the numbers behind them change
//  - no collections or boxed values are created while rendering
//  - memory and GC are sampled once a second, not every frame
//  - disabled modules do no work beyond one boolean check

import gg.auroras.client.platform.Mc;
import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Platform;
import gg.auroras.core.*;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.network.chat.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

public class AurorasClient implements ClientModInitializer {
    public static final Config.Registry REG = new Config.Registry();
    public static Config.ProfileManager PM;
    static final Path DIR = FabricLoader.getInstance().getConfigDir().resolve("auroras");
    static String mcVersion = "?", modVersion = "";
    static KeyMapping guiKey, benchKey, hudEditKey, emoteKey;

    static final Calc.FpsSmoother FPS_SMOOTH = new Calc.FpsSmoother(500);
    static final Perf.FrameStats BENCH = new Perf.FrameStats(60 * 240);
    static final Perf.GcSampler GC = new Perf.GcSampler();
    static long lastFrameNs, benchUntilNs;
    static boolean benchRunning, windowActive = true;


    @Override public void onInitializeClient() {
        mcVersion = FabricLoader.getInstance().getModContainer("minecraft").map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("?");
        // "1.2.3+mc26.3" -> "1.2.3" for the main menu's version line
        modVersion = FabricLoader.getInstance().getModContainer("auroras_client").map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("").replaceAll("\\+.*$", "");
        // fabric.mod.json already limits this jar to its Minecraft line, so Fabric won't load it on another version.
        REG.restrict(Platform.NOT_PORTED, "Not in the Minecraft " + mcVersion + " build yet");
        // Custom Skies is drawn through our own mixins (Fabric has no sky hook for these versions); it stays locked only if
        // its themes can't be read or this version's renderer lacks the calls it needs.
        if (!AurorasSky.init() || !Platform.skySupported()) REG.restrict(List.of("sky"), "Custom Skies can't hook into Minecraft " + mcVersion + "'s renderer yet");
        PM = new Config.ProfileManager(REG);
        try { int skipped = PM.load(DIR); if (skipped > 0 || PM.skippedLines > 0) System.out.println("[Auroras] skipped " + skipped + " invalid profile file(s) and " + PM.skippedLines + " invalid setting(s)"); } catch (Exception e) { System.out.println("[Auroras] using default settings: " + e.getMessage()); }
        guiKey = Platform.key("key.auroras.gui", Integer.parseInt(PM.get(Config.Registry.GUI_KEY)));
        hudEditKey = Platform.key("key.auroras.hudeditor", -1);
        emoteKey = Platform.key("key.auroras.emotes", Integer.parseInt(PM.get("emotes.wheelKey")));
        benchKey = Platform.key("key.auroras.benchmark", -1);
        AurorasModules.register();
        AurorasWorld.register(); // in-world cosmetics (aura, trails, particles, nameplates, damage, emblem); local only
        AurorasCape.init(DIR); // Custom Capes: only you see it (see AurorasCape)
        AurorasHands.register(); AurorasStream.register(); AurorasSkin.init(DIR); // first-person, streaming and Skin Changer (all local)
        ClientTickEvents.END_CLIENT_TICK.register(c -> {
            // the menu key is the only way into Auroras' settings, so it never stays unbound (an old options.txt can carry
            // "key.auroras.gui:key.keyboard.unknown"); it goes back to the Menu key setting, Right Shift unless changed
            if (Mc.screen(c) == null && guiKey.isUnbound()) { Platform.rebind(guiKey, Integer.parseInt(PM.get(Config.Registry.GUI_KEY))); c.options.save(); System.out.println("[Auroras] the menu key was unbound; set it back to the Menu key setting"); }
            while (guiKey.consumeClick()) if (Mc.screen(c) == null) Mc.setScreen(c, new RadialScreen());
            while (hudEditKey.consumeClick()) Mc.setScreen(c, new HudEditorScreen(null));
            // the wheel key opens the wheel; pressed again while an emote plays, it stops the emote
            while (emoteKey.consumeClick()) if (PM.enabled("emotes") && Mc.screen(c) == null) { if (AurorasEmotes.playing()) AurorasEmotes.cancelAll("cancelled"); else Mc.setScreen(c, new EmoteWheelScreen()); }
            while (benchKey.consumeClick()) startBenchmark(c);
            // CPS: clicks made while the game window is in the background never count (checked once a tick, so it
            // needs no window hook, whose name differs between versions)
            boolean active = c.isWindowActive(); if (windowActive && !active) HudRendererAccess.focusLost(); windowActive = active;
            AurorasEmotes.tick(c);
            AurorasModules.tick(c);
            AurorasWorld.tick(c);
            AurorasCape.tick(c);
            AurorasHands.tick(c); AurorasStream.tick(c); AurorasSpirit.tick(c); AurorasSkin.tick(c);
            // bake the radial menu's art in the background for this window size, so Right Shift opens instantly
            if (c.player != null && Mc.screen(c) == null) RadialArt.prepare(Gfx.screenW(), Gfx.screenH(), Gfx.guiScale());
        });
        // Per-server and per-world profiles: use the assigned profile while connected, then switch back.
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> client.execute(() -> {
            ServerData sd = client.getCurrentServer(); String server = sd != null ? sd.ip : null;
            String world = client.getSingleplayerServer() != null ? client.getSingleplayerServer().getWorldData().getLevelName() : null;
            PM.enterPlace(Config.ProfileManager.placeKey(server, world)); HudRenderer.sessionStart = System.currentTimeMillis(); AurorasModules.SESSION.start(HudRenderer.sessionStart);
        }));
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> client.execute(() -> { PM.leavePlace(); AurorasEmotes.cancelAll("disconnected"); }));
        Platform.hud();
        HudRenderer.init(FabricLoader.getInstance().getGameDir());
        AurorasEmotes.load();
        System.out.println("[Auroras] loaded for Minecraft " + mcVersion + " (" + Platform.NAME + ")");
    }
    static void save() { try { PM.save(DIR); } catch (Exception e) { System.out.println("[Auroras] couldn't save settings: " + e.getMessage()); } }

    /** The Auroras HUD layer, drawn by Fabric's HUD registry just below chat. */
    public static void renderHud(Gfx g) {
        long now = System.nanoTime(); double dt = lastFrameNs == 0 ? 0 : (now - lastFrameNs) / 1e9;
        if (lastFrameNs != 0) { FPS_SMOOTH.frame(now); if (benchRunning) { BENCH.record(now - lastFrameNs); if (now - benchUntilNs >= 0) finishBenchmark(); } }
        lastFrameNs = now; if (dt > 0) HudRenderer.FRAMES.add(dt * 1000);
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || Mc.hudHidden(mc) || Mc.screen(mc) instanceof HudEditorScreen) return;
        AurorasModules.drawTotemOverlay(g);
        HudRenderer.render(g, mc, dt, false, null);
        AurorasStream.drawBadge(g);
    }
    /** Replaces the vanilla crosshair when Crosshair Customizer is on. Returns false to draw the vanilla one. */
    public static boolean crosshair(Gfx g) { return AurorasModules.crosshair(g, Minecraft.getInstance()); }
    private static boolean bossPushed;
    /** Boss Bar module around the vanilla boss bars: false hides them; otherwise moves and scales them, undone in bossBarAfter. */
    public static boolean bossBarBefore(Gfx g) {
        bossPushed = false; if (!AurorasModules.bossBar()) return true; if (AurorasModules.bossHidden()) return false;
        float s = AurorasModules.bossScale(), cx = g.w() / 2f; g.push(); g.translate(cx, AurorasModules.bossOffY()); g.scale(s); g.translate(-cx, 0); bossPushed = true; return true;
    }
    public static void bossBarAfter(Gfx g) { if (bossPushed) { g.pop(); bossPushed = false; } }

    // Repeatable 60-second benchmark: bind "Auroras benchmark" in Controls, stand still in a fixed spot, press it.
    static void startBenchmark(Minecraft mc) {
        if (benchRunning) return;
        BENCH.summary(); benchRunning = true; benchUntilNs = System.nanoTime() + 60_000_000_000L; GC.sample();
        chat(mc, "[Auroras] Benchmark started. Don't move for 60 seconds.");
    }
    static void finishBenchmark() {
        benchRunning = false; long[] gc = GC.sample(); Perf.FrameStats.Summary s = BENCH.summary();
        String line = String.format(Locale.ROOT, "%s,%s,%d,%.1f,%.1f,%.2f,%.2f,%d,%d,%d,%d%n", Instant.now(), mcVersion, s.frames(), s.avgFps(), s.onePercentLowFps(), s.avgFrameMs(), s.p99FrameMs(),
            Perf.usedMemoryBytes() >> 20, Perf.maxMemoryBytes() >> 20, gc[0], gc[1]);
        try {
            Files.createDirectories(DIR); Path f = DIR.resolve("benchmarks.csv");
            if (!Files.exists(f)) Files.writeString(f, "time,minecraft,frames,avg_fps,one_percent_low_fps,avg_frame_ms,p99_frame_ms,used_mb,max_mb,gc_count,gc_ms\n");
            Files.writeString(f, line, StandardOpenOption.APPEND);
        } catch (Exception e) { System.out.println("[Auroras] couldn't write benchmark: " + e.getMessage()); }
        Minecraft mc = Minecraft.getInstance();
        chat(mc, String.format(Locale.ROOT, "[Auroras] Benchmark: avg %.0f fps, 1%% low %.0f fps, frame %.1f ms. Saved to config/auroras/benchmarks.csv", s.avgFps(), s.onePercentLowFps(), s.avgFrameMs()));
    }
    /** A local chat line (only you see it; nothing is sent to the server). */
    static void chat(Minecraft mc, String text) { if (mc.player != null) Mc.chat(mc, Component.literal(text)); }
}
