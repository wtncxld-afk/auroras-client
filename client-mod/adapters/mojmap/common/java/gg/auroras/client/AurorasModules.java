package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Player, rendering and cosmetic modules: the game-side half.
// All rules (toggles, freelook camera, zoom, crosshair shapes, particle filter, totem schedule...) live in core GameLogic
// and Calc and are unit-tested there; this class only reads the game's state, calls them, and applies the result. The
// mixins in ./mixin call the static hooks below. Written against Mojang's names without the game jars; expect small fixes.
//
// Performance: settings are parsed only when the profile revision changes; every hook starts with a boolean check, so a
// disabled module costs one field read; nothing allocates per frame except particles the player asked for.

import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Platform;
import gg.auroras.core.*;
import net.fabricmc.fabric.api.event.client.player.ClientPlayerBlockBreakEvents;
import net.minecraft.client.CameraType;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.core.particles.DustParticleOptions;

import java.util.List;

public final class AurorasModules {
    private AurorasModules() {}
    static KeyMapping zoomKey, sprintKey, sneakKey, freelookKey, frontKey;
    static int seen = -1;

    // cached settings (refresh())
    static boolean zoomOn, zoomScaleSens, zoomScroll, sprintOn, sprintStatus, sneakOn, sneakStatus, freelookOn, perspOn, skipFront,
        crossOn, crossOutline, crossDot, crossDynamic, crossHide3p, fireOn, partOn, fullbrightOn, bossOn, bossHide, glowOn, totemOn, totemParticles, menuOn;
    static String freelookMode = "hold", crossStyle = "cross";
    static double freelookSens = 1, fireOffset, fullbrightGamma = 1, bossScale = 1, menuSpeed = 1;
    static int crossSize, crossThick, crossGap, crossColor, fireAlpha, bossOffY, glowColor, totemColor;

    static Calc.Zoom zoom = new Calc.Zoom(4, 0.25);
    static final Calc.SprintToggle SPRINT = new Calc.SprintToggle();
    static final GameLogic.Toggle SNEAK = new GameLogic.Toggle();
    static final GameLogic.Freelook FREELOOK = new GameLogic.Freelook();
    static final GameLogic.ParticleFilter PARTICLES = new GameLogic.ParticleFilter();
    static final GameLogic.TotemFx TOTEM = new GameLogic.TotemFx();
    static final GameLogic.Session SESSION = new GameLogic.Session();
    static CameraType beforeFreelook, lastPerspective = CameraType.FIRST_PERSON;
    static boolean sprintApplied, sneakApplied, frontByKey;

    static void register() {
        Config.ProfileManager pm = AurorasClient.PM;
        zoomKey = key("key.auroras.zoom", pm.get("zoom.key")); sprintKey = key("key.auroras.sprint", pm.get("sprint.key")); sneakKey = key("key.auroras.sneak", pm.get("sneak.key"));
        freelookKey = key("key.auroras.freelook", pm.get("freelook.key")); frontKey = key("key.auroras.frontview", pm.get("perspective.frontKey"));
        SESSION.start(System.currentTimeMillis());
        ClientPlayerBlockBreakEvents.AFTER.register((level, player, pos, state) -> SESSION.blockBroken());
    }
    static KeyMapping key(String name, String code) { return Platform.key(name, Integer.parseInt(code)); }

