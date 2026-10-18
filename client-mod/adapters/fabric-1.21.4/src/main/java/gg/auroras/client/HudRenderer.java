package gg.auroras.client;

// ADAPTER fabric-1.21.4 — UNCOMPILED. Draws every HUD element with the shared HudKit styles and the same placement maths
// as the launcher's HUD editor (Hud.resolveInto). Written against Yarn 1.21.4 names without the jars; expect small fixes.
//
// Performance: element settings are parsed only when the profile revision changes; text is rebuilt only when its numbers
// change (Perf.CachedText); slow sources (ping, potions, armor, memory) refresh on a 250 ms gate; disabled elements cost a
// boolean check; nothing touches the disk or network here (Spotify is read by a background thread in NowPlaying).

import gg.auroras.core.*;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.item.ItemStack;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalTime;
import java.util.*;

public final class HudRenderer {
    private HudRenderer() {}
    static long sessionStart = System.currentTimeMillis();
    static String instanceName = null;

    /** Parsed settings of one element, refreshed only when settings change. */
    static final class El {
        final String id; final Config.Module mod; boolean on, shadow, bg, border; Hud.Anchor anchor = Hud.Anchor.TL; int offX, offY, color, accent, bgPct, opacity; float scale = 1; HudKit.Style style = HudKit.Style.MINIMAL;
        final Perf.CachedText text = new Perf.CachedText(); final HudKit.Fade fade = new HudKit.Fade(); final int[] pos = new int[2]; int w, h; String[] lines = new String[0];
        El(String id) { this.id = id; mod = AurorasClient.REG.get(id); }
        void load() {
            Config.ProfileManager pm = AurorasClient.PM; on = pm.enabled(id); anchor = Hud.Anchor.valueOf(pm.get(id + ".anchor")); offX = i("offX"); offY = i("offY"); scale = Float.parseFloat(pm.get(id + ".scale"));
            color = Integer.parseInt(pm.get(id + ".color"), 16); accent = Integer.parseInt(pm.get(id + ".accent"), 16); shadow = b("shadow"); bg = b("background"); border = b("border"); bgPct = i("bgOpacity"); opacity = i("opacity");
            style = HudKit.Style.of(pm.get(id + ".style")); text.set(Long.MIN_VALUE, "");
        }
        boolean b(String k) { return AurorasClient.PM.get(id + "." + k).equals("true"); }
        int i(String k) { return Integer.parseInt(AurorasClient.PM.get(id + "." + k)); }
        String s(String k) { return AurorasClient.PM.get(id + "." + k); }
    }
    static final Map<String, El> ELS = new LinkedHashMap<>();
    static int seen = -1;
    static final Perf.UpdateGate SLOW = new Perf.UpdateGate(250);
    static final Calc.CpsCounter LEFT = new Calc.CpsCounter(1000), RIGHT = new Calc.CpsCounter(1000);
    static Calc.CpsCounter left = LEFT, right = RIGHT; static int cpsWindow = 1000;
    static final double[] KEY_GLOW = new double[8];
    static double fpsAvg; static final HudKit.Smooth FPS_AVG = new HudKit.Smooth();
    static final GameLogic.FrameGraph FRAMES = new GameLogic.FrameGraph(200); static final int[] BARS = new int[200];
    static final net.minecraft.util.Identifier LOGO = net.minecraft.util.Identifier.of("auroras_client", "textures/gui/logo.png");
    static boolean editingNow;

