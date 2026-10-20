package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). First-person modules: Swing Animation, Weapon Inspect (with blade skins)
// and Hand Aura. The rules and curves are core PlayerFx (unit-tested); this class reads the settings once per change,
// keeps the inspect animation's clock and answers the hooks in mixin/HandRendererMixin (one per release, in
// versions/<target>, because 26.3 renamed the hand renderer), mixin/LivingEntityMixin and mixin/ItemTintMixin.
//
// Everything here is drawing on your own screen: swing length, offsets and tints never reach the server, the attack
// cooldown and hit timing are untouched, and nothing is shown that you couldn't see anyway.

import com.mojang.blaze3d.vertex.PoseStack;
import gg.auroras.client.platform.HandDraw;
import gg.auroras.client.platform.Mc;
import gg.auroras.client.platform.Platform;
import gg.auroras.core.Config;
import gg.auroras.core.PlayerFx;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.tags.ItemTags;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

public final class AurorasHands {
    private AurorasHands() {}
    static KeyMapping inspectKey;
    static int seen = -1;
    static boolean swingOn, noDip, offHandToo, identity = true, inspectOn, anyItem, cancelOnSwing, skinTools, auraOn, auraChroma, auraPulse, auraHand, auraItem;
    static String swingStyle = "vanilla", inspectStyle = "showcase", bladeSkin = "none";
    static double swingSpeed = 1, inspectDur = 2, bladeStrength = 0.7, auraSpeed = 1, auraIntensity = 0.6, auraSize = 0.08;
    static int bladeColor = 0x6FE3FF, auraColor = 0x6FE3FF, auraLayers = 2;
    static final double[] OFF = new double[7], POSE = new double[6];
    static final PlayerFx.Inspect INSPECT = new PlayerFx.Inspect();
    static long lastNs = System.nanoTime(); static int lastSlot = -1;
    static final long T0 = System.nanoTime();

    /**
     * Tint arrays that mark an item as ours while Minecraft draws it later (item drawing is deferred since 1.21.9): the
     * renderer passes the array it was given straight through, so ItemTintMixin recognises these by identity and colours
     * every quad of that item, while all other items keep their own (usually empty) tint arrays.
     */
    public static final int[] BLADE_MARK = new int[0], AURA_MARK = new int[0];
    /** Colours the marked items are drawn with this frame (opaque ARGB for the blade, translucent for the aura). */
    public static int bladeArgb = -1, auraArgb = 0;
    /** What the next item submitted by the hand renderer is: 0 normal, 1 blade-skinned, 2 an aura shell. */
    public static int marking;

    static void register() { inspectKey = Platform.key("key.auroras.inspect", Integer.parseInt(AurorasClient.PM.get("inspect.key"))); }

    static void refresh() {
        Config.ProfileManager pm = AurorasClient.PM; if (pm.revision() == seen) return; seen = pm.revision();
        swingOn = pm.enabled("swinganim"); swingStyle = pm.get("swinganim.style"); swingSpeed = d("swinganim.speed"); noDip = swingOn && PlayerFx.hideCooldownDip(swingStyle, b("swinganim.noCooldownDip"));
        offHandToo = b("swinganim.offHand");
        PlayerFx.itemOffset(d("swinganim.posX"), d("swinganim.posY"), d("swinganim.posZ"), d("swinganim.itemScale"), i("swinganim.rotX"), i("swinganim.rotY"), i("swinganim.rotZ"), false, OFF);
        identity = PlayerFx.identity(OFF);
        inspectOn = pm.enabled("inspect"); inspectStyle = pm.get("inspect.style"); inspectDur = d("inspect.duration"); anyItem = b("inspect.anyItem"); cancelOnSwing = b("inspect.cancelOnSwing");
        bladeSkin = inspectOn ? pm.get("inspect.bladeSkin") : "none"; bladeColor = hex("inspect.bladeColor"); bladeStrength = d("inspect.bladeStrength"); skinTools = b("inspect.skinTools");
        if (!inspectOn) INSPECT.stop();
        auraOn = pm.enabled("handaura"); auraColor = hex("handaura.color"); auraChroma = b("handaura.chroma"); auraSpeed = d("handaura.chromaSpeed"); auraIntensity = d("handaura.intensity");
        auraSize = d("handaura.size"); auraLayers = i("handaura.layers"); auraPulse = b("handaura.pulse"); auraHand = b("handaura.hand"); auraItem = b("handaura.item");
        AurorasModules.rebind(inspectKey, "inspect.key");
    }
    static boolean b(String k) { return "true".equals(AurorasClient.PM.get(k)); }
    static int i(String k) { return Integer.parseInt(AurorasClient.PM.get(k)); }
    static double d(String k) { return Double.parseDouble(AurorasClient.PM.get(k)); }
    static int hex(String k) { return Integer.parseInt(AurorasClient.PM.get(k), 16); }
    static double now() { return (System.nanoTime() - T0) / 1e9; }