    static void refresh() {
        Config.ProfileManager pm = AurorasClient.PM; if (pm.revision() == seen) return; seen = pm.revision();
        zoomOn = pm.enabled("zoom"); zoom = new Calc.Zoom(d("zoom.factor"), d("zoom.smoothing")); zoomScaleSens = b("zoom.scaleSensitivity"); zoomScroll = b("zoom.scrollAdjust");
        sprintOn = pm.enabled("sprint"); sprintStatus = b("sprint.showStatus"); sneakOn = pm.enabled("sneak"); sneakStatus = b("sneak.showStatus");
        freelookOn = pm.enabled("freelook"); freelookMode = pm.get("freelook.mode"); freelookSens = d("freelook.sensitivity");
        perspOn = pm.enabled("perspective"); skipFront = b("perspective.skipFront");
        crossOn = pm.enabled("crosshair"); crossStyle = pm.get("crosshair.style"); crossSize = i("crosshair.size"); crossThick = i("crosshair.thickness"); crossGap = i("crosshair.gap");
        crossColor = HudKit.argb(Integer.parseInt(pm.get("crosshair.color"), 16), i("crosshair.opacity"), 1); crossOutline = b("crosshair.outline"); crossDot = b("crosshair.dot"); crossDynamic = b("crosshair.dynamic"); crossHide3p = b("crosshair.hideInThirdPerson");
        fireOn = pm.enabled("lowfire"); fireOffset = GameLogic.fireOffset(d("lowfire.height")); fireAlpha = i("lowfire.opacity");
        partOn = pm.enabled("particles"); PARTICLES.multiplier = d("particles.multiplier"); PARTICLES.hidden.clear(); PARTICLES.hidden.addAll(GameLogic.ParticleFilter.hiddenTypes(b("particles.hideExplosions"), b("particles.hideBlockBreak"), b("particles.hideRain")));
        fullbrightOn = pm.enabled("fullbright"); fullbrightGamma = GameLogic.fullbrightGamma(d("fullbright.level"));
        bossOn = pm.enabled("bossbar"); double[] bb = GameLogic.bossBar(b("bossbar.hide"), d("bossbar.scale"), i("bossbar.offY")); bossHide = bb == null; if (bb != null) { bossScale = bb[0]; bossOffY = (int) bb[1]; }
        glowOn = pm.enabled("glow"); glowColor = Integer.parseInt(pm.get("glow.color"), 16);
        totemOn = pm.enabled("totemfx"); totemParticles = b("totemfx.particles"); totemColor = Integer.parseInt(pm.get("totemfx.particleColor"), 16);
        TOTEM.density = d("totemfx.density"); TOTEM.duration = d("totemfx.duration"); TOTEM.overlay = b("totemfx.overlay"); TOTEM.overlayIntensity = d("totemfx.overlayIntensity"); TOTEM.overlayDuration = d("totemfx.overlayDuration");
        menuOn = pm.enabled("menuanim"); menuSpeed = d("menuanim.speed");
    }
    static boolean b(String k) { return "true".equals(AurorasClient.PM.get(k)); }
    static int i(String k) { return Integer.parseInt(AurorasClient.PM.get(k)); }
    static double d(String k) { return Double.parseDouble(AurorasClient.PM.get(k)); }

    /** Menu easing time constant, scaled by Menu Animations' speed when that module is on. */
    public static double tau(double base) { return menuOn ? GameLogic.animTau(base, menuSpeed, false) : base; }

    /** END_CLIENT_TICK: keys, toggles, freelook and perspective, session counters, totem particles. */
    static void tick(Minecraft mc) {
        refresh();
        if (mc.player == null) { FREELOOK.active = false; return; }
        // zoom eases toward 1/factor while the key is held (20 ticks a second, like vanilla FOV changes)
        zoom.tick(zoomOn && zoomKey.isDown() && mc.screen == null);
        // toggle sprint: hold Minecraft's own sprint key for the player, so the game's rules (hunger, sneaking, blindness) still decide
        boolean forward = mc.player.input != null && mc.player.input.keyPresses.forward();
        boolean sprint = sprintOn && SPRINT.update(sprintKey.isDown(), forward, mc.player.isShiftKeyDown(), mc.player.getFoodData().getFoodLevel() > 6 || mc.player.getAbilities().mayfly);
        if (sprint) { mc.options.keySprint.setDown(true); sprintApplied = true; } else if (sprintApplied) { mc.options.keySprint.setDown(false); sprintApplied = false; }
        while (sneakKey.consumeClick()) { } // the toggle reads the key's edge itself; drain the press counter so it can't pile up
        boolean sneak = sneakOn && SNEAK.update(sneakKey.isDown()) && mc.screen == null;
        if (sneak) { mc.options.keyShift.setDown(true); sneakApplied = true; } else if (sneakApplied) { mc.options.keyShift.setDown(false); sneakApplied = false; }
        // freelook: a separate camera rotation (CameraMixin) while the player keeps facing forward; shown from behind
        boolean was = FREELOOK.active, now = freelookOn && mc.screen == null && FREELOOK.key(freelookKey.isDown(), freelookMode, mc.player.getYRot(), mc.player.getXRot());
        if (!freelookOn || mc.screen != null) FREELOOK.active = false;
        if (now && !was) { beforeFreelook = mc.options.getCameraType(); if (beforeFreelook.isFirstPerson()) mc.options.setCameraType(CameraType.THIRD_PERSON_BACK); }
        if (!FREELOOK.active && was && beforeFreelook != null) { mc.options.setCameraType(beforeFreelook); beforeFreelook = null; }
        // perspective: a key for the front view, and optionally skipping the front view when cycling with F5
        if (perspOn) {
            while (frontKey.consumeClick()) { boolean front = mc.options.getCameraType() == CameraType.THIRD_PERSON_FRONT; mc.options.setCameraType(front ? CameraType.FIRST_PERSON : CameraType.THIRD_PERSON_FRONT); frontByKey = !front; }
            CameraType p = mc.options.getCameraType();
            if (skipFront && !frontByKey && p == CameraType.THIRD_PERSON_FRONT && lastPerspective == CameraType.THIRD_PERSON_BACK) mc.options.setCameraType(CameraType.values()[GameLogic.nextPerspective(1, true)]);
            if (mc.options.getCameraType() != CameraType.THIRD_PERSON_FRONT) frontByKey = false;
        }
        lastPerspective = mc.options.getCameraType();
        // session statistics
        SESSION.move(mc.player.getX(), mc.player.getY(), mc.player.getZ()); SESSION.health(mc.player.getHealth());
        // totem particles in the chosen color, around the player, on the schedule from GameLogic.TotemFx
        int n = totemOn ? TOTEM.update(0.05) : 0;
        if (n > 0 && totemParticles && mc.level != null) {
            DustParticleOptions dust = new DustParticleOptions(totemColor, 1.0f); var r = mc.player.getRandom();
            for (int k = 0; k < n; k++) mc.level.addParticle(dust, mc.player.getX() + (r.nextDouble() - 0.5) * 1.2, mc.player.getY() + r.nextDouble() * 2, mc.player.getZ() + (r.nextDouble() - 0.5) * 1.2, 0, 0.05, 0);
        }
    }

