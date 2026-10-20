package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). The in-world cosmetic modules: Damage Indicator, Cosmetic Aura,
// Nameplate Styling, Model Emblem, Cosmetic Trails and Particle System. The rules (projection, shapes, palettes, emitters,
// damage tracking, layout, emblem placement and art) are core WorldFx and Particles, tested in ModuleTests; this class
// reads the game's state, calls them and applies the result.
//
// How each one reaches the screen, chosen so it works the same on all four targets without touching the world renderer
// (which differs between 1.21.11, 26.1 and 26.2+):
//  - Aura, Trails and Particle System spawn Minecraft's own particles (ParticleEngine#createParticle), tinted and timed
//    by us, so they sit in the world with correct depth. They are created on your client only: LOCAL ONLY, nobody else
//    sees them and nothing is sent to the server. Each module's live count is a core Particles pool (its budget).
//  - Nameplates, damage numbers, health bars and the emblem are drawn in a HUD layer under every vanilla HUD element,
//    at the screen position of their world point (core WorldFx.View with the camera's own vectors and field of view).
//    Fair play: nameplates and damage art are drawn only for entities in your line of sight (LivingEntity#hasLineOfSight,
//    cached a few ticks), never through walls, and nameplates only for players Minecraft itself would show a tag for.
//
// Performance: settings are parsed only when the profile revision changes; a module that is off costs one boolean;
// nothing allocates per frame beyond Minecraft's own particle objects and the few strings of visible plates.

import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Mc;
import gg.auroras.client.ui.WorldArt;
import gg.auroras.core.*;
import net.fabricmc.fabric.api.event.player.AttackEntityCallback;
import net.minecraft.client.Camera;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.SingleQuadParticle;
import net.minecraft.core.particles.ColorParticleOption;
import net.minecraft.core.particles.DustColorTransitionOptions;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.phys.Vec3;
import org.joml.Vector3fc;

public final class AurorasWorld {
    private AurorasWorld() {}
    static int seen = -1; static long ticks; static final long START = System.nanoTime();
    static double now() { return (System.nanoTime() - START) / 1e9; }

    // ---- cached settings (refresh) ----
    static boolean dmgOn, dmgNumbers, dmgBar, dmgMine, dmgHeal, dmgShadow, dmgGradient; static int dmgColor, dmgHealColor, dmgBarColor, dmgBg, dmgDecimals, dmgBarW, dmgMax;
    static String dmgUnits = "hp"; static double dmgScale, dmgDur, dmgRise, dmgBarSecs;
    static boolean auraOn, aura1p, auraMoving; static String auraStyle = "aurora", auraShape = "ring", auraMode = "style"; static int auraColor, auraMax; static double auraIntensity, auraRadius, auraHeight, auraSpeed, auraSize, auraLife;
    static boolean plateOn, plateTeam, plateHealth, platePing, plateItem, plateSelf; static int plateColor, plateMax; static double plateScale;
    static boolean emblemOn, emblemGlow, emblemRim, emblemPulse; static String emblemPos = "back", emblemDesign = "aurora"; static int emblemColor, emblemAccent, emblemOpacity; static double emblemSize, emblemSpin;
    static boolean trailOn, trailPlayer, trailProj, trail1p, trailElytra; static String trailStyle = "sakura", trailMode = "style"; static int trailColor, trailMax; static double trailLife, trailDensity, trailSize, trailSpread;
    static boolean fxOn, fxAmbient, fxEvents, fxAuto, fxReduced, fxTotems, fxReplace, fxProj, fxSteps, fxHits; static String fxStyle = "aurora", fxMode = "style"; static int fxColor, fxMaxDist, fxMax;
    static double fxSize, fxOpacity, fxDensity, fxLife, fxRate, fxSpeed; static Quality quality = Quality.BALANCED;
    static int[] auraPal = WorldFx.palette("aurora"), trailPal = WorldFx.palette("sakura"), fxPal = WorldFx.palette("aurora");
    static final WorldArt.Plate PLATE = new WorldArt.Plate();

