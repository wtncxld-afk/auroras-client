package gg.auroras.client;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Written against Fabric API and Yarn mappings for Minecraft 1.21.4 without access to
// those jars, so expect small API fixes on the first build. Only this folder knows Minecraft classes; all logic is in ../../core.
//
// Performance rules followed here (see core Perf):
//  - settings are parsed only when the profile revision changes, never per frame
//  - HUD strings are rebuilt only when the numbers behind them change
//  - no collections or boxed values are created while rendering
//  - memory and GC are sampled once a second, not every frame
//  - disabled modules do no work beyond one boolean check

import gg.auroras.core.*;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.LocalTime;
import java.util.Locale;

public class AurorasClient implements ClientModInitializer {
    public static final Config.Registry REG = new Config.Registry();
    public static final Config.ProfileManager PM = new Config.ProfileManager(REG);
    static final Path DIR = FabricLoader.getInstance().getConfigDir().resolve("auroras");
    static String mcVersion = "?";
    static boolean active;
    static KeyBinding guiKey, benchKey;

    static final Calc.FpsSmoother FPS_SMOOTH = new Calc.FpsSmoother(500);
    static final Perf.FrameStats BENCH = new Perf.FrameStats(60 * 240);
    static final Perf.GcSampler GC = new Perf.GcSampler();
    static long lastFrameNs, benchUntilNs;
    static boolean benchRunning;
    static KeyBinding hudEditKey, emoteKey;

    @Override public void onInitializeClient() {
        mcVersion = FabricLoader.getInstance().getModContainer("minecraft").map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("?");
        // Version guard: if this build isn't the adapter for the running game, register nothing at all.
        if (Adapters.select(mcVersion).filter(a -> a.id().equals("y1_21_4")).isEmpty()) {
            System.out.println("[Auroras] " + Adapters.describe(mcVersion)); return;
        }
        active = true;
        try { int skipped = PM.load(DIR); if (skipped > 0 || PM.skippedLines > 0) System.out.println("[Auroras] skipped " + skipped + " invalid profile file(s) and " + PM.skippedLines + " invalid setting(s)"); } catch (Exception e) { System.out.println("[Auroras] using default settings: " + e.getMessage()); }
        guiKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.auroras.gui", InputUtil.Type.KEYSYM, Integer.parseInt(PM.get(Config.Registry.GUI_KEY)), "category.auroras"));
        hudEditKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.auroras.hudeditor", InputUtil.Type.KEYSYM, InputUtil.UNKNOWN_KEY.getCode(), "category.auroras"));
        emoteKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.auroras.emotes", InputUtil.Type.KEYSYM, Integer.parseInt(PM.get("emotes.wheelKey")), "category.auroras"));
        benchKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.auroras.benchmark", InputUtil.Type.KEYSYM, InputUtil.UNKNOWN_KEY.getCode(), "category.auroras"));
        AurorasModules.register(); AurorasModules.initCape(DIR);
        ClientTickEvents.END_CLIENT_TICK.register(c -> {
            while (guiKey.wasPressed()) c.setScreen(new ModuleScreen());
            while (hudEditKey.wasPressed()) c.setScreen(new HudEditorScreen(null));
            // the wheel key opens the wheel; pressed again while an emote plays, it stops the emote
            while (emoteKey.wasPressed()) if (PM.enabled("emotes") && c.currentScreen == null) { if (AurorasEmotes.playing()) AurorasEmotes.cancelAll("cancelled"); else c.setScreen(new EmoteWheelScreen()); }
            while (benchKey.wasPressed()) startBenchmark(c);
            AurorasEmotes.tick(c);
            AurorasModules.tick(c);
        });
        // Per-server and per-world profiles: use the assigned profile while connected, then switch back.
        ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> client.execute(() -> {
            String server = client.getCurrentServerEntry() != null ? client.getCurrentServerEntry().address : null;
            String world = client.getServer() != null ? client.getServer().getSaveProperties().getLevelName() : null;
            PM.enterPlace(Config.ProfileManager.placeKey(server, world)); HudRenderer.sessionStart = System.currentTimeMillis(); AurorasModules.SESSION.start(HudRenderer.sessionStart);
        }));
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> client.execute(() -> { PM.leavePlace(); AurorasEmotes.cancelAll("disconnected"); }));
        HudRenderCallback.EVENT.register(AurorasClient::render);
        HudRenderer.init(FabricLoader.getInstance().getGameDir());
        AurorasSky.register();
        AurorasEmotes.load();
    }
    static void save() { try { PM.save(DIR); } catch (Exception e) { System.out.println("[Auroras] couldn't save settings: " + e.getMessage()); } }

    static void render(DrawContext ctx, RenderTickCounter tick) {
        long now = System.nanoTime(); double dt = lastFrameNs == 0 ? 0 : (now - lastFrameNs) / 1e9;
        if (lastFrameNs != 0) { FPS_SMOOTH.frame(now); if (benchRunning) { BENCH.record(now - lastFrameNs); if (now - benchUntilNs >= 0) finishBenchmark(); } }
        lastFrameNs = now; if (dt > 0) HudRenderer.FRAMES.add(dt * 1000);
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player != null) AurorasModules.drawTotemOverlay(ctx);
        if (mc.player == null || mc.options.hudHidden || mc.currentScreen instanceof HudEditorScreen) return;
        HudRenderer.render(ctx, mc, dt, false, null);
    }

    // Repeatable 60-second benchmark: bind "Auroras benchmark" in Controls, stand still in a fixed spot, press it.
    static void startBenchmark(MinecraftClient mc) {
        if (benchRunning) return;
        BENCH.summary(); benchRunning = true; benchUntilNs = System.nanoTime() + 60_000_000_000L; GC.sample();
        if (mc.player != null) mc.player.sendMessage(Text.literal("[Auroras] Benchmark started. Don't move for 60 seconds."), false);
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
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player != null) mc.player.sendMessage(Text.literal(String.format(Locale.ROOT, "[Auroras] Benchmark: avg %.0f fps, 1%% low %.0f fps, frame %.1f ms. Saved to config/auroras/benchmarks.csv", s.avgFps(), s.onePercentLowFps(), s.avgFrameMs())), false);
    }
}
