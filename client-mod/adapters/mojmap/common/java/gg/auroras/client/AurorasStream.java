package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). Streaming helpers: Name Protect and Stream Hide Inventory.
//  - Name Protect swaps names for aliases in text as Minecraft draws and measures it (mixin/FontMixin), so every place
//    a name shows on your screen (chat, tab list, name tags, scoreboard, death messages) reads the alias. Matching and
//    replacing is core PlayerFx.protect (unit-tested). Only your screen changes: the server and other players still see
//    your real name, and commands you type are sent as typed.
//  - Stream Hide Inventory covers your hotbar items (Platform's hotbar wrapper calls coverHotbar), skips drawing the
//    items in your own inventory slots (mixin/ContainerScreenMixin), their tooltips, and optionally the item in your hand.
//    Your inventory works as normal; only what is drawn changes.

import gg.auroras.client.platform.Gfx;
import gg.auroras.client.platform.Mc;
import gg.auroras.client.platform.Platform;
import gg.auroras.client.ui.Glass;
import gg.auroras.core.Config;
import gg.auroras.core.HudKit;
import gg.auroras.core.PlayerFx;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientPacketListener;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.network.chat.Style;
import net.minecraft.util.FormattedCharSequence;
import net.minecraft.world.entity.HumanoidArm;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;

import java.util.ArrayList;
import java.util.List;

public final class AurorasStream {
    private AurorasStream() {}
    static KeyMapping hideKey;
    static int seen = -1;
    static boolean protectOn, hideOthers, hideOn, hidden = true, hotbar, inventory, held, tooltips, placeholder, badge;
    static String alias = "You", othersAlias = "Player";
    // the name table PlayerFx.protect reads; rebuilt at most once a second (render thread only)
    static final String[] NAMES = new String[128], ALIASES = new String[128];
    static volatile int count;
    static long nextNames;

    static void register() { hideKey = Platform.key("key.auroras.streamhide", Integer.parseInt(AurorasClient.PM.get("streamhide.key"))); }

    static void refresh() {
        Config.ProfileManager pm = AurorasClient.PM; if (pm.revision() == seen) return; seen = pm.revision();
        protectOn = pm.enabled("nameprotect"); alias = PlayerFx.cleanAlias(pm.get("nameprotect.alias"), "You"); hideOthers = b("nameprotect.hideOthers");
        othersAlias = PlayerFx.cleanAlias(pm.get("nameprotect.othersAlias"), "Player");
        boolean was = hideOn; hideOn = pm.enabled("streamhide"); if (hideOn && !was) hidden = true; // switching the module on starts hidden
        hotbar = b("streamhide.hotbar"); inventory = b("streamhide.inventory"); held = b("streamhide.held"); tooltips = b("streamhide.tooltips"); placeholder = b("streamhide.placeholder"); badge = b("streamhide.badge");
        nextNames = 0; if (!protectOn) count = 0;
        AurorasModules.rebind(hideKey, "streamhide.key");
    }
    static boolean b(String k) { return "true".equals(AurorasClient.PM.get(k)); }

    static void tick(Minecraft mc) {
        refresh();
        while (hideKey.consumeClick()) if (hideOn && Mc.screen(mc) == null) { hidden = !hidden; AurorasClient.chat(mc, hidden ? "[Auroras] Items hidden on your screen" : "[Auroras] Items shown again"); }
        if (!protectOn) return;
        long now = System.currentTimeMillis(); if (now < nextNames) return; nextNames = now + 1000;
        String self = mc.getUser().getName(); List<String> others = new ArrayList<>();
        ClientPacketListener conn = mc.getConnection();
        if (hideOthers && conn != null) for (PlayerInfo p : conn.getOnlinePlayers()) others.add(p.getProfile().name());
        count = PlayerFx.nameTable(self, alias, others, hideOthers, othersAlias, NAMES, ALIASES);
    }