    // ---- state ----
    static final Particles AURA = new Particles(512, 11), TRAIL = new Particles(512, 12), FX = new Particles(4096, 13);
    static final Particles.Governor GOV = new Particles.Governor(60);
    static final WorldFx.Strides TRAILS = new WorldFx.Strides(32), STEPS = new WorldFx.Strides(48);
    static final WorldFx.Damage DAMAGE = new WorldFx.Damage(48, 48);
    static final WorldFx.Sight SIGHT = new WorldFx.Sight(96);
    static final WorldFx.View VIEW = new WorldFx.View();
    static final Sky.Rng RNG = new Sky.Rng(0x5EED);
    static final double[] P = new double[3], Q = new double[3], R = new double[3], O = new double[7], M = new double[3];
    static int auraK, fxK, trailK;
    /** Players whose nametag Minecraft wanted to show this frame (filled by AvatarNameMixin, drawn and cleared by draw()). */
    static final Entity[] PLATES = new Entity[64]; static int plates;
    static long lastFrame;

    static void register() {
        AttackEntityCallback.EVENT.register((player, level, hand, entity, hit) -> {
            if (player == Minecraft.getInstance().player) attacked(entity); // the client's own attack (the integrated server's player is another object)
            return InteractionResult.PASS;
        });
    }

    static void refresh() {
        Config.ProfileManager pm = AurorasClient.PM; if (pm.revision() == seen) return; seen = pm.revision();
        dmgOn = pm.enabled("damage"); String show = pm.get("damage.show"); dmgNumbers = !show.equals("bar"); dmgBar = !show.equals("numbers"); dmgMine = b("damage.onlyMine"); dmgHeal = b("damage.showHeal");
        dmgColor = c("damage.color"); dmgHealColor = c("damage.healColor"); dmgUnits = pm.get("damage.units"); dmgDecimals = i("damage.decimals"); dmgScale = d("damage.scale"); dmgDur = d("damage.duration"); dmgRise = d("damage.rise");
        dmgShadow = b("damage.shadow"); dmgBarW = i("damage.barWidth"); dmgGradient = b("damage.barGradient"); dmgBarColor = c("damage.barColor"); dmgBg = i("damage.bgOpacity"); dmgBarSecs = d("damage.barSeconds"); dmgMax = i("damage.maxDistance");
        if (!dmgOn) DAMAGE.clear();
        auraOn = pm.enabled("aura"); auraStyle = pm.get("aura.style"); auraPal = WorldFx.palette(auraStyle); auraColor = c("aura.color"); auraIntensity = d("aura.intensity"); auraMax = i("aura.maxParticles");
        auraShape = pm.get("aura.shape"); auraMode = pm.get("aura.colorMode"); auraRadius = d("aura.radius"); auraHeight = d("aura.height"); auraSpeed = d("aura.speed"); auraSize = d("aura.size"); auraLife = d("aura.lifetime");
        aura1p = b("aura.firstPerson"); auraMoving = b("aura.whileMoving");
        plateOn = pm.enabled("nameplate"); plateColor = c("nameplate.color"); plateScale = d("nameplate.scale"); PLATE.bgPct = i("nameplate.bgOpacity"); PLATE.bg = c("nameplate.bgColor"); PLATE.accent = c("nameplate.accent");
        PLATE.radius = i("nameplate.radius"); PLATE.border = b("nameplate.border"); PLATE.shadow = b("nameplate.shadow"); PLATE.vanillaFont = pm.get("nameplate.font").equals("minecraft"); plateTeam = b("nameplate.teamColors");
        plateHealth = b("nameplate.showHealth"); PLATE.healthStyle = pm.get("nameplate.healthStyle"); platePing = b("nameplate.showPing"); plateItem = b("nameplate.showItem"); plateSelf = b("nameplate.showSelf"); plateMax = i("nameplate.maxDistance");
        emblemOn = pm.enabled("emblem"); emblemPos = pm.get("emblem.position"); emblemDesign = pm.get("emblem.design"); emblemColor = c("emblem.color"); emblemAccent = c("emblem.accent"); emblemSize = d("emblem.size");
        emblemOpacity = i("emblem.opacity"); emblemGlow = b("emblem.glow"); emblemRim = b("emblem.rim"); emblemSpin = d("emblem.spin"); emblemPulse = b("emblem.pulse");
        trailOn = pm.enabled("trails"); trailStyle = pm.get("trails.style"); trailPal = WorldFx.palette(trailStyle); trailColor = c("trails.color"); trailMax = i("trails.maxParticles"); trailLife = d("trails.lifetime");
        String src = pm.get("trails.source"); trailPlayer = !src.equals("projectiles"); trailProj = !src.equals("player"); trailMode = pm.get("trails.colorMode"); trailDensity = d("trails.density"); trailSize = d("trails.size");
        trailSpread = d("trails.spread"); trail1p = b("trails.firstPerson"); trailElytra = b("trails.elytraOnly");
        fxOn = pm.enabled("particlefx"); fxStyle = pm.get("particlefx.style"); fxPal = WorldFx.palette(fxStyle); fxColor = c("particlefx.color"); fxSize = d("particlefx.size"); fxOpacity = d("particlefx.opacity");
        fxDensity = d("particlefx.density"); fxLife = d("particlefx.lifetime"); fxRate = d("particlefx.spawnRate"); fxSpeed = d("particlefx.speed"); fxMaxDist = i("particlefx.maxDistance"); fxMax = i("particlefx.maxCount");
        fxAmbient = b("particlefx.ambient"); fxEvents = b("particlefx.events"); fxAuto = b("particlefx.autoReduce"); fxReduced = b("particlefx.reducedMotion"); fxMode = pm.get("particlefx.colorMode");
        fxTotems = b("particlefx.totems"); fxReplace = b("particlefx.replaceTotem"); fxProj = b("particlefx.projectiles"); fxSteps = b("particlefx.footsteps"); fxHits = b("particlefx.hits");
        Quality q = Quality.parse(pm.get(Config.Registry.QUALITY)); quality = q != null ? q : Quality.BALANCED;
        AURA.enabled = auraOn; TRAIL.enabled = trailOn; FX.enabled = fxOn;
        AURA.setBudget(auraMax, Quality.HIGH, 1); TRAIL.setBudget(trailMax, Quality.HIGH, 1); budgetFx();
        if (!auraOn) AURA.clear(); if (!trailOn) TRAIL.clear(); if (!fxOn) FX.clear();
    }
    static void budgetFx() { FX.setBudget(fxMax, quality, fxAuto ? GOV.factor() : 1); }
    static boolean b(String k) { return AurorasModules.b(k); }
    static int i(String k) { return AurorasModules.i(k); }
    static double d(String k) { return AurorasModules.d(k); }
    static int c(String k) { return Integer.parseInt(AurorasClient.PM.get(k), 16); }

