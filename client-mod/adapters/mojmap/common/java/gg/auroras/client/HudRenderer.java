package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Draws every HUD element with the shared HudKit styles and the same placement maths
// as the launcher's HUD editor (Hud.resolveInto). Written against Mojang's names without the game jars; expect small fixes.
//
// Performance: element settings are parsed only when the profile revision changes; text is rebuilt only when its numbers
// change (Perf.CachedText); slow sources (ping, potions, armor, memory) refresh on a 250 ms gate; disabled elements cost a
// boolean check; nothing touches the disk or network here (Spotify is read by a background thread in NowPlaying).

import gg.auroras.core.*;
import gg.auroras.client.platform.Gfx;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.resources.Identifier;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.ItemStack;

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
        final String id; final Config.Module mod; boolean on, shadow, bg, border; Hud.Anchor anchor = Hud.Anchor.TL; int offX, offY, color, accent, bgPct, opacity, bgColor, radius; float scale = 1; HudKit.Style style = HudKit.Style.MINIMAL;
        String textMode = "solid"; double chromaSpeed = 1; Keystrokes.Layout keys;
        final Perf.CachedText text = new Perf.CachedText(); final HudKit.Fade fade = new HudKit.Fade(); final int[] pos = new int[2]; int w, h; String[] lines = new String[0];
        El(String id) { this.id = id; mod = AurorasClient.REG.get(id); }
        void load() {
            Config.ProfileManager pm = AurorasClient.PM; vals.clear(); for (Config.SettingDef d : mod.settings()) vals.put(d.key(), pm.get(id + "." + d.key())); on = pm.enabled(id); anchor = Hud.Anchor.valueOf(pm.get(id + ".anchor")); offX = i("offX"); offY = i("offY"); scale = Float.parseFloat(pm.get(id + ".scale"));
            color = Integer.parseInt(pm.get(id + ".color"), 16); accent = Integer.parseInt(pm.get(id + ".accent"), 16); shadow = b("shadow"); bg = b("background"); border = b("border"); bgPct = i("bgOpacity"); opacity = i("opacity");
            style = HudKit.Style.of(pm.get(id + ".style")); text.set(Long.MIN_VALUE, "");
            bgColor = Integer.parseInt(pm.get(id + ".bgColor"), 16); radius = i("radius"); textMode = s("textMode"); chromaSpeed = Double.parseDouble(pm.get(id + ".chromaSpeed"));
            if (id.equals("brandinghud") && b("animate") && !HudKit.perChar(textMode)) textMode = "gradient"; // Animate: the name shimmers from its colour to the accent
            if (id.equals("keystrokes")) keys = Keystrokes.layout(i("keySize"), i("gap"), b("showMouse"), b("showModifiers"), b("showSpace"), s("spaceStyle"));
        }
        /** This element's settings by short key, copied in load(), so per-frame reads don't build "id.key" strings. */
        final Map<String, String> vals = new HashMap<>();
        String raw(String k) { String v = vals.get(k); return v != null ? v : AurorasClient.PM.get(id + "." + k); }
        boolean b(String k) { return "true".equals(raw(k)); }
        int i(String k) { return Integer.parseInt(raw(k)); }
        String s(String k) { return raw(k); }
    }
    static final Map<String, El> ELS = new LinkedHashMap<>();
    static int seen = -1;
    static final Perf.UpdateGate SLOW = new Perf.UpdateGate(250);
    static final Calc.CpsCounter LEFT = new Calc.CpsCounter(1000), RIGHT = new Calc.CpsCounter(1000);
    static Calc.CpsCounter left = LEFT, right = RIGHT; static int cpsWindow = 1000;
    static final double[] KEY_GLOW = new double[Keystrokes.INPUTS];
    static net.minecraft.client.KeyMapping[] KEY_MAPS; // Minecraft's own key mappings, in Keystrokes input order
    static final String[] KEY_NAMES = new String[Keystrokes.INPUTS]; static final Perf.UpdateGate KEY_NAMES_GATE = new Perf.UpdateGate(1000);
    static final int[] RECTS = HudKit.rectBuffer(); static final long T0 = System.nanoTime(); static double seconds;
    /** One-character strings for ASCII, so per-character colouring doesn't allocate. */
    static final String[] CH = new String[128]; static { for (int c = 0; c < 128; c++) CH[c] = String.valueOf((char) c); }
    static double fpsAvg; static final HudKit.Smooth FPS_AVG = new HudKit.Smooth();
    static final GameLogic.FrameGraph FRAMES = new GameLogic.FrameGraph(200); static final int[] BARS = new int[200];
    static final Identifier LOGO = Identifier.fromNamespaceAndPath("auroras_client", "textures/gui/logo.png");
    static boolean editingNow; static double frameDt;
    /** Module List "animate": each entry slides and fades in when its module turns on (0..1 per registry index). */
    static double[] LIST_IN = new double[0]; static int[] LIST_IDX = new int[0];
    /** Potion Effects "showIcons": the effect sprite for each line, in line order. */
    static Identifier[] POTION_ICONS = new Identifier[0];

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
    static void render(Gfx ctx, Minecraft mc, double dt, boolean editing, String selected) {
        refresh();
        boolean reduced = AurorasModules.reducedMotion(); frameDt = dt;
        int sw = ctx.w(), sh = ctx.h(); long nowMs = System.currentTimeMillis();
        boolean slow = SLOW.due(System.nanoTime());
        fpsAvg = FPS_AVG.update(mc.getFps(), dt, 2.0, false); editingNow = editing; seconds = reduced ? 0 : (System.nanoTime() - T0) / 1e9;
        for (El e : ELS.values()) {
            double a = e.fade.update(e.on && (editing || !e.id.equals("coords") || !AurorasModules.coordsHidden()), dt, 0.18, reduced || editing); if (a <= 0) continue;
            if (e.id.equals("keystrokes")) { keystrokes(ctx, mc, e, sw, sh, dt, a); continue; }
            if (e.id.equals("spotify")) { SpotifyHud.draw(ctx, mc, e, sw, sh, dt, a, reduced); continue; }
            if (e.id.equals("logo")) { logo(ctx, e, sw, sh, a); continue; }
            if (e.id.equals("frametime") && e.b("showGraph")) { frametime(ctx, mc, e, sw, sh, a); continue; }
            String[] lines = content(mc, e, nowMs, slow); if (lines == null || lines.length == 0) continue; e.lines = lines;
            draw(ctx, mc, e, lines, sw, sh, a);
        }
        // Toggle Sprint / Toggle Sneak "Show status", bottom left above where chat input opens
        String st = editing ? null : AurorasModules.status(); if (st != null) ctx.text(st, 4, sh - 12, 0xFFFFFFFF, true);
    }

    /** Text lines for an element. Rebuilt only when the numbers they show change. */
    static String[] content(Minecraft mc, El e, long nowMs, boolean slow) {
        switch (e.id) {
            case "fps": { int f = mc.getFps(); boolean av = e.b("showAverage"), ms = e.b("showFrameTime"); long k = Perf.key(f, av ? Math.round(fpsAvg) : 0, ms ? Math.round(AurorasClient.FPS_SMOOTH.frameTimeMs() * 10) : 0);
                if (e.text.stale(k)) e.text.set(k, HudKit.fps(f, fpsAvg, AurorasClient.FPS_SMOOTH.frameTimeMs(), av, ms, e.style)); return one(e); }
            case "coords": { int d = e.i("decimals"); double m = Math.pow(10, d); boolean dir = e.b("showDirection");
                long k = Perf.key(Math.round(mc.player.getX() * m), Math.round(mc.player.getY() * m), Math.round(mc.player.getZ() * m)) * 31 + (dir ? Math.round(mc.player.getYRot() / 45f) : 99);
                if (e.text.stale(k)) e.text.set(k, HudKit.coords(mc.player.getX(), mc.player.getY(), mc.player.getZ(), d, e.b("showX"), e.b("showY"), e.b("showZ"), dir ? Calc.compass(mc.player.getYRot()) : null)); return one(e); }
            case "cps": { int l = left.cps(nowMs), r = right.cps(nowMs); long k = Perf.key(l, r, 0); if (e.text.stale(k)) e.text.set(k, HudKit.cps(l, r, e.b("showRight"), e.style)); return one(e); }
            case "clock": { LocalTime t = LocalTime.now(); boolean sec = e.s("seconds").equals("true"); long k = sec ? t.toSecondOfDay() : t.toSecondOfDay() / 60;
                if (e.text.stale(k)) e.text.set(k, Calc.clock(t.getHour(), t.getMinute(), t.getSecond(), e.b("h24"), sec)); return one(e); }
            case "ping": { int ms = -1; if (mc.getSingleplayerServer() == null && mc.getConnection() != null) { PlayerInfo p = mc.getConnection().getPlayerInfo(mc.player.getUUID()); if (p != null && p.getLatency() > 0) ms = p.getLatency(); }
                if (e.text.stale(ms)) e.text.set(ms, HudKit.ping(ms)); return one(e); }
            case "brandinghud": { if (e.text.stale(1)) e.text.set(1, "Auroras Client"); return one(e); }
            case "sessioninfo": { long secs = (nowMs - sessionStart) / 1000; long k = e.b("showDuration") ? secs : 0;
                if (e.text.stale(k)) { ServerData sd = mc.getCurrentServer(); String srv = sd != null ? sd.ip : null;
                    e.text.set(k, HudKit.sessionInfo(AurorasClient.mcVersion, "Fabric", instanceName, srv, nowMs - sessionStart, e.b("showVersion"), e.b("showLoader"), e.b("showInstance"), e.b("showServer"), e.b("showDuration"))); } return one(e); }
            case "spotify": { NowPlaying.Snap n = NowPlaying.current; long k = n == null ? -1 : n.version() * 1000 + (e.b("showProgress") ? (n.progressNow(nowMs) / 1000) : 0);
                if (e.text.stale(k)) e.text.set(k, n == null ? HudKit.spotify(null, null, false, 0, 0, false, "not connected") : HudKit.spotify(n.title(), n.artist(), n.playing(), n.progressNow(nowMs), n.durationMs(), e.b("showProgress"), n.status())); return one(e); }
            case "target": { Entity t = mc.crosshairPickEntity; if (!(t instanceof LivingEntity le)) return null;
                double dist = mc.player.distanceTo(t); long k = Perf.key(t.getId(), Math.round(le.getHealth() * 2), e.b("showDistance") ? Math.round(dist * 10) : 0);
                if (e.text.stale(k)) e.text.set(k, HudKit.target(t.getDisplayName().getString(), le.getHealth(), le.getMaxHealth(), dist, e.b("showHealth"), e.b("showDistance"))); return one(e); }
            case "potions": { if (!slow && e.lines.length > 0) return e.lines;
                Collection<MobEffectInstance> fx = mc.player.getActiveEffects(); if (fx.isEmpty()) { e.lines = new String[0]; return null; }
                String[] names = new String[fx.size()]; int[] ticks = new int[fx.size()]; int[] amp = new int[fx.size()]; Identifier[] icons = new Identifier[fx.size()]; int n = 0;
                for (MobEffectInstance s : fx) { names[n] = s.getEffect().value().getDisplayName().getString(); ticks[n] = s.isInfiniteDuration() ? -1 : s.getDuration(); amp[n] = s.getAmplifier();
                    icons[n] = s.getEffect().unwrapKey().map(x -> x.identifier().withPrefix("mob_effect/")).orElse(null); n++; } // the GUI sprite vanilla's inventory uses
                int[] order = HudKit.potionOrder(names, ticks, e.s("order")); String[] out = new String[n]; Identifier[] ic = new Identifier[n];
                for (int i = 0; i < n; i++) { int j = order[i]; out[i] = HudKit.potionName(names[j], amp[j]) + "  " + HudKit.potionTime(ticks[j]); ic[i] = icons[j]; }
                POTION_ICONS = ic; return out; }
            case "armor": { if (!slow && e.lines.length > 0) return e.lines; String f = e.s("format"); List<String> out = new ArrayList<>();
                for (EquipmentSlot slot : new EquipmentSlot[]{EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET}) addDur(out, mc.player.getItemBySlot(slot), f);
                if (e.b("showHeld")) addDur(out, mc.player.getMainHandItem(), f);
                if (out.isEmpty()) return null; return e.s("layout").equals("horizontal") ? new String[]{String.join("   ", out)} : out.toArray(new String[0]); }
            case "modulelist": { if (!slow && e.lines.length > 0) return e.lines; List<HudKit.Entry> en = new ArrayList<>(); Map<String, Integer> idx = new HashMap<>(); int k = 0;
                if (LIST_IN.length != AurorasClient.REG.modules().size()) LIST_IN = new double[AurorasClient.REG.modules().size()];
                for (Config.Module m : AurorasClient.REG.modules()) { idx.put(m.id(), k); if (!m.id().equals("modulelist") && AurorasClient.PM.enabled(m.id())) en.add(new HudKit.Entry(m.id(), m.name(), m.cat().label, Gfx.width(m.name()))); else LIST_IN[k] = 0; k++; }
                List<HudKit.Entry> sorted = HudKit.moduleList(en, e.s("sort")); String[] out = new String[sorted.size()]; int[] li = new int[out.length];
                for (int i = 0; i < out.length; i++) { out[i] = sorted.get(i).name(); li[i] = idx.get(sorted.get(i).id()); } LIST_IDX = li; return out.length == 0 ? null : out; }
            case "direction": { float yaw = mc.player.getYRot(); boolean deg = e.b("showDegrees"), strip = e.s("display").equals("strip"); long k = GameLogic.heading(yaw) * 2L + (deg ? 1 : 0);
                if (e.text.stale(k)) e.text.set(k, strip ? GameLogic.compassStrip(yaw, 9) + (deg ? "  " + GameLogic.heading(yaw) + "°" : "") : GameLogic.direction(yaw, deg)); return one(e); }
            case "freelookstatus": { boolean on = AurorasModules.freelook(); if (!on && !editingNow) return null; if (e.text.stale(1)) e.text.set(1, "Freelook"); return one(e); }
            case "session": { if (!slow && e.lines.length > 0) return e.lines; List<String> l = AurorasModules.SESSION.lines(nowMs, e.b("showPlaytime"), e.b("showDistance"), e.b("showBlocks"), e.b("showDeaths")); return l.toArray(new String[0]); }
            case "serverinfo": { if (!slow && e.lines.length > 0) return e.lines; ServerData entry = mc.getCurrentServer(); String addr = mc.getSingleplayerServer() != null || entry == null ? null : entry.ip;
                int players = mc.getConnection() != null ? mc.getConnection().getOnlinePlayers().size() : -1, ping = -1;
                if (addr != null && mc.getConnection() != null) { PlayerInfo p = mc.getConnection().getPlayerInfo(mc.player.getUUID()); if (p != null) ping = p.getLatency(); }
                String ver = entry != null && entry.version != null ? entry.version.getString() : null;
                return GameLogic.serverInfo(addr, players, ping, ver, e.b("showAddress"), e.b("showPlayers"), e.b("showPing"), e.b("showVersion")).toArray(new String[0]); }
            case "frametime": { long k = Math.round(AurorasClient.FPS_SMOOTH.frameTimeMs() * 10); if (e.text.stale(k)) e.text.set(k, String.format(Locale.ROOT, "Frame %.1f ms · worst %.1f ms", AurorasClient.FPS_SMOOTH.frameTimeMs(), FRAMES.worst(60))); return one(e); }
            case "memory": { if (!slow && e.lines.length > 0) return e.lines; long u = Perf.usedMemoryBytes(), m = Perf.maxMemoryBytes(); long k = Perf.key(u >> 20, m >> 20, e.b("showBar") ? 1 : 0);
                if (e.text.stale(k)) e.text.set(k, GameLogic.memory(u, m, e.b("showBar"))); return one(e); }
            case "biome": { if (!slow && e.lines.length > 0) return e.lines; if (mc.level == null) return null;
                String b = mc.level.getBiome(mc.player.blockPosition()).unwrapKey().map(x -> x.identifier().toString()).orElse(null), dim = mc.level.dimension().identifier().toString();
                long k = Perf.key(b == null ? 0 : b.hashCode(), dim.hashCode(), e.b("showDimension") ? 1 : 0); if (e.text.stale(k)) e.text.set(k, GameLogic.biome(b, dim, e.b("showDimension"))); return one(e); }
            default: return null;
        }
    }
    /** The Auroras logo: the app icon, 32 px at scale 1. */
    static void logo(Gfx ctx, El e, int sw, int sh, double fade) {
        e.w = Hud.scaled(32, e.scale); e.h = e.w; Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        ctx.texture(LOGO, e.pos[0], e.pos[1], e.w, e.h, HudKit.argb(0xFFFFFF, e.opacity, fade));
    }
    /** Frame time text plus a bar graph of recent frames (green at 60 fps or better, yellow to 30, red below). */
    static void frametime(Gfx ctx, Minecraft mc, El e, int sw, int sh, double fade) {
        String[] lines = content(mc, e, System.currentTimeMillis(), false); e.lines = lines; int gw = e.i("graphWidth"), gh = 20, px = e.style.padX, py = e.style.padY;
        int bw = Math.max(gw, Gfx.width(lines[0])) + px * 2, bh = 9 + 3 + gh + py * 2; e.w = Hud.scaled(bw, e.scale); e.h = Hud.scaled(bh, e.scale);
        Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        ctx.push(); ctx.translate(e.pos[0], e.pos[1]); ctx.scale(e.scale);
        panel(ctx, e, bw, bh, fade);
        text(ctx, e, lines[0], px, py, e.color, fade);
        int n = FRAMES.heights(gw, gh, BARS), base = py + 12 + gh;
        for (int k = 0; k < n; k++) { int h = Math.max(1, BARS[k]), x = px + gw - n + k; ctx.fill(x, base - h, x + 1, base, HudKit.argb(GameLogic.FrameGraph.color(BARS[k], gh), e.opacity, fade)); }
        ctx.pop();
    }
    static void addDur(List<String> out, ItemStack st, String format) {
        if (st.isEmpty() || !st.isDamageableItem()) return; String d = HudKit.durability(st.getMaxDamage(), st.getDamageValue(), format.equals("bar") ? "percent" : format);
        out.add(st.getHoverName().getString() + "  " + d);
    }
    static String[] one(El e) { String[] a = e.lines.length == 1 ? e.lines : new String[1]; a[0] = e.text.text(); return a; }

    /** Places and draws a text element in its style. Editor and gameplay use the same path. */
    static void draw(Gfx ctx, Minecraft mc, El e, String[] lines, int sw, int sh, double fade) {
        int icon = e.id.equals("potions") && e.b("showIcons") ? 11 : 0, tw = 0; for (String l : lines) tw = Math.max(tw, Gfx.width(l) + icon);
        String label = e.style.label ? e.mod.name().toUpperCase(Locale.ROOT) : null; int th = lines.length * 10 - 1 + (label != null ? 7 : 0);
        int[] b = HudKit.box(e.style, Math.max(tw, label != null ? (int) (Gfx.width(label) * 0.75f) : 0), th);
        e.w = Hud.scaled(b[0], e.scale); e.h = Hud.scaled(b[1], e.scale); Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        ctx.push(); ctx.translate(e.pos[0], e.pos[1]); ctx.scale(e.scale);
        panel(ctx, e, b[0], b[1], fade);
        if (e.style.accent > 0) { int r = HudKit.fitRadius(e.radius, b[0], b[1]); ctx.fill(0, r, e.style.accent, b[1] - r, HudKit.argb(e.accent, e.opacity, fade)); }
        int y = e.style.padY;
        if (label != null) { ctx.push(); ctx.translate(e.style.padX + e.style.accent, y); ctx.scale(0.75f); ctx.text(label, 0, 0, HudKit.argb(e.accent, 90 * e.opacity / 100, fade), false); ctx.pop(); y += 7; }
        boolean list = e.id.equals("modulelist"), right = list && e.s("align").equals("right"), slide = list && e.b("animate") && !editingNow;
        for (int i = 0; i < lines.length; i++) {
            int lw = Gfx.width(lines[i]), x = (right ? b[0] - e.style.padX - lw : e.style.padX + e.style.accent) + icon; double f = fade;
            if (slide && i < LIST_IDX.length) { int k = LIST_IDX[i]; double in = LIST_IN[k] = AurorasModules.reducedMotion() ? 1 : Math.min(1, LIST_IN[k] + frameDt / 0.2); f = fade * in; x += (int) Math.round((1 - in) * (right ? 12 : -12)); }
            if (icon > 0 && i < POTION_ICONS.length && POTION_ICONS[i] != null) ctx.sprite(POTION_ICONS[i], x - icon, y - 1, 9, 9, HudKit.argb(0xFFFFFF, e.opacity, fade));
            if (e.id.equals("ping")) { int lvl = HudKit.pingLevel(parsePing(lines[i]), e.i("goodMs"), e.i("okMs")); ctx.text(lines[i], x, y, HudKit.argb(HudKit.PING_COLORS[lvl < 0 ? 3 : lvl], e.opacity, fade), e.shadow); }
            else text(ctx, e, lines[i], x, y, list && i % 2 == 0 && !HudKit.perChar(e.textMode) ? e.accent : e.color, f);
            y += 10;
        }
        ctx.pop();
    }
    static int parsePing(String s) { try { return Integer.parseInt(s.replaceAll("[^0-9]", "")); } catch (NumberFormatException x) { return -1; } }

    /** Background and border of an element, rounded by its corner radius. Coordinates are the element's own (after translate and scale). */
    static void panel(Gfx ctx, El e, int w, int h, double fade) {
        if (e.bg) { int c = HudKit.argb(e.bgColor, e.bgPct * e.opacity / 100, fade), n = HudKit.roundRect(w, h, e.radius, RECTS); for (int k = 0; k < n * 4; k += 4) ctx.fill(RECTS[k], RECTS[k + 1], RECTS[k + 2], RECTS[k + 3], c); }
        if (e.border) outline(ctx, 0, 0, w, h, e.radius, HudKit.argb(e.accent, 55 * e.opacity / 100, fade));
    }
    static void rounded(Gfx ctx, int x, int y, int w, int h, int r, int argb) { int n = HudKit.roundRect(w, h, r, RECTS); for (int k = 0; k < n * 4; k += 4) ctx.fill(x + RECTS[k], y + RECTS[k + 1], x + RECTS[k + 2], y + RECTS[k + 3], argb); }
    static void outline(Gfx ctx, int x, int y, int w, int h, int r, int argb) { int n = HudKit.roundOutline(w, h, r, RECTS); for (int k = 0; k < n * 4; k += 4) ctx.fill(x + RECTS[k], y + RECTS[k + 1], x + RECTS[k + 2], y + RECTS[k + 3], argb); }
    /** Text in the element's colour mode: one string when solid, coloured character by character for chroma and gradient. */
    static void text(Gfx ctx, El e, String s, int x, int y, int rgb, double fade) { text(ctx, e, s, x, y, rgb, fade, 0, 0); }
    /** blendTo / blend: mixes the colour toward blendTo by blend (0..1), used for pressed keys. */
    static void text(Gfx ctx, El e, String s, int x, int y, int rgb, double fade, int blendTo, double blend) {
        if (!HudKit.perChar(e.textMode)) { ctx.text(s, x, y, HudKit.argb(blend > 0 ? mix(rgb, blendTo, blend) : rgb, e.opacity, fade), e.shadow); return; }
        int cx = x, base = e.pos[0];
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i), n = Character.charCount(cp); String ch = cp < 128 ? CH[cp] : s.substring(i, i + n); i += n;
            int c = HudKit.textColor(e.textMode, rgb, e.accent, base + cx, seconds, e.chromaSpeed); if (blend > 0) c = mix(c, blendTo, blend);
            ctx.text(ch, cx, y, HudKit.argb(c, e.opacity, fade), e.shadow); cx += Gfx.width(ch);
        }
    }

    /**
     * Keystrokes: layout from core Keystrokes (key size, gap and rows are settings), labels from the player's own key binds
     * (refreshed once a second, so rebinding shows up), press lights the key at once and the release fades over fadeMs.
     */
    static void keystrokes(Gfx ctx, Minecraft mc, El e, int sw, int sh, double dt, double fade) {
        Keystrokes.Layout lay = e.keys; if (lay == null) return; int px = e.style.padX, py = e.style.padY;
        int bw = lay.w() + px * 2, bh = lay.h() + py * 2; e.w = Hud.scaled(bw, e.scale); e.h = Hud.scaled(bh, e.scale);
        Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        var o = mc.options; if (KEY_MAPS == null) KEY_MAPS = new net.minecraft.client.KeyMapping[]{o.keyUp, o.keyLeft, o.keyDown, o.keyRight, o.keyAttack, o.keyUse, o.keyJump, o.keyShift, o.keySprint}; var maps = KEY_MAPS;
        String mode = e.s("labels"), ss = e.s("spaceStyle");
        if (KEY_NAMES_GATE.due(System.nanoTime()) || KEY_NAMES[0] == null) for (int k = 0; k < maps.length; k++) KEY_NAMES[k] = maps[k].getTranslatedKeyMessage().getString();
        double fadeS = e.b("animate") ? e.i("fadeMs") / 1000.0 : 0; int pressedPct = e.i("pressedOpacity"), pressedText = Integer.parseInt(e.s("pressedText"), 16); boolean cps = e.b("showCps"); long now = System.currentTimeMillis();
        ctx.push(); ctx.translate(e.pos[0], e.pos[1]); ctx.scale(e.scale);
        for (Keystrokes.Key k : lay.keys()) {
            int in = k.input(); double g = KEY_GLOW[in] = HudKit.keyGlow(KEY_GLOW[in], maps[in].isDown(), dt, fadeS);
            int x = px + k.x(), y = py + k.y(), restPct = e.bg ? e.bgPct : 0, pct = (int) Math.round(restPct + (pressedPct - restPct) * g);
            if (pct > 0) rounded(ctx, x, y, k.w(), k.h(), e.radius, HudKit.argb(mix(e.bgColor, e.accent, g), pct * e.opacity / 100, fade));
            if (e.border) outline(ctx, x, y, k.w(), k.h(), e.radius, HudKit.argb(e.accent, 55 * e.opacity / 100, fade));
            if (in == Keystrokes.JUMP && !"text".equals(ss)) { int lw = Math.max(4, k.w() * 2 / 5), lh = k.h() >= 12 ? 2 : 1; int c = HudKit.argb(mix(e.color, pressedText, g), e.opacity, fade);
                ctx.fill(x + (k.w() - lw) / 2, y + (k.h() - lh) / 2, x + (k.w() + lw) / 2, y + (k.h() + lh) / 2, c); continue; }
            String label = Keystrokes.label(mode, in, KEY_NAMES[in], ss);
            boolean second = cps && (in == Keystrokes.ATTACK || in == Keystrokes.USE) && Keystrokes.cpsLine(k.h());
            String sub = !cps || (in != Keystrokes.ATTACK && in != Keystrokes.USE) ? null : (in == Keystrokes.ATTACK ? left : right).cps(now) + " CPS";
            if (sub != null && !second) { label = sub; sub = null; }
            float sc = Keystrokes.fitScale(Gfx.width(label), k.w()); int th = Math.round(8 * sc) + (sub != null ? 7 : 0), ty = y + (k.h() - th + 1) / 2;
            ctx.push(); ctx.translate(x + (k.w() - Gfx.width(label) * sc) / 2f, ty); ctx.scale(sc); text(ctx, e, label, 0, 0, e.color, fade, pressedText, g); ctx.pop();
            if (sub != null) { float s2 = Math.min(0.75f, Keystrokes.fitScale(Gfx.width(sub), k.w())); ctx.push(); ctx.translate(x + (k.w() - Gfx.width(sub) * s2) / 2f, ty + Math.round(8 * sc) + 1); ctx.scale(s2);
                text(ctx, e, sub, 0, 0, mix(e.color, e.bgColor, 0.25), fade, pressedText, g); ctx.pop(); }
        }
        ctx.pop();
    }
    static int mix(int a, int b, double t) { return Sky.mix(a, b, t); }
}
