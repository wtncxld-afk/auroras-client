package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Draws every HUD element with the shared HudKit styles and the same placement maths
// as the launcher's HUD editor (Hud.resolveInto). Written against Mojang's names without the game jars; expect small fixes.
//
// Performance: element settings are parsed only when the profile revision changes; text is rebuilt only when its numbers
// change (Perf.CachedText); slow sources (ping, potions, armor, memory) refresh on a 250 ms gate; disabled elements cost a
// boolean check; nothing touches the disk or network here (Spotify is read by a background thread in NowPlaying).

import gg.auroras.core.*;
import gg.auroras.client.platform.Gfx;
import gg.auroras.client.ui.HudArt;
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
        String[] measured; double measuredSize, measuredW; final Perf.CachedText text = new Perf.CachedText(); final HudKit.Fade fade = new HudKit.Fade(); final int[] pos = new int[2]; int w, h; String[] lines = new String[0];
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
    static final long T0 = System.nanoTime(); static double seconds;
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
        String[] lines = content(mc, e, System.currentTimeMillis(), false); e.lines = lines; int gw = e.i("graphWidth"), gh = 20; HudSkin.Card cd = HudSkin.card(e.style);
        double tw = Math.max(gw, measure(e, lines, cd.text())); int bw = (int) Math.ceil(tw + cd.padX() * 2), bh = (int) Math.ceil(cd.text() + 4 + gh + cd.padY() * 2);
        e.w = Hud.scaled(bw, e.scale); e.h = Hud.scaled(bh, e.scale); Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        HudArt.Look l = look(e, fade); HudArt.card(ctx, l, bw, bh);
        HudArt.text(ctx, l, cd.text(), lines[0], cd.padX(), cd.padY(), e.color);
        int n = FRAMES.heights(gw, gh, BARS); double base = cd.padY() + cd.text() + 4 + gh, x0 = cd.padX() + (tw - gw);
        HudArt.rect(ctx, l, x0, base - gh, gw, gh, 1.5, l.a(0xFFFFFF, 4));
        for (int k = 0; k < n; k++) { int h = Math.max(1, BARS[k]); HudArt.rect(ctx, l, x0 + gw - n + k, base - h, 1, h, 0, HudKit.argb(GameLogic.FrameGraph.color(BARS[k], gh), e.opacity, fade)); }
    }
    static void addDur(List<String> out, ItemStack st, String format) {
        if (st.isEmpty() || !st.isDamageableItem()) return; String d = HudKit.durability(st.getMaxDamage(), st.getDamageValue(), format.equals("bar") ? "percent" : format);
        out.add(st.getHoverName().getString() + "  " + d);
    }
    static String[] one(El e) { String[] a = e.lines.length == 1 ? e.lines : new String[1]; a[0] = e.text.text(); return a; }

    /** The shared look for the widget being drawn (one instance, refilled per widget, so drawing allocates nothing). */
    static final HudArt.Look LOOK = new HudArt.Look();
    static HudArt.Look look(El e, double fade) {
        HudArt.Look l = LOOK; l.ox = e.pos[0]; l.oy = e.pos[1]; l.k = e.scale; l.fade = fade; l.color = e.color; l.accent = e.accent; l.bgColor = e.bgColor; l.bgPct = e.bgPct;
        l.opacity = e.opacity; l.radius = e.radius; l.bg = e.bg; l.border = e.border; l.shadow = e.shadow; l.textMode = e.textMode; l.chromaSpeed = e.chromaSpeed; l.seconds = seconds; return l;
    }
    /** Widest line in GUI units, measured again only when a line's text changes (the formatters reuse cached strings). */
    static double measure(El e, String[] lines, double size) {
        boolean same = e.measured != null && e.measured.length == lines.length && e.measuredSize == size;
        if (same) for (int i = 0; i < lines.length; i++) if (e.measured[i] != lines[i]) { same = false; break; }
        if (same) return e.measuredW;
        double w = 0; for (String s : lines) w = Math.max(w, HudArt.width(size, s)); e.measured = lines.clone(); e.measuredSize = size; return e.measuredW = w;
    }

    /** Places and draws a text widget: a glass card, the expanded style's icon chip and label, then each line. Editor and gameplay use the same path. */
    static void draw(Gfx ctx, Minecraft mc, El e, String[] lines, int sw, int sh, double fade) {
        HudSkin.Card cd = HudSkin.card(e.style); boolean potIcons = e.id.equals("potions") && e.b("showIcons"); double icon = potIcons ? cd.text() + 3 : 0, tw = measure(e, lines, cd.text()) + icon;
        String label = e.style.label ? e.mod.name().toUpperCase(Locale.ROOT) : null; double lw = label != null ? HudArt.labelWidth(cd.label(), label) : 0; boolean chip = cd.icon() > 0;
        int[] b = HudSkin.size(cd, tw, lines.length, lw, chip);
        e.w = Hud.scaled(b[0], e.scale); e.h = Hud.scaled(b[1], e.scale); Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        HudArt.Look l = look(e, fade); double[] at = HudArt.body(ctx, l, cd, b, HudSkin.icon(e.id), label, lines.length); double x0 = at[0], y = at[1];
        boolean list = e.id.equals("modulelist"), right = list && e.s("align").equals("right"), slide = list && e.b("animate") && !editingNow;
        for (int i = 0; i < lines.length; i++) {
            double lwid = right ? HudArt.width(cd.text(), lines[i]) : 0, x = (right ? b[0] - cd.padX() - lwid : x0) + (right ? 0 : icon), f = 1;
            if (slide && i < LIST_IDX.length) { int k = LIST_IDX[i]; double in = LIST_IN[k] = AurorasModules.reducedMotion() ? 1 : Math.min(1, LIST_IN[k] + frameDt / 0.2); double ease = 1 - (1 - in) * (1 - in); f = ease; x += (1 - ease) * (right ? 12 : -12); }
            if (icon > 0 && i < POTION_ICONS.length && POTION_ICONS[i] != null) { double s = cd.text() + 1; ctx.sprite(POTION_ICONS[i], (int) Math.round(l.X(x - icon)), (int) Math.round(l.Y(y - 0.5)), (int) Math.round(s * l.k), (int) Math.round(s * l.k), HudKit.argb(0xFFFFFF, e.opacity, fade)); }
            int rgb = e.id.equals("ping") ? HudKit.PING_COLORS[pingLvl(e, lines[i])] : list && i % 2 == 0 && !HudKit.perChar(e.textMode) ? e.accent : e.color;
            if (e.id.equals("ping")) { String mode = l.textMode; l.textMode = "solid"; HudArt.text(ctx, l, cd.text(), lines[i], x, y, rgb, f, 0, 0); l.textMode = mode; }
            else HudArt.text(ctx, l, cd.text(), lines[i], x, y, rgb, f, 0, 0);
            y += cd.line();
        }
    }
    static int pingLvl(El e, String s) { int lvl = HudKit.pingLevel(parsePing(s), e.i("goodMs"), e.i("okMs")); return lvl < 0 ? 3 : lvl; }
    static int parsePing(String s) { try { return Integer.parseInt(s.replaceAll("[^0-9]", "")); } catch (NumberFormatException x) { return -1; } }

    /** Background and border of a widget of w x h GUI units (at scale 1), at the widget's position. */
    static void panel(Gfx ctx, El e, int w, int h, double fade) { HudArt.card(ctx, look(e, fade), w, h); }

    /**
     * Keystrokes: layout from core Keystrokes (key size, gap and rows are settings), labels from the player's own key binds
     * (refreshed once a second, so rebinding shows up), press lights the key at once and the release fades over fadeMs.
     */
    /**
     * Keystrokes: layout from core Keystrokes (key size, gap and rows are settings), labels from the player's own key binds
     * (refreshed once a second, so rebinding shows up), press lights the key at once and the release fades over fadeMs.
     * Key style: glass keys, creamy keycaps or the classic flat boxes (HudArt).
     */
    static void keystrokes(Gfx ctx, Minecraft mc, El e, int sw, int sh, double dt, double fade) {
        Keystrokes.Layout lay = e.keys; if (lay == null) return; String style = e.s("keyStyle"); int pad = HudSkin.CREAMY.equals(style) ? 3 : 2;
        int bw = lay.w() + pad * 2, bh = lay.h() + pad * 2; e.w = Hud.scaled(bw, e.scale); e.h = Hud.scaled(bh, e.scale);
        Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        var o = mc.options; if (KEY_MAPS == null) KEY_MAPS = new net.minecraft.client.KeyMapping[]{o.keyUp, o.keyLeft, o.keyDown, o.keyRight, o.keyAttack, o.keyUse, o.keyJump, o.keyShift, o.keySprint}; var maps = KEY_MAPS;
        String mode = e.s("labels"), ss = e.s("spaceStyle");
        if (KEY_NAMES_GATE.due(System.nanoTime()) || KEY_NAMES[0] == null) for (int k = 0; k < maps.length; k++) KEY_NAMES[k] = maps[k].getTranslatedKeyMessage().getString();
        double fadeS = e.b("animate") ? e.i("fadeMs") / 1000.0 : 0; int pressedPct = e.i("pressedOpacity"), pressedText = Integer.parseInt(e.s("pressedText"), 16); boolean cps = e.b("showCps"); long now = System.currentTimeMillis();
        HudArt.Look l = look(e, fade);
        for (Keystrokes.Key k : lay.keys()) {
            int in = k.input(); double g = KEY_GLOW[in] = HudKit.keyGlow(KEY_GLOW[in], maps[in].isDown(), dt, fadeS);
            boolean bar = in == Keystrokes.JUMP && !"text".equals(ss);
            String label = bar ? "" : Keystrokes.label(mode, in, KEY_NAMES[in], ss), sub = null;
            if (cps && (in == Keystrokes.ATTACK || in == Keystrokes.USE)) { String c = cpsText(in == Keystrokes.ATTACK ? left.cps(now) : right.cps(now)); if (Keystrokes.cpsLine(k.h())) sub = c; else label = c; }
            HudArt.key(ctx, l, style, k, pad, pad, g, label, sub, bar, pressedPct, pressedText);
        }
    }
    /** "7 CPS", cached per value so the keystrokes widget doesn't build a string every frame. */
    static final String[] CPS_TEXT = new String[64];
    static String cpsText(int n) { if (n < 0 || n >= CPS_TEXT.length) return n + " CPS"; String s = CPS_TEXT[n]; return s != null ? s : (CPS_TEXT[n] = n + " CPS"); }
    static int mix(int a, int b, double t) { return Sky.mix(a, b, t); }
}