    // =================================================================== tick
    /** END_CLIENT_TICK: health tracking, aura, trails and the particle system. */
    static void tick(Minecraft mc) {
        refresh(); ticks++;
        if (mc.player == null || mc.level == null) { DAMAGE.clear(); SIGHT.clear(); AURA.clear(); TRAIL.clear(); FX.clear(); plates = 0; return; }
        if (!(dmgOn || auraOn || trailOn || fxOn)) return;
        double t = now(); Player me = mc.player; boolean firstPerson = mc.options.getCameraType().isFirstPerson();
        AURA.update(0.05f, 0, 0, 1); TRAIL.update(0.05f, 0, 0, 1); FX.update(0.05f, 0, 0, 1);
        if (fxOn) budgetFx();
        Camera cam = Mc.camera(mc); Vec3 cp = cam.position();

        // ---- one pass over the entities in render range ----
        if (dmgOn || (trailOn && trailProj) || (fxOn && fxEvents && (fxProj || fxSteps))) {
            for (Entity e : mc.level.entitiesForRendering()) {
                double dist = e.position().distanceTo(cp);
                if (dmgOn && !dmgMine && e != me && e instanceof LivingEntity le && dist <= dmgMax && le.isAlive()) DAMAGE.track(e.getId(), le.getHealth(), t, 1.0);
                if (e instanceof Projectile pr && pr.getDeltaMovement().lengthSqr() > 0.004) {
                    if (trailOn && trailProj && pr.getOwner() == me) projectileTrail(mc, pr, false);
                    else if (fxOn && fxEvents && fxProj && dist <= fxMaxDist) projectileTrail(mc, pr, true);
                }
                if (fxOn && fxEvents && fxSteps && e instanceof Player pl && dist <= fxMaxDist && pl.onGround() && !pl.isSpectator() && !pl.isInvisible()) footsteps(mc, pl, t);
            }
            TRAILS.sweep(ticks, 40); STEPS.sweep(ticks, 40);
        }
        // ---- damage indicator: health changes of watched entities ----
        if (dmgOn) {
            for (int k = DAMAGE.watched() - 1; k >= 0; k--) {
                int id = DAMAGE.watchedId(k); Entity e = mc.level.getEntity(id);
                if (!(e instanceof LivingEntity le) || e.isRemoved()) { DAMAGE.forget(id); continue; }
                float delta = DAMAGE.observe(id, le.getHealth(), t);
                if (delta < 0 || (delta > 0 && dmgHeal)) DAMAGE.spawn(id, delta, e.getX(), e.getY() + e.getBbHeight() * 0.9, e.getZ(), t, RNG.next() * 2 - 1);
            }
            DAMAGE.expire(t, dmgBarSecs); DAMAGE.age(t, dmgDur);
        }
        // ---- aura around you ----
        boolean moving = me.getDeltaMovement().horizontalDistanceSqr() > 0.0025;
        if (auraOn && (aura1p || !firstPerson) && (auraMoving || !moving) && !me.isInvisible() && !me.isSpectator()) {
            float life = (float) auraLife; int lifeT = Math.max(2, (int) Math.round(life * 20));
            int n = AURA.due(auraMax * Sky.clamp(auraIntensity, 0, 1) / Math.max(0.1, life), 0.05), pts = Math.max(8, (int) Math.round(12 + auraMax * auraIntensity / 4.0));
            double sc = me.getScale(), size = auraSize * (0.6 + 0.6 * auraIntensity);
            for (int j = 0; j < n; j++) {
                int k = auraK++; double r01 = RNG.next(); double[] o = AO;
                WorldFx.auraPoint(auraShape, k % pts, pts, t + j * 0.05 / Math.max(1, n), auraSpeed, auraRadius * sc, auraHeight * sc, r01, o);
                int rgb = WorldFx.color(auraMode, auraPal, auraColor, t, k), rgb2 = WorldFx.color(auraMode, auraPal, auraColor, t + 3, k + 1);
                double x = me.getX() + o[0], y = me.getY() + o[1], z = me.getZ() + o[2];
                if (AURA.spawn((float) x, (float) y, (float) z, 0, 0, 0, life, (float) size, rgb)) particle(mc, WorldFx.kind(auraStyle, k), rgb, rgb2, size, 0.85, lifeT, x, y, z, o[3], o[4], o[5]);
            }
        }
        // ---- trail behind you ----
        if (trailOn && trailPlayer && (trail1p || !firstPerson) && (!trailElytra || me.isFallFlying()) && !me.isInvisible() && !me.isSpectator()) {
            WorldFx.Stride s = TRAILS.get(me.getId(), ticks); int n = s.step(me.getX(), me.getY(), me.getZ(), 0.32 / Math.max(0.1, trailDensity));
            double lift = me.isFallFlying() ? 0.35 : 0.2;
            for (int j = 0; j < n; j++) trailPoint(mc, s.at(j, n, 0), s.at(j, n, 1) + lift, s.at(j, n, 2), trailSpread, false);
        }
        // ---- ambient motes ----
        if (fxOn && fxAmbient) {
            int n = FX.due(fxRate * fxDensity, 0.05); double r = Math.min(8, fxMaxDist * 0.25);
            for (int j = 0; j < n; j++) {
                double a = RNG.next() * Math.PI * 2, rr = Math.sqrt(RNG.next()) * r, x = me.getX() + Math.cos(a) * rr, y = me.getY() + RNG.next() * 3, z = me.getZ() + Math.sin(a) * rr;
                double v = fxReduced ? 0 : 0.01 * fxSpeed; fx(mc, x, y, z, (RNG.next() - 0.5) * v, v * 0.6, (RNG.next() - 0.5) * v, 1);
            }
        }
    }
    static final double[] AO = new double[6];