    /** END_CLIENT_TICK: the inspect key, and ending an inspect when you swing, switch items or start using one. */
    static void tick(Minecraft mc) {
        refresh();
        if (mc.player == null) { INSPECT.stop(); lastSlot = -1; return; }
        int slot = mc.player.getInventory().getSelectedSlot();
        while (inspectKey.consumeClick()) if (inspectOn && Mc.screen(mc) == null && inspectable(mc.player.getMainHandItem())) INSPECT.start(inspectStyle, inspectDur);
        if (INSPECT.active() && (slot != lastSlot || mc.player.isUsingItem() || (cancelOnSwing && swungSince) || !inspectable(mc.player.getMainHandItem()))) INSPECT.cancel();
        lastSlot = slot; swungSince = false;
    }
    static boolean weapon(ItemStack s) {
        return s.is(ItemTags.SWORDS) || s.is(ItemTags.AXES) || s.is(ItemTags.PICKAXES) || s.is(ItemTags.SHOVELS) || s.is(ItemTags.HOES) || s.is(Items.TRIDENT) || s.is(Items.MACE);
    }
    static boolean inspectable(ItemStack s) { return !s.isEmpty() && (anyItem || weapon(s)); }

    // ---- hooks ----
    /** Swing progress the arm and item are drawn at (HandRendererMixin, the arm-with-item method's swing argument). */
    public static float swing(float p) { if (p > 0) swungSince = true; return swingOn ? (float) PlayerFx.swing(swingStyle, p) : p; }
    /** The main hand was drawn mid-swing since the last tick (read by tick() to end an inspect when you swing; no entity field needed, so it works on every release). */
    static boolean swungSince;
    /** LivingEntity#getCurrentSwingDuration for your own player: how long the swing animation runs on your screen. */
    public static int swingTicks(Object entity, int ticks) {
        if (!swingOn || entity != Minecraft.getInstance().player) return ticks;
        return PlayerFx.swingTicks(swingStyle, ticks, swingSpeed);
    }
    /** ItemInHandRenderer#tick's attack-cooldown dip (LocalPlayer#getItemSwapScale): 1 = no dip, for the 1.7 look. */
    public static float swapScale(float vanilla) { return noDip ? 1f : vanilla; }
    /** Stream Hide Inventory may hide the held item: the hand renderer then skips that hand while it holds something. */
    public static boolean hideHeld(ItemStack stack) { return AurorasStream.hideHeld() && stack != null && !stack.isEmpty(); }

