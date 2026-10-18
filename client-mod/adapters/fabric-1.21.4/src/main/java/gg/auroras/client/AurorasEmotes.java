package gg.auroras.client;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Emote playback for your own player. Built-in emotes are bundled from
// visuals/emotes.json; custom emotes and the wheel come from config/auroras/emotes/ (written by the launcher's creator).
// Playback, blending and cancelling are core Emotes.Controller, the same code the launcher preview runs.
// LOCAL ONLY: nothing is sent to the server, so other players keep seeing the normal animation.

import gg.auroras.core.*;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.Perspective;
import net.minecraft.text.Text;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

public final class AurorasEmotes {
    private AurorasEmotes() {}
    static final Map<String, Emotes.Emote> BY_ID = new LinkedHashMap<>();
    static String[] wheel = new String[Emotes.SLOTS];
    static final Emotes.Controller CTRL = new Emotes.Controller();
    static final double[] POSE = new double[Emotes.N * Emotes.F], WEIGHT = new double[Emotes.N];
    static final long START = System.nanoTime();
    static int seen = -1; static boolean cancelOnMove = true, thirdPerson = true; static Perspective restore;

    static double now() { return (System.nanoTime() - START) / 1e9; }

    /** Reads the built-in library, custom emotes and the wheel. Bad custom files are skipped and logged. */
    static void load() {
        BY_ID.clear();
        try (InputStream in = AurorasEmotes.class.getResourceAsStream("/assets/auroras_client/emotes.json")) {
            for (Emotes.Emote e : Emotes.parseLibrary(new String(in.readAllBytes(), StandardCharsets.UTF_8))) BY_ID.put(e.id(), e);
        } catch (Exception e) { System.out.println("[Auroras] built-in emotes couldn't be loaded: " + e.getMessage()); }
        Path dir = AurorasClient.DIR.resolve("emotes"); List<String> errors = new ArrayList<>();
        for (Emotes.Emote e : Emotes.loadCustom(dir, errors)) { if (BY_ID.containsKey(e.id())) errors.add(e.id() + ": uses the id of a built-in emote"); else BY_ID.put(e.id(), e); }
        errors.forEach(err -> System.out.println("[Auroras] skipped custom emote " + err));
        try { Path w = dir.resolve("wheel.txt"); wheel = Emotes.parseWheel(Files.exists(w) ? Files.readString(w) : null, BY_ID.keySet()); } catch (Exception e) { wheel = new String[Emotes.SLOTS]; }
        if (Arrays.stream(wheel).allMatch(Objects::isNull)) { String[] def = {"wave", "clap", "cheer", "groove", "bow", "shrug", "point", "sit"}; for (int k = 0; k < def.length; k++) if (BY_ID.containsKey(def[k])) wheel[k] = def[k]; }
    }
    static void refresh() {
        Config.ProfileManager pm = AurorasClient.PM; if (pm.revision() == seen) return; seen = pm.revision();
        CTRL.setSpeed(Double.parseDouble(pm.get("emotes.speed"))); CTRL.setBlend(Double.parseDouble(pm.get("emotes.blend")));
        cancelOnMove = "true".equals(pm.get("emotes.cancelOnMove")); thirdPerson = "true".equals(pm.get("emotes.thirdPerson"));
    }
    static boolean playing() { return CTRL.playing(); }

    static void play(String id, MinecraftClient c) {
        Emotes.Emote e = id == null ? null : BY_ID.get(id); if (e == null || c.player == null) return; refresh();
        CTRL.play(e, now());
        if (thirdPerson && c.options.getPerspective() == Perspective.FIRST_PERSON) { restore = Perspective.FIRST_PERSON; c.options.setPerspective(Perspective.THIRD_PERSON_BACK); }
        c.player.sendMessage(Text.literal("[Auroras] " + e.name() + " (only you can see this)"), true);
    }
    static void cancelAll(String reason) { CTRL.cancel(now(), reason); }

    /** Once per client tick: end finished one-shots, cancel on movement, and give back first person afterwards. */
    static void tick(MinecraftClient c) {
        refresh(); double t = now(); CTRL.update(t);
        if (CTRL.playing() && (c.player == null || !AurorasClient.PM.enabled("emotes"))) CTRL.cancel(t, "off");
        if (CTRL.playing() && cancelOnMove && c.player != null) {
            boolean moving = c.player.input != null && (c.player.input.movementForward != 0 || c.player.input.movementSideways != 0 || c.player.input.playerInput.jump() || c.player.input.playerInput.sneak());
            if (moving || c.player.isSwimming() || c.player.isFallFlying() || c.player.hasVehicle()) CTRL.cancel(t, "moved");
        }
        if (!CTRL.active(t) && restore != null) { if (c.options.getPerspective() == Perspective.THIRD_PERSON_BACK) c.options.setPerspective(restore); restore = null; }
    }

    /** Called from the player model mixin for each player drawn. Only your own player is posed. Returns false to leave the model alone. */
    static boolean sample(int entityId) {
        MinecraftClient c = MinecraftClient.getInstance(); if (c.player == null || entityId != c.player.getId()) return false;
        double t = now(); if (!CTRL.active(t)) return false; CTRL.sample(t, POSE, WEIGHT); return true;
    }
}