    /** One trail particle (Cosmetic Trails, or the Particle System's look when fx is true). */
    static void trailPoint(Minecraft mc, double x, double y, double z, double spread, boolean fx) {
        if (fx) { double v = fxReduced ? 0 : 0.004 * fxSpeed; fx(mc, x, y, z, (RNG.next() - 0.5) * v, 0, (RNG.next() - 0.5) * v, 0.6); return; }
        float life = (float) trailLife; int k = trailK++; double sp = spread;
        x += (RNG.next() - 0.5) * sp; y += (RNG.next() - 0.5) * sp; z += (RNG.next() - 0.5) * sp;
        int rgb = WorldFx.color(trailMode, trailPal, trailColor, now(), k), rgb2 = WorldFx.color(trailMode, trailPal, trailColor, now() + 2, k + 1);
        if (TRAIL.spawn((float) x, (float) y, (float) z, 0, 0, 0, life, (float) trailSize, rgb)) particle(mc, WorldFx.kind(trailStyle, k), rgb, rgb2, trailSize, 0.85, Math.max(2, (int) Math.round(life * 20)), x, y, z, 0, 0.003, 0);
    }
    static void projectileTrail(Minecraft mc, Projectile pr, boolean fx) {
        WorldFx.Stride s = TRAILS.get(pr.getId(), ticks); int n = s.step(pr.getX(), pr.getY(), pr.getZ(), 0.28 / Math.max(0.1, fx ? fxDensity : trailDensity));
        double lift = pr.getBbHeight() / 2;
        for (int j = 0; j < n; j++) trailPoint(mc, s.at(j, n, 0), s.at(j, n, 1) + lift, s.at(j, n, 2), fx ? 0.06 : trailSpread * 0.4, fx);
    }
    static void footsteps(Minecraft mc, Player pl, double t) {
        WorldFx.Stride s = STEPS.get(pl.getId(), ticks); int n = s.step(pl.getX(), pl.getY(), pl.getZ(), 0.72);
        if (n == 0 || pl.isShiftKeyDown()) return;
        double yaw = Math.toRadians(pl.getYRot()), lx = Math.cos(yaw), lz = Math.sin(yaw);
        for (int j = 0; j < n; j++) {
            double side = (s.steps - j) % 2 == 0 ? 0.13 : -0.13, x = s.at(j, n, 0) + lx * side, z = s.at(j, n, 2) + lz * side, y = s.at(j, n, 1) + 0.03;
            int puffs = Math.max(1, (int) Math.round(2 * fxDensity));
            for (int q = 0; q < puffs; q++) { double v = fxReduced ? 0 : 0.012 * fxSpeed; fx(mc, x + (RNG.next() - 0.5) * 0.12, y, z + (RNG.next() - 0.5) * 0.12, (RNG.next() - 0.5) * v, v * 0.8, (RNG.next() - 0.5) * v, 0.5); }
        }
    }
    /** One Particle System particle at a point, within the system's budget; lifeScale shortens it for small events. */
    static boolean fx(Minecraft mc, double x, double y, double z, double vx, double vy, double vz, double lifeScale) {
        float life = (float) (fxLife * lifeScale); int k = fxK++;
        int rgb = WorldFx.color(fxMode, fxPal, fxColor, now(), k), rgb2 = WorldFx.color(fxMode, fxPal, fxColor, now() + 2, k + 1);
        if (!FX.spawn((float) x, (float) y, (float) z, (float) vx, (float) vy, (float) vz, life, (float) fxSize, rgb)) return false;
        particle(mc, WorldFx.kind(fxStyle, k), rgb, rgb2, fxSize, fxOpacity, Math.max(2, (int) Math.round(life * 20)), x, y, z, vx, vy, vz); return true;
    }
    /** A burst of Particle System particles flying out from a point (totem pops, hits). */
    static void burst(Minecraft mc, double x, double y, double z, int count, double power) {
        Camera cam = Mc.camera(mc); if (cam.position().distanceTo(new Vec3(x, y, z)) > fxMaxDist) return;
        double sp = (fxReduced ? 0.25 : 1) * power * fxSpeed;
        for (int j = 0; j < count; j++) {
            double a = RNG.next() * Math.PI * 2, u = RNG.next() * 2 - 1, h = Math.sqrt(1 - u * u), s = sp * (0.6 + 0.4 * RNG.next());
            if (!fx(mc, x, y, z, Math.cos(a) * h * s, u * s * 0.7 + sp * 0.25, Math.sin(a) * h * s, 0.7)) break;
        }
    }