    /**
     * Right before the hand renderer submits the held item (pose already in the hand's space): pushes the pose, applies
     * the item offsets and the inspect pose, and says which marking the item gets. Returns true if it pushed (the mixin
     * then calls after()).
     */
    public static boolean before(PoseStack pose, InteractionHand hand, ItemStack stack) {
        boolean main = hand == InteractionHand.MAIN_HAND; marking = 0;
        boolean offset = swingOn && !identity && (main || offHandToo), inspect = main && INSPECT.active();
        int tint = main ? bladeTint(stack) : -1;
        if (!offset && !inspect && tint == -1) return false;
        pose.pushPose();
        if (inspect) {
            long ns = System.nanoTime(); INSPECT.frame(Math.min(0.1, (ns - lastNs) / 1e9)); lastNs = ns; INSPECT.pose(POSE);
            pose.translate((float) POSE[0], (float) POSE[1], (float) POSE[2]);
            HandDraw.rotate(pose, 0, (float) POSE[3]); HandDraw.rotate(pose, 1, (float) POSE[4]); HandDraw.rotate(pose, 2, (float) POSE[5]);
        }
        if (offset) {
            double m = main ? 1 : -1;
            pose.translate((float) (OFF[0] * m), (float) OFF[1], (float) OFF[2]);
            if (OFF[4] != 0) HandDraw.rotate(pose, 0, (float) OFF[4]);
            if (OFF[5] != 0) HandDraw.rotate(pose, 1, (float) (OFF[5] * m));
            if (OFF[6] != 0) HandDraw.rotate(pose, 2, (float) (OFF[6] * m));
            if (OFF[3] != 1) pose.scale((float) OFF[3], (float) OFF[3], (float) OFF[3]);
        }
        if (tint != -1) { bladeArgb = tint; marking = 1; }
        return true;
    }
    /** Keeps the inspect clock fresh while idle so a new inspect starts without a jump in dt. */
    public static void idle() { if (!INSPECT.active()) lastNs = System.nanoTime(); }
    public static void after(PoseStack pose, boolean pushed) { marking = 0; if (pushed) pose.popPose(); }

    static int bladeTint(ItemStack s) {
        if ("none".equals(bladeSkin) || s.isEmpty()) return -1;
        if (!(s.is(ItemTags.SWORDS) || (skinTools && weapon(s)))) return -1;
        return PlayerFx.bladeTint(bladeSkin, bladeColor, bladeStrength, now());
    }

    // ---- Hand Aura ----
    /** Shells to draw around the held item this frame (0 when off). */
    public static int auraItemLayers() { return auraOn && auraItem && auraIntensity > 0 ? auraLayers : 0; }
    public static boolean auraHand() { return auraOn && auraHand && auraIntensity > 0; }
    public static int auraLayers() { return auraLayers; }
    /** Starts aura shell i: a slightly larger copy of the item, drawn translucent and full-bright. Returns false to skip it. */
    public static boolean auraBegin(PoseStack pose, int i) {
        int c = PlayerFx.auraColor(auraColor, auraChroma, auraSpeed, auraIntensity, auraPulse, i, auraLayers, now()); if (c == 0) return false;
        float s = (float) PlayerFx.auraScale(auraSize, i, auraLayers); pose.pushPose(); pose.scale(s, s, s); auraArgb = c; marking = 2; return true;
    }
    public static void auraEnd(PoseStack pose) { marking = 0; pose.popPose(); }
    /** The aura colour of shell i, for the arm (AvatarRendererMixin). */
    public static int auraArm(int i) { return PlayerFx.auraColor(auraColor, auraChroma, auraSpeed, auraIntensity, auraPulse, i, auraLayers, now()); }
    public static float auraArmScale(int i) { return (float) PlayerFx.auraScale(auraSize, i, auraLayers); }

    /** HandRendererMixin's ModifyArg on the item submit: the tint array to use (ours while marking, else the item's own). */
    public static int[] tints(int[] own) {
        if (marking == 0 || own == null || own.length != 0) return own;
        return marking == 1 ? BLADE_MARK : AURA_MARK;
    }
    /** ItemTintMixin: the colour for a quad of a marked item, or Integer.MIN_VALUE when the item isn't ours. */
    public static int markedColor(int[] tints) { return tints == BLADE_MARK ? bladeArgb : tints == AURA_MARK ? auraArgb : Integer.MIN_VALUE; }
    public static boolean marked(int[] tints) { return tints == BLADE_MARK || tints == AURA_MARK; }
    /** Set by ItemTintMixin for the quad being drawn, so the vertex-buffer choice right after can pick a translucent one. */
    public static boolean auraQuad;
}