    static void init(Path gameDir) {
        for (Config.Module m : AurorasClient.REG.modules()) if (HudKit.positionable(m) && m.available()) ELS.put(m.id(), new El(m.id()));
        try { String j = Files.readString(gameDir.resolve("instance.json")); java.util.regex.Matcher mm = java.util.regex.Pattern.compile("\"name\"\\s*:\\s*\"([^\"]{0,32})\"").matcher(j); if (mm.find()) instanceName = mm.group(1); } catch (Exception ignored) { }
        NowPlaying.start(gameDir.resolve("config").resolve("auroras").resolve("nowplaying.json"));
        SpotifyHud.init(gameDir.resolve("config").resolve("auroras"));
    }
    static void refresh() {
        if (AurorasClient.PM.revision() == seen) return; seen = AurorasClient.PM.revision();
        for (El e : ELS.values()) e.load();
        int win = Integer.parseInt(AurorasClient.PM.get("cps.windowMs")); if (win != cpsWindow) { cpsWindow = win; left = new Calc.CpsCounter(win); right = new Calc.CpsCounter(win); }
    }
    /** Called by MouseMixin on every mouse button press (not on releases or repeats). */
    static void click(int button) { long now = System.currentTimeMillis(); if (button == 0) left.click(now); else if (button == 1) right.click(now); }
    /** Window lost focus: clicks made elsewhere must not count. */
    static void focusLost() { left.reset(); right.reset(); }

    /** editing: the HUD editor draws outlines itself and passes drag previews in. reduced = reduced motion. */
    static void render(DrawContext ctx, MinecraftClient mc, double dt, boolean editing, String selected) {
        refresh();
        boolean reduced = AurorasClient.PM.get("menuanim.reducedMotion").equals("true");
        int sw = mc.getWindow().getScaledWidth(), sh = mc.getWindow().getScaledHeight(); long nowMs = System.currentTimeMillis();
        boolean slow = SLOW.due(System.nanoTime());
        fpsAvg = FPS_AVG.update(mc.getCurrentFps(), dt, 2.0, false); editingNow = editing;
        for (El e : ELS.values()) {
            double a = e.fade.update(e.on, dt, 0.18, reduced || editing); if (a <= 0) continue;
            if (e.id.equals("keystrokes")) { keystrokes(ctx, mc, e, sw, sh, dt, a); continue; }
            if (e.id.equals("spotify")) { SpotifyHud.draw(ctx, mc, e, sw, sh, dt, a, reduced); continue; }
            if (e.id.equals("logo")) { logo(ctx, e, sw, sh, a); continue; }
            if (e.id.equals("frametime") && e.b("showGraph")) { frametime(ctx, mc, e, sw, sh, a); continue; }
            String[] lines = content(mc, e, nowMs, slow); if (lines == null || lines.length == 0) continue; e.lines = lines;
            draw(ctx, mc, e, lines, sw, sh, a);
        }
    }