    /**
     * Spawns one of Minecraft's particles for a WorldFx kind, tinted rgb (rgb2 for the colour-shifting dust), size
     * times its normal size, alpha (soft particles only), living lifeTicks, moving (vx, vy, vz) blocks per tick.
     */
    static void particle(Minecraft mc, String kind, int rgb, int rgb2, double size, double alpha, int lifeTicks, double x, double y, double z, double vx, double vy, double vz) {
        ParticleOptions opt; boolean tint = true, scale = true; float sz = (float) Sky.clamp(size, 0.05, 4);
        switch (kind) {
            case "soft": opt = ColorParticleOption.create(ParticleTypes.ENTITY_EFFECT, (int) Math.round(Sky.clamp(alpha, 0.05, 1) * 255) << 24 | rgb); tint = false; break;
            case "dust": opt = new DustParticleOptions(rgb, sz); tint = false; scale = false; break;
            case "transition": opt = new DustColorTransitionOptions(rgb, rgb2, sz); tint = false; scale = false; break;
            case "petal": opt = ParticleTypes.CHERRY_LEAVES; tint = false; break;
            case "enchant": opt = ParticleTypes.ENCHANT; break;
            case "spark": opt = ParticleTypes.ELECTRIC_SPARK; break;
            default: opt = ParticleTypes.END_ROD; break; // glow
        }
        Particle p = mc.particleEngine.createParticle(opt, x, y, z, vx, vy, vz); if (p == null) return; // Particle Settings may drop it
        p.setParticleSpeed(vx, vy, vz); p.setLifetime(lifeTicks); if (scale && sz != 1f) p.scale(sz);
        if (tint && p instanceof SingleQuadParticle q) q.setColor(((rgb >> 16) & 255) / 255f, ((rgb >> 8) & 255) / 255f, (rgb & 255) / 255f);
    }

