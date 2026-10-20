package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). Totem Spirit: when a player's totem pops (the server's entity event 35,
// noticed in mixin/ClientPacketListenerMixin), a glowing spirit of coloured motes rises from them for a moment. The shape
// and timing are core PlayerFx (Spirit, spiritMote, spiritColor; unit-tested). The motes are ordinary world particles,
// spawned on your client only: blocks and walls hide them exactly like any other particle, nothing is drawn through
// walls, and only players your client already sees (within the distance you set) get a spirit.

import gg.auroras.core.Config;
import gg.auroras.core.PlayerFx;
import net.minecraft.client.Minecraft;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;

import java.util.ArrayList;
import java.util.List;

public final class AurorasSpirit {
    private AurorasSpirit() {}
    static int seen = -1;
    static boolean on, chroma, self, others, sparkles;
    static String shape = "spiral";
    static double density = 1, duration = 1.6, height = 2.5, speed = 1, size = 1; static int color = 0xFFE27A, color2 = 0x6FE3FF, maxDist = 48;
    static final List<PlayerFx.Spirit> LIVE = new ArrayList<>();
    static final double[] M = new double[4];
    static long seed = 0x5EED;

    static void refresh() {
        Config.ProfileManager pm = AurorasClient.PM; if (pm.revision() == seen) return; seen = pm.revision();
        on = pm.enabled("totemspirit"); shape = pm.get("totemspirit.shape"); color = hex("totemspirit.color"); color2 = hex("totemspirit.color2"); chroma = b("totemspirit.chroma");
        density = d("totemspirit.density"); duration = d("totemspirit.duration"); height = d("totemspirit.riseHeight"); speed = d("totemspirit.speed"); size = d("totemspirit.size");
        self = b("totemspirit.self"); others = b("totemspirit.others"); sparkles = b("totemspirit.sparkles"); maxDist = Integer.parseInt(pm.get("totemspirit.maxDistance"));
        if (!on) LIVE.clear();
    }
    static boolean b(String k) { return "true".equals(AurorasClient.PM.get(k)); }
    static double d(String k) { return Double.parseDouble(AurorasClient.PM.get(k)); }
    static int hex(String k) { return Integer.parseInt(AurorasClient.PM.get(k), 16); }

    /** ClientPacketListenerMixin: an entity's totem popped (render thread). */
    public static void popped(Entity e) {
        if (!on || !(e instanceof Player)) return; Minecraft mc = Minecraft.getInstance();
        boolean mine = e == mc.player; if (mine ? !self : !others) return;
        if (!mine && mc.player != null && e.distanceToSqr(mc.player) > (double) maxDist * maxDist) return;
        if (LIVE.size() >= 16) LIVE.remove(0); // a burst of pops (a fight) keeps the newest few
        LIVE.add(new PlayerFx.Spirit(e.getId(), duration)); seed = seed * 6364136223846793005L + 1442695040888963407L;
    }

    /** END_CLIENT_TICK: spawns this tick's motes for every live spirit, following its player. */
    static void tick(Minecraft mc) {
        refresh(); if (LIVE.isEmpty()) return;
        if (mc.level == null || mc.isPaused()) { if (mc.level == null) LIVE.clear(); return; }
        double t = System.nanoTime() / 1e9;
        for (int s = LIVE.size() - 1; s >= 0; s--) {
            PlayerFx.Spirit sp = LIVE.get(s); Entity e = mc.level.getEntity(sp.entityId);
            if (e == null || sp.done() || (mc.player != null && e != mc.player && e.distanceToSqr(mc.player) > (double) maxDist * maxDist)) { LIVE.remove(s); continue; }
            int n = sp.count(density, 0.05);
            for (int k = 0; k < n; k++) {
                PlayerFx.spiritMote(shape, sp.age, sp.duration, k, n, height, speed, seed + (long) (sp.age * 20) * 31 + sp.entityId, M);
                int rgb = PlayerFx.spiritColor(color, color2, chroma, M[1], height, t, k);
                float scale = (float) (size * (0.7 + 0.5 * (1 - sp.age / sp.duration)));
                mc.level.addParticle(new DustParticleOptions(rgb, Math.max(0.2f, Math.min(4f, scale))), e.getX() + M[0], e.getY() + M[1], e.getZ() + M[2], 0, M[3], 0);
            }
            if (sparkles && n > 0 && (int) (sp.age * 20) % 3 == 0) // a few bright sparks near the top of the column
                mc.level.addParticle(ParticleTypes.END_ROD, e.getX() + (M[0] * 0.5), e.getY() + height * (0.4 + 0.6 * (sp.age / sp.duration)), e.getZ() + (M[2] * 0.5), 0, 0.02 * speed, 0);
            sp.age += 0.05;
        }
    }
}