    /** Text lines for an element. Rebuilt only when the numbers they show change. */
    static String[] content(MinecraftClient mc, El e, long nowMs, boolean slow) {
        switch (e.id) {
            case "fps": { int f = mc.getCurrentFps(); boolean av = e.b("showAverage"), ms = e.b("showFrameTime"); long k = Perf.key(f, av ? Math.round(fpsAvg) : 0, ms ? Math.round(AurorasClient.FPS_SMOOTH.frameTimeMs() * 10) : 0);
                if (e.text.stale(k)) e.text.set(k, HudKit.fps(f, fpsAvg, AurorasClient.FPS_SMOOTH.frameTimeMs(), av, ms, e.style)); return one(e); }
            case "coords": { int d = e.i("decimals"); double m = Math.pow(10, d); boolean dir = e.b("showDirection");
                long k = Perf.key(Math.round(mc.player.getX() * m), Math.round(mc.player.getY() * m), Math.round(mc.player.getZ() * m)) * 31 + (dir ? Math.round(mc.player.getYaw() / 45f) : 99);
                if (e.text.stale(k)) e.text.set(k, HudKit.coords(mc.player.getX(), mc.player.getY(), mc.player.getZ(), d, e.b("showX"), e.b("showY"), e.b("showZ"), dir ? Calc.compass(mc.player.getYaw()) : null)); return one(e); }
            case "cps": { int l = left.cps(nowMs), r = right.cps(nowMs); long k = Perf.key(l, r, 0); if (e.text.stale(k)) e.text.set(k, HudKit.cps(l, r, e.b("showRight"), e.style)); return one(e); }
            case "clock": { LocalTime t = LocalTime.now(); boolean sec = e.s("seconds").equals("true"); long k = sec ? t.toSecondOfDay() : t.toSecondOfDay() / 60;
                if (e.text.stale(k)) e.text.set(k, Calc.clock(t.getHour(), t.getMinute(), t.getSecond(), e.b("h24"), sec)); return one(e); }
            case "ping": { int ms = -1; if (!mc.isInSingleplayer() && mc.getNetworkHandler() != null) { PlayerListEntry p = mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid()); if (p != null && p.getLatency() > 0) ms = p.getLatency(); }
                if (e.text.stale(ms)) e.text.set(ms, HudKit.ping(ms)); return one(e); }
            case "brandinghud": { if (e.text.stale(1)) e.text.set(1, "Auroras Client"); return one(e); }
            case "sessioninfo": { long secs = (nowMs - sessionStart) / 1000; long k = e.b("showDuration") ? secs : 0;
                if (e.text.stale(k)) { String srv = mc.getCurrentServerEntry() != null ? mc.getCurrentServerEntry().address : null;
                    e.text.set(k, HudKit.sessionInfo(AurorasClient.mcVersion, "Fabric", instanceName, srv, nowMs - sessionStart, e.b("showVersion"), e.b("showLoader"), e.b("showInstance"), e.b("showServer"), e.b("showDuration"))); } return one(e); }
            case "spotify": { NowPlaying.Snap n = NowPlaying.current; long k = n == null ? -1 : n.version() * 1000 + (e.b("showProgress") ? (n.progressNow(nowMs) / 1000) : 0);
                if (e.text.stale(k)) e.text.set(k, n == null ? HudKit.spotify(null, null, false, 0, 0, false, "not connected") : HudKit.spotify(n.title(), n.artist(), n.playing(), n.progressNow(nowMs), n.durationMs(), e.b("showProgress"), n.status())); return one(e); }
            case "target": { Entity t = mc.targetedEntity; if (!(t instanceof LivingEntity le)) return null;
                double dist = mc.player.distanceTo(t); long k = Perf.key(t.getId(), Math.round(le.getHealth() * 2), e.b("showDistance") ? Math.round(dist * 10) : 0);
                if (e.text.stale(k)) e.text.set(k, HudKit.target(t.getDisplayName().getString(), le.getHealth(), le.getMaxHealth(), dist, e.b("showHealth"), e.b("showDistance"))); return one(e); }
            case "potions": { if (!slow && e.lines.length > 0) return e.lines;
                Collection<StatusEffectInstance> fx = mc.player.getStatusEffects(); if (fx.isEmpty()) { e.lines = new String[0]; return null; }
                String[] names = new String[fx.size()]; int[] ticks = new int[fx.size()]; int[] amp = new int[fx.size()]; int n = 0;
                for (StatusEffectInstance s : fx) { names[n] = s.getEffectType().value().getName().getString(); ticks[n] = s.isInfinite() ? -1 : s.getDuration(); amp[n] = s.getAmplifier(); n++; }
                int[] order = HudKit.potionOrder(names, ticks, e.s("order")); String[] out = new String[n]; for (int i = 0; i < n; i++) { int j = order[i]; out[i] = HudKit.potionName(names[j], amp[j]) + "  " + HudKit.potionTime(ticks[j]); }
                return out; }
            case "armor": { if (!slow && e.lines.length > 0) return e.lines; String f = e.s("format"); List<String> out = new ArrayList<>();
                for (EquipmentSlot slot : new EquipmentSlot[]{EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET}) addDur(out, mc.player.getEquippedStack(slot), f);
                if (e.b("showHeld")) addDur(out, mc.player.getMainHandStack(), f);
                if (out.isEmpty()) return null; return e.s("layout").equals("horizontal") ? new String[]{String.join("   ", out)} : out.toArray(new String[0]); }
            case "modulelist": { if (!slow && e.lines.length > 0) return e.lines; List<HudKit.Entry> en = new ArrayList<>();
                for (Config.Module m : AurorasClient.REG.modules()) if (!m.id().equals("modulelist") && AurorasClient.PM.enabled(m.id())) en.add(new HudKit.Entry(m.id(), m.name(), m.cat().label, mc.textRenderer.getWidth(m.name())));
                List<HudKit.Entry> sorted = HudKit.moduleList(en, e.s("sort")); String[] out = new String[sorted.size()]; for (int i = 0; i < out.length; i++) out[i] = sorted.get(i).name(); return out.length == 0 ? null : out; }
            case "direction": { float yaw = mc.player.getYaw(); boolean deg = e.b("showDegrees"), strip = e.s("display").equals("strip"); long k = GameLogic.heading(yaw) * 2L + (deg ? 1 : 0);
                if (e.text.stale(k)) e.text.set(k, strip ? GameLogic.compassStrip(yaw, 9) + (deg ? "  " + GameLogic.heading(yaw) + "°" : "") : GameLogic.direction(yaw, deg)); return one(e); }
            case "freelookstatus": { boolean on = AurorasModules.freelook(); if (!on && !editingNow) return null; if (e.text.stale(1)) e.text.set(1, "Freelook"); return one(e); }
            case "session": { if (!slow && e.lines.length > 0) return e.lines; List<String> l = AurorasModules.SESSION.lines(nowMs, e.b("showPlaytime"), e.b("showDistance"), e.b("showBlocks"), e.b("showDeaths")); return l.toArray(new String[0]); }
            case "serverinfo": { if (!slow && e.lines.length > 0) return e.lines; var entry = mc.getCurrentServerEntry(); String addr = mc.isInSingleplayer() || entry == null ? null : entry.address;
                int players = mc.getNetworkHandler() != null ? mc.getNetworkHandler().getPlayerList().size() : -1, ping = -1;
                if (addr != null && mc.getNetworkHandler() != null) { PlayerListEntry p = mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid()); if (p != null) ping = p.getLatency(); }
                String ver = entry != null && entry.version != null ? entry.version.getString() : null;
                return GameLogic.serverInfo(addr, players, ping, ver, e.b("showAddress"), e.b("showPlayers"), e.b("showPing"), e.b("showVersion")).toArray(new String[0]); }
            case "frametime": { long k = Math.round(AurorasClient.FPS_SMOOTH.frameTimeMs() * 10); if (e.text.stale(k)) e.text.set(k, String.format(Locale.ROOT, "Frame %.1f ms · worst %.1f ms", AurorasClient.FPS_SMOOTH.frameTimeMs(), FRAMES.worst(60))); return one(e); }
            case "memory": { if (!slow && e.lines.length > 0) return e.lines; long u = Perf.usedMemoryBytes(), m = Perf.maxMemoryBytes(); long k = Perf.key(u >> 20, m >> 20, e.b("showBar") ? 1 : 0);
                if (e.text.stale(k)) e.text.set(k, GameLogic.memory(u, m, e.b("showBar"))); return one(e); }
            case "biome": { if (!slow && e.lines.length > 0) return e.lines; if (mc.world == null) return null;
                String b = mc.world.getBiome(mc.player.getBlockPos()).getKey().map(x -> x.getValue().toString()).orElse(null), dim = mc.world.getRegistryKey().getValue().toString();
                long k = Perf.key(b == null ? 0 : b.hashCode(), dim.hashCode(), e.b("showDimension") ? 1 : 0); if (e.text.stale(k)) e.text.set(k, GameLogic.biome(b, dim, e.b("showDimension"))); return one(e); }
            default: return null;
        }
    }
    /** The Auroras logo: the app icon, 32 px at scale 1. */
    static void logo(DrawContext ctx, El e, int sw, int sh, double fade) {
        e.w = Hud.scaled(32, e.scale); e.h = e.w; Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        ctx.drawTexture(net.minecraft.client.render.RenderLayer::getGuiTextured, LOGO, e.pos[0], e.pos[1], 0f, 0f, e.w, e.h, e.w, e.h, HudKit.argb(0xFFFFFF, e.opacity, fade));
    }
    /** Frame time text plus a bar graph of recent frames (green at 60 fps or better, yellow to 30, red below). */
    static void frametime(DrawContext ctx, MinecraftClient mc, El e, int sw, int sh, double fade) {
        String[] lines = content(mc, e, System.currentTimeMillis(), false); e.lines = lines; int gw = e.i("graphWidth"), gh = 20, px = e.style.padX, py = e.style.padY;
        int bw = Math.max(gw, mc.textRenderer.getWidth(lines[0])) + px * 2, bh = 9 + 3 + gh + py * 2; e.w = Hud.scaled(bw, e.scale); e.h = Hud.scaled(bh, e.scale);
        Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        ctx.getMatrices().push(); ctx.getMatrices().translate(e.pos[0], e.pos[1], 0); ctx.getMatrices().scale(e.scale, e.scale, 1f);
        if (e.bg) ctx.fill(0, 0, bw, bh, HudKit.argb(0x0C0F16, e.bgPct * e.opacity / 100, fade));
        ctx.drawText(mc.textRenderer, lines[0], px, py, HudKit.argb(e.color, e.opacity, fade), e.shadow);
        int n = FRAMES.heights(gw, gh, BARS), base = py + 12 + gh;
        for (int k = 0; k < n; k++) { int h = Math.max(1, BARS[k]), x = px + gw - n + k; ctx.fill(x, base - h, x + 1, base, HudKit.argb(GameLogic.FrameGraph.color(BARS[k], gh), e.opacity, fade)); }
        ctx.getMatrices().pop();
    }
    static void addDur(List<String> out, ItemStack st, String format) {
        if (st.isEmpty() || !st.isDamageable()) return; String d = HudKit.durability(st.getMaxDamage(), st.getDamage(), format.equals("bar") ? "percent" : format);
        out.add(st.getName().getString() + "  " + d);
    }
    static String[] one(El e) { String[] a = e.lines.length == 1 ? e.lines : new String[1]; a[0] = e.text.text(); return a; }

    /** Places and draws a text element in its style. Editor and gameplay use the same path. */
    static void draw(DrawContext ctx, MinecraftClient mc, El e, String[] lines, int sw, int sh, double fade) {
        int tw = 0; for (String l : lines) tw = Math.max(tw, mc.textRenderer.getWidth(l));
        String label = e.style.label ? e.mod.name().toUpperCase(Locale.ROOT) : null; int th = lines.length * 10 - 1 + (label != null ? 7 : 0);
        int[] b = HudKit.box(e.style, Math.max(tw, label != null ? (int) (mc.textRenderer.getWidth(label) * 0.75f) : 0), th);
        e.w = Hud.scaled(b[0], e.scale); e.h = Hud.scaled(b[1], e.scale); Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        ctx.getMatrices().push(); ctx.getMatrices().translate(e.pos[0], e.pos[1], 0); ctx.getMatrices().scale(e.scale, e.scale, 1f);
        if (e.bg) ctx.fill(0, 0, b[0], b[1], HudKit.argb(0x0C0F16, e.bgPct * e.opacity / 100, fade));
        if (e.border) { int c = HudKit.argb(e.accent, 55 * e.opacity / 100, fade); ctx.fill(0, 0, b[0], 1, c); ctx.fill(0, b[1] - 1, b[0], b[1], c); ctx.fill(0, 0, 1, b[1], c); ctx.fill(b[0] - 1, 0, b[0], b[1], c); }
        if (e.style.accent > 0) ctx.fill(0, 0, e.style.accent, b[1], HudKit.argb(e.accent, e.opacity, fade));
        int y = e.style.padY;
        if (label != null) { ctx.getMatrices().push(); ctx.getMatrices().translate(e.style.padX + e.style.accent, y, 0); ctx.getMatrices().scale(0.75f, 0.75f, 1f); ctx.drawText(mc.textRenderer, label, 0, 0, HudKit.argb(e.accent, 90 * e.opacity / 100, fade), false); ctx.getMatrices().pop(); y += 7; }
        boolean right = e.id.equals("modulelist") && e.s("align").equals("right");
        for (int i = 0; i < lines.length; i++) {
            int lw = mc.textRenderer.getWidth(lines[i]), x = right ? b[0] - e.style.padX - lw : e.style.padX + e.style.accent, col = e.color;
            if (e.id.equals("ping")) { int ms = parsePing(lines[i]); col = HudKit.PING_COLORS[Math.max(0, HudKit.pingLevel(ms, e.i("goodMs"), e.i("okMs")) < 0 ? 3 : HudKit.pingLevel(ms, e.i("goodMs"), e.i("okMs")))]; }
            if (e.id.equals("modulelist") && i % 2 == 0) col = e.accent;
            ctx.drawText(mc.textRenderer, lines[i], x, y, HudKit.argb(col, e.opacity, fade), e.shadow); y += 10;
        }
        ctx.getMatrices().pop();
    }
    static int parsePing(String s) { try { return Integer.parseInt(s.replaceAll("[^0-9]", "")); } catch (NumberFormatException x) { return -1; } }

    static final String[] KEYS = {"W", "A", "S", "D", "LMB", "RMB", "———"};
    static void keystrokes(DrawContext ctx, MinecraftClient mc, El e, int sw, int sh, double dt, double fade) {
        boolean mouse = e.b("showMouse"), space = e.b("showSpace"), anim = e.b("animate"); int rows = space ? 3 : 2;
        int bw = 58 + e.style.padX * 2, bh = rows * 20 - 2 + (mouse ? 20 : 0) + e.style.padY * 2; e.w = Hud.scaled(bw, e.scale); e.h = Hud.scaled(bh, e.scale);
        Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        boolean[] down = {mc.options.forwardKey.isPressed(), mc.options.leftKey.isPressed(), mc.options.backKey.isPressed(), mc.options.rightKey.isPressed(), mc.options.attackKey.isPressed(), mc.options.useKey.isPressed(), mc.options.jumpKey.isPressed()};
        ctx.getMatrices().push(); ctx.getMatrices().translate(e.pos[0], e.pos[1], 0); ctx.getMatrices().scale(e.scale, e.scale, 1f);
        if (e.bg) ctx.fill(0, 0, bw, bh, HudKit.argb(0x0C0F16, e.bgPct * e.opacity / 100 / 2, fade));
        int px = e.style.padX, py = e.style.padY;
        int[][] lay = {{20, 0, 18}, {0, 20, 18}, {20, 20, 18}, {40, 20, 18}, {0, 40, 28}, {30, 40, 28}, {0, mouse ? 60 : 40, 58}};
        for (int k = 0; k < 7; k++) {
            if ((k == 4 || k == 5) && !mouse) continue; if (k == 6 && !space) continue;
            KEY_GLOW[k] = HudKit.keyGlow(KEY_GLOW[k], down[k], dt, anim); double g = KEY_GLOW[k]; int x = px + lay[k][0], y = py + lay[k][1], w = lay[k][2];
            int bgc = HudKit.argb(mix(0x0C0F16, e.accent, g), (int) Math.round((55 + 30 * g) * e.opacity / 100.0), fade);
            ctx.fill(x, y, x + w, y + 18, bgc);
            String label = KEYS[k]; if (k == 4 && e.b("showCps")) label = left.cps(System.currentTimeMillis()) + " CPS"; if (k == 5 && e.b("showCps")) label = right.cps(System.currentTimeMillis()) + " CPS";
            int lw = mc.textRenderer.getWidth(label); ctx.drawText(mc.textRenderer, label, x + (w - lw) / 2, y + 5, HudKit.argb(g > 0.5 ? 0x06141F : e.color, e.opacity, fade), false);
        }
        ctx.getMatrices().pop();
    }
    static int mix(int a, int b, double t) { return Sky.mix(a, b, t); }
}