    // =================================================================== events
    /** You attacked an entity (Fabric's AttackEntityCallback on your client). */
    static void attacked(Entity e) {
        Minecraft mc = Minecraft.getInstance(); if (mc.level == null) return; refresh();
        if (dmgOn && e instanceof LivingEntity le) DAMAGE.track(e.getId(), le.getHealth(), now(), 3.0);
        if (fxOn && fxEvents && fxHits) burst(mc, e.getX(), e.getY() + e.getBbHeight() * 0.6, e.getZ(), Math.max(1, (int) Math.round(10 * fxDensity)), 0.16);
    }
    /** ParticleTotemMixin: a totem popped on an entity in view. Returns true to skip Minecraft's own totem particles. */
    public static boolean totemPop(Entity e) {
        if (!fxOn || !fxEvents || !fxTotems) return false;
        Minecraft mc = Minecraft.getInstance(); if (mc.level == null) return false;
        burst(mc, e.getX(), e.getY() + e.getBbHeight() * 0.55, e.getZ(), Math.max(1, (int) Math.round(48 * fxDensity)), 0.32);
        return fxReplace;
    }
    /** AvatarNameMixin: Minecraft wants to show this player's nametag. Returns true when Nameplate Styling draws it instead. */
    public static boolean takeNameplate(Entity e) {
        if (!plateOn || !(e instanceof Player)) return false;
        for (int k = 0; k < plates; k++) if (PLATES[k] == e) return true;
        if (plates == PLATES.length) return true; // more than 64 tags in one frame: the rest stay hidden this frame
        PLATES[plates++] = e; return true;
    }

    // =================================================================== drawing (HUD layer under the vanilla HUD)
    /** The world overlay layer: nameplates, health bars, damage numbers and the emblem. */
    public static void draw(Gfx g) {
        Minecraft mc = Minecraft.getInstance(); int n = plates; plates = 0;
        long nowNs = System.nanoTime(); double frameMs = lastFrame == 0 ? 16 : (nowNs - lastFrame) / 1e6; lastFrame = nowNs;
        if (fxOn && fxAuto && frameMs < 250) GOV.update(frameMs);
        if (mc.player == null || mc.level == null || Mc.hudHidden(mc) || !(plateOn || dmgOn || emblemOn)) return;
        float pt = mc.getDeltaTracker().getGameTimeDeltaPartialTick(true);
        Camera cam = Mc.camera(mc); Vec3 cp = cam.position(); Vector3fc f = cam.forwardVector(), u = cam.upVector(), l = cam.leftVector();
        float fov = AurorasModules.lastFov(); if (fov <= 1) fov = mc.options.fov().get();
        VIEW.set(cp.x, cp.y, cp.z, f.x(), f.y(), f.z(), u.x(), u.y(), u.z(), l.x(), l.y(), l.z(), fov, g.w(), g.h());
        camRX = -l.x(); camRZ = -l.z();
        int budget = 6; // line-of-sight raycasts per frame at most
        if (emblemOn) emblem(g, mc, pt, cam);
        if (dmgOn) budget = damage(g, mc, pt, budget);
        if (plateOn) {
            if (plateSelf && cam.isDetached() && !mc.player.isInvisible() && n < PLATES.length) PLATES[n++] = mc.player;
            // farthest first, so nearer plates cover farther ones
            for (int a = 1; a < n; a++) { Entity e = PLATES[a]; double da = e.distanceToSqr(cp); int b = a - 1; while (b >= 0 && PLATES[b].distanceToSqr(cp) < da) { PLATES[b + 1] = PLATES[b]; b--; } PLATES[b + 1] = e; }
            for (int k = 0; k < n; k++) { Entity e = PLATES[k]; PLATES[k] = null; if (e instanceof Player p) budget = plate(g, mc, p, pt, budget); }
        }
    }