    /** Frame-rate easing for zoom, from GameRenderer#getFov. */
    public static float fov(float fov) { return zoom.active() ? (float) (fov * zoom.fovMultiplier()) : fov; }
    /** Mouse look (MouseMixin): freelook turns the camera instead of the player; zoom slows the mouse. Returns true when handled. */
    public static boolean look(double dx, double dy, double[] out) {
        if (FREELOOK.active) { FREELOOK.look(dx, dy, freelookSens); return true; }
        double s = zoom.active() && zoomScaleSens ? zoom.sensitivityScale() : 1; out[0] = dx * s; out[1] = dy * s; return false;
    }
    /** Scroll while zooming changes the zoom instead of the hotbar slot. */
    public static boolean scroll(double v) { if (!zoom.active() || !zoomScroll || v == 0) return false; zoom.setFactor(GameLogic.zoomScroll(zoom.factor(), Math.signum(v))); return true; }
    public static boolean freelook() { return FREELOOK.active; }
    public static float freelookYaw() { return FREELOOK.yaw; }
    public static float freelookPitch() { return FREELOOK.pitch; }

    // ---- rendering hooks ----
    /** InGameHudMixin: returns true when the Auroras crosshair replaced (or hid) Minecraft's. */
    public static boolean crosshair(Gfx ctx, Minecraft mc) {
        if (!crossOn || mc.player == null || mc.player.isSpectator()) return false;
        if (!mc.options.getCameraType().isFirstPerson() && crossHide3p) return true;
        double spread = crossDynamic ? Sky.clamp(mc.player.getDeltaMovement().horizontalDistance() / 0.28, 0, 1) : 0;
        List<int[]> pieces = GameLogic.crosshair(crossStyle, crossSize, crossThick, crossGap, crossDot, spread);
        int cx = ctx.w() / 2, cy = ctx.h() / 2;
        if (crossOutline) for (int[] p : GameLogic.outline(pieces)) ctx.fill(cx + p[0], cy + p[1], cx + p[0] + p[2], cy + p[1] + p[3], (crossColor >>> 24) * 2 / 3 << 24);
        for (int[] p : pieces) ctx.fill(cx + p[0], cy + p[1], cx + p[0] + p[2], cy + p[1] + p[3], crossColor);
        return true;
    }
    public static boolean particles() { return partOn; }
    public static boolean keepParticle(String typeId) { return PARTICLES.keep(typeId); }
    public static boolean hideBlockBreak() { return partOn && PARTICLES.hidden.contains("minecraft:block"); }
    public static boolean fullbright() { return fullbrightOn; }
    public static double gamma() { return fullbrightGamma; }
    public static boolean lowFire() { return fireOn; }
    public static float fireOffset() { return (float) fireOffset; }
    public static float fireAlpha(float vanilla) { return fireOn ? vanilla * fireAlpha / 100f : vanilla; }
    public static boolean bossBar() { return bossOn; }
    public static boolean bossHidden() { return bossOn && bossHide; }
    public static float bossScale() { return (float) bossScale; }
    public static int bossOffY() { return bossOffY; }
    /** Player Glow: only your own player, and only when you can see it (third person). */
    public static boolean glows(Object entity) { Minecraft mc = Minecraft.getInstance(); return glowOn && entity == mc.player && !mc.options.getCameraType().isFirstPerson(); }
    public static int glowColor() { return glowColor; }

    // ---- totem ----
    /** GameRendererMixin#displayItemActivation: the local player's totem popped. */
    public static void totemPopped() { if (totemOn) TOTEM.pop(); }
    static void drawTotemOverlay(Gfx ctx) {
        double a = totemOn ? TOTEM.overlayAlpha() : 0; if (a <= 0) return;
        ctx.fill(0, 0, ctx.w(), ctx.h(), HudKit.argb(totemColor, (int) Math.round(a * 100), 1));
    }

}