    // ---- Name Protect (FontMixin) ----
    public static boolean protecting() { return protectOn && count > 0; }
    public static String text(String s) { return protectOn && count > 0 ? PlayerFx.protect(s, NAMES, ALIASES, count) : s; }
    public static FormattedCharSequence text(FormattedCharSequence s) {
        if (!protectOn || count == 0 || s == null || s instanceof Protected) return s;
        return new Protected(s);
    }
    /** A styled text that reads the original and hands out the protected version (each letter keeps its style; an alias takes the style of the name it replaces). */
    record Protected(FormattedCharSequence src) implements FormattedCharSequence {
        static int[] cps = new int[256], out = new int[512]; static Object[] st = new Object[256], ost = new Object[512]; static int n;
        @Override public boolean accept(net.minecraft.util.FormattedCharSink sink) {
            n = 0;
            src.accept((index, style, cp) -> { if (n == cps.length) { cps = java.util.Arrays.copyOf(cps, n * 2); st = java.util.Arrays.copyOf(st, n * 2); } cps[n] = cp; st[n++] = style; return true; });
            int len = n, need = len * 2 + 64; if (out.length < need) { out = new int[need]; ost = new Object[need]; }
            int m = PlayerFx.protect(cps, st, len, NAMES, ALIASES, count, out, ost);
            if (m < 0) { for (int i = 0; i < len; i++) if (!sink.accept(i, (Style) st[i], cps[i])) return false; return true; }
            for (int i = 0; i < m; i++) if (!sink.accept(i, (Style) ost[i], out[i])) return false;
            return true;
        }
    }

    // ---- Stream Hide Inventory ----
    static boolean active() { return hideOn && hidden; }
    public static boolean hideHeld() { return active() && held; }
    /** ContainerScreenMixin: items in your own inventory's slots aren't drawn while hiding. */
    public static boolean hideSlot(Slot slot) { return active() && inventory && slot != null && slot.container instanceof Inventory && slot.hasItem(); }
    public static boolean hideTooltip(Slot hovered) { return active() && tooltips && hovered != null && hovered.container instanceof Inventory; }

    /** A tile drawn where a hidden item is (16x16 at x, y). */
    public static void cover(Gfx g, int x, int y) {
        if (placeholder) {
            Glass.rect(g, x, y, 16, 16, 3, 0xF00C0F16); Glass.outline(g, x, y, 16, 16, 3, 0x4C6FE3FF);
            Glass.circle(g, x + 8, y + 8, 1.5, 0x996FE3FF);
        } else g.fill(x, y, x + 16, y + 16, 0xF0282B31);
    }
    /** After the vanilla hotbar: covers the slots (and the off hand) that hold something. */
    public static void coverHotbar(Gfx g) {
        Minecraft mc = Minecraft.getInstance(); if (!active() || !hotbar || mc.player == null || Mc.hudHidden(mc) || mc.player.isSpectator()) return;
        int w = g.w(), h = g.h(), y = h - 19; Inventory inv = mc.player.getInventory();
        for (int i = 0; i < 9; i++) if (!inv.getItem(i).isEmpty()) cover(g, w / 2 - 88 + i * 20, y);
        ItemStack off = mc.player.getOffhandItem();
        if (!off.isEmpty()) cover(g, mc.player.getMainArm() == HumanoidArm.RIGHT ? w / 2 - 91 - 26 : w / 2 + 91 + 10, y);
    }
    /** HUD layer: a small reminder badge in the top-left corner while items are hidden. */
    static void drawBadge(Gfx g) {
        if (!active() || !badge) return;
        String s = "Items hidden"; int tw = Gfx.width(s), x = 4, y = 4;
        Glass.rect(g, x, y, tw + 16, 13, 6.5, 0xC00C0F16); Glass.outline(g, x, y, tw + 16, 13, 6.5, 0x406FE3FF);
        Glass.circle(g, x + 7, y + 6.5, 2, HudKit.argb(0x6FE3FF, 100, 1)); g.text(s, x + 12, y + 3, 0xFFE8ECF4, false);
    }
}