    /** 1 visible, 0 hidden, using the cache and spending raycast budget when the answer is stale. */
    static int sight(Minecraft mc, Entity e, int[] budget) {
        if (e == mc.player) return 1;
        int v = SIGHT.get(e.getId(), ticks, 3); if (v >= 0) return v;
        if (budget[0] <= 0) { int old = SIGHT.get(e.getId(), ticks, 20); return Math.max(old, 0); }
        budget[0]--; boolean ok = mc.player.hasLineOfSight(e); SIGHT.put(e.getId(), ticks, ok); return ok ? 1 : 0;
    }
    static final int[] BUDGET = new int[1];

    static int plate(Gfx g, Minecraft mc, Player p, float pt, int budget) {
        Vec3 pos = p.getPosition(pt); double dist = VIEW.distance(pos.x, pos.y + p.getBbHeight(), pos.z), fade = WorldFx.distanceFade(dist, plateMax);
        if (fade <= 0) return budget;
        BUDGET[0] = budget; if (sight(mc, p, BUDGET) == 0) return BUDGET[0];
        if (!VIEW.project(pos.x, pos.y + p.getBbHeight() + 0.5, pos.z, P) || !VIEW.onScreen(P, 40)) return BUDGET[0];
        double k = WorldFx.plateScale(VIEW.perBlock(P[2]), plateScale);
        String name = p.getDisplayName().getString(); int rgb = plateColor;
        if (plateTeam) { int tc = p.getTeamColor() & 0xFFFFFF; if (tc != 0xFFFFFF) rgb = tc; }
        double hp = -1; String hpText = "";
        if (plateHealth) { float max = p.getMaxHealth(); hp = max > 0 ? Sky.clamp(p.getHealth() / max, 0, 1) : 0; hpText = WorldFx.formatAmount(p.getHealth() + p.getAbsorptionAmount(), "hp", 1).replace("+", ""); }
        String ping = ""; int pingRgb = 0;
        if (platePing && mc.getConnection() != null) { PlayerInfo info = mc.getConnection().getPlayerInfo(p.getUUID()); if (info != null) { ping = info.getLatency() + " ms"; pingRgb = WorldFx.pingColor(info.getLatency()); } }
        ItemStack held = plateItem ? p.getMainHandItem() : ItemStack.EMPTY; boolean item = !held.isEmpty();
        WorldArt.nameplate(g, PLATE, P[0], P[1], k, name, rgb, hp, hpText, ping, pingRgb, item, fade * (p.isDiscrete() ? 0.55 : 1));
        if (item && WorldArt.ITEM[2] > 0) { double s = WorldArt.ITEM[2] / 16.0; g.push(); g.translate((float) WorldArt.ITEM[0], (float) WorldArt.ITEM[1]); g.scale((float) s); g.item(held, 0, 0); g.pop(); }
        return BUDGET[0];
    }

    static int damage(Gfx g, Minecraft mc, float pt, int budget) {
        double t = now(); BUDGET[0] = budget;
        if (dmgBar) for (int k = 0; k < DAMAGE.watched(); k++) {
            int id = DAMAGE.watchedId(k); double since = t - DAMAGE.lastHit(id); if (since > dmgBarSecs) continue;
            Entity e = mc.level.getEntity(id); if (!(e instanceof LivingEntity le) || e == mc.player || sight(mc, e, BUDGET) == 0) continue;
            Vec3 pos = e.getPosition(pt); double lift = e instanceof Player && plateOn ? 0.95 : 0.45;
            if (!VIEW.project(pos.x, pos.y + e.getBbHeight() + lift, pos.z, P) || !VIEW.onScreen(P, 40)) continue;
            double kk = WorldFx.plateScale(VIEW.perBlock(P[2]), dmgScale), fade = Math.min(1, (dmgBarSecs - since) / 0.5) * WorldFx.distanceFade(P[2], dmgMax + 8);
            float max = le.getMaxHealth(); double frac = max > 0 ? le.getHealth() / max : 0, ab = max > 0 ? le.getAbsorptionAmount() / max : 0;
            String label = le.isDeadOrDying() ? "0" : WorldFx.formatAmount(le.getHealth(), dmgUnits, dmgDecimals).replace("+", "") + " / " + WorldFx.formatAmount(max, dmgUnits, dmgUnits.equals("hearts") ? 1 : 0).replace("+", "");
            WorldArt.healthCard(g, P[0], P[1], kk, dmgBarW, frac, ab, label, dmgGradient, dmgBarColor, dmgBg, fade);
        }
        if (dmgNumbers) for (int k = 0; k < DAMAGE.nums; k++) {
            int id = DAMAGE.numId[k]; Entity e = mc.level.getEntity(id);
            if (e != null && sight(mc, e, BUDGET) == 0) continue;
            WorldFx.numberMotion(t - DAMAGE.numBorn[k], dmgDur, dmgRise, M);
            double j = DAMAGE.numJitter[k] * 0.35;
            if (!VIEW.project(DAMAGE.numX[k] + j * camRX, DAMAGE.numY[k] + 0.25 + M[0], DAMAGE.numZ[k] + j * camRZ, P) || !VIEW.onScreen(P, 20)) continue;
            double size = 9 * WorldFx.plateScale(VIEW.perBlock(P[2]), dmgScale) * M[2]; double amt = DAMAGE.numAmount[k];
            int rgb = amt > 0 ? dmgHealColor : Math.abs(amt) >= 6 ? Sky.mix(dmgColor, 0xFFD166, 0.45) : dmgColor; // big hits warm up toward gold
            WorldArt.number(g, WorldFx.formatAmount(amt, dmgUnits, dmgDecimals), P[0], P[1], size, rgb, M[1], dmgShadow);
        }
        return BUDGET[0];
    }
    /** The screen-right direction in the world this frame, so numbers fan out sideways as seen from the camera. */
    static double camRX, camRZ;

    static void emblem(Gfx g, Minecraft mc, float pt, Camera cam) {
        Player me = mc.player; if (!cam.isDetached() || me.isInvisible() || me.isSpectator() || me.isSleeping() || me.isFallFlying() || me.isSwimming()) return; // lying poses would misplace the decal
        Vec3 pos = me.getPosition(pt); double yaw = WorldFx.rotLerp(pt, me.yBodyRotO, me.yBodyRot);
        WorldFx.emblemAnchor(emblemPos, yaw, me.isCrouching(), me.getScale(), O);
        double x = pos.x + O[0], y = pos.y + O[1], z = pos.z + O[2];
        x += O[3] * 0.012; z += O[4] * 0.012; // a hair off the surface
        if (!VIEW.faces(x, y, z, O[3], O[4])) return; // on the far side of the body
        double t = now(), half = 0.11 * emblemSize * me.getScale() * (emblemPulse ? 1 + 0.07 * Math.sin(t * 3.2) : 1);
        double ang = emblemSpin * t * 1.2, ca = Math.cos(ang), sa = Math.sin(ang);
        // in-plane axes: right (horizontal along the surface) and up, turned by the spin
        double rx = O[5] * ca, ry = sa, rz = O[6] * ca, ux = -O[5] * sa, uy = ca, uz = -O[6] * sa;
        if (!VIEW.project(x, y, z, P) || !VIEW.project(x + rx * half, y + ry * half, z + rz * half, Q) || !VIEW.project(x + ux * half, y + uy * half, z + uz * half, R)) return;
        double a = emblemOpacity / 100.0 * Math.min(1, Math.abs((VIEW.distance(x, y, z) - 0.3) / 0.6));
        WorldArt.emblem(g, emblemDesign, emblemColor, emblemAccent, emblemRim, emblemGlow, P[0], P[1], Q[0] - P[0], Q[1] - P[1], P[0] - R[0], P[1] - R[1], a);
    }
}
