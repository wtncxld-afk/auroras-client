package gg.auroras.core;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.regex.Pattern;

/** Module registry, validated settings and profiles. Modules that are not hooked up in-game are marked unavailable. */
public final class Config {
    private Config() {}
    /** visual = shown in the Visuals section of the menu. */
    public enum Category {
        HUD("HUD & Overlays", true), PLAYER("Player", false), VISUALS("Color & Rendering", true), INFORMATION("Information", false), COSMETICS("Cosmetics", true),
        SKY("World & Sky", true), TOTEMS("Totems", true), PLAYER_VISUALS("Player Visuals", true), PARTICLES("Particles & Effects", true), ANIMATIONS("Animations", true);
        public final String label; public final boolean visual;
        Category(String label, boolean visual) { this.label = label; this.visual = visual; }
    }
    /** What a module touches. Only COSMETIC modules are purely local drawing; the menu labels the others. */
    public enum Impact {
        COSMETIC("Cosmetic only: changes what you see, nothing else"), DISPLAY("Shows information on screen"), INPUT("Changes how your controls behave");
        public final String label; Impact(String label) { this.label = label; }
    }
    public enum Type { BOOL, INT, DOUBLE, COLOR, ENUM, KEY }
    public record SettingDef(String key, Type type, String def, double min, double max, List<String> options) {}
    public record Module(String id, String name, Category cat, Impact impact, boolean available, String note, List<SettingDef> settings) {
        public SettingDef setting(String key) { for (SettingDef s : settings) if (s.key().equals(key)) return s; return null; }
    }

    static SettingDef bool(String k, boolean d) { return new SettingDef(k, Type.BOOL, String.valueOf(d), 0, 0, List.of()); }
    static SettingDef integer(String k, int d, int lo, int hi) { return new SettingDef(k, Type.INT, String.valueOf(d), lo, hi, List.of()); }
    static SettingDef dbl(String k, double d, double lo, double hi) { return new SettingDef(k, Type.DOUBLE, String.valueOf(d), lo, hi, List.of()); }
    static SettingDef color(String k, String d) { return new SettingDef(k, Type.COLOR, d, 0, 0, List.of()); }
    static SettingDef key(String k, int d) { return new SettingDef(k, Type.KEY, String.valueOf(d), -1, 348, List.of()); }
    static SettingDef anchor(String k, String d) { return new SettingDef(k, Type.ENUM, d, 0, 0, Arrays.stream(Hud.Anchor.values()).map(Enum::name).toList()); }

    /** Settings every HUD element shares. */
    static List<SettingDef> hud(String anchor, int offY, SettingDef... extra) {
        List<SettingDef> l = new ArrayList<>(List.of(bool("enabled", false), anchor("anchor", anchor), integer("offX", anchor.endsWith("R") ? -4 : anchor.equals("TC") || anchor.equals("C") || anchor.equals("BC") ? 0 : 4, -4000, 4000), integer("offY", offY, -4000, 4000),
            dbl("scale", 1.0, 0.5, 3.0), color("color", "FFFFFF"), bool("shadow", true), bool("background", true), integer("bgOpacity", 45, 0, 100),
            new SettingDef("style", Type.ENUM, "minimal", 0, 0, List.of("minimal", "compact", "expanded")), color("accent", "6FE3FF"), bool("border", false), integer("opacity", 100, 10, 100),
            color("bgColor", "0C0F16"), integer("radius", 2, 0, HudKit.MAX_RADIUS), new SettingDef("textMode", Type.ENUM, "solid", 0, 0, List.of("solid", "chroma", "gradient")), dbl("chromaSpeed", 1.0, 0.1, 5.0)));
        l.addAll(Arrays.asList(extra)); return l;
    }
    static List<SettingDef> plain(SettingDef... s) { List<SettingDef> l = new ArrayList<>(List.of(bool("enabled", false))); l.addAll(Arrays.asList(s)); return l; }

    public static final class Registry {
        private final Map<String, Module> mods = new LinkedHashMap<>();
        private void add(String id, String name, Category c, boolean ok, String note, List<SettingDef> s) {
            Impact i = c == Category.PLAYER ? Impact.INPUT : c == Category.HUD || c == Category.INFORMATION ? Impact.DISPLAY : Impact.COSMETIC;
            mods.put(id, new Module(id, name, c, i, ok, note, s));
        }
        static SettingDef choice(String k, String d, List<String> opts) { return new SettingDef(k, Type.ENUM, d, 0, 0, List.copyOf(opts)); }
        static List<String> withOff(List<String> l) { List<String> o = new ArrayList<>(List.of("off")); o.addAll(l); return o; }
        public Registry() {
            String pending = "Logic is tested; in-game hookup is pending", none = "Not implemented yet", exp = "Experimental: written but not yet tested in a real game";
            add("fps", "FPS Counter", Category.HUD, true, exp, hud("TL", 20, bool("showFrameTime", false), bool("showAverage", false)));
            add("coords", "Coordinates", Category.HUD, true, exp, hud("TL", 36, integer("decimals", 1, 0, 3), bool("showX", true), bool("showY", true), bool("showZ", true), bool("showDirection", true), key("key", 67)));
            add("keystrokes", "Keystrokes", Category.HUD, true, exp, hud("BL", -24, bool("showMouse", true), bool("showCps", true), bool("showSpace", true), bool("showModifiers", false), bool("animate", true),
                integer("keySize", 18, 12, 32), integer("gap", 2, 0, 6), choice("labels", "bound", List.of("bound", "wasd", "arrows")), choice("spaceStyle", "bar", List.of("bar", "text")),
                integer("fadeMs", 120, 0, 600), color("pressedText", "06141F"), integer("pressedOpacity", 85, 10, 100)));
            add("cps", "CPS Counter", Category.HUD, true, exp, hud("TL", 52, integer("windowMs", 1000, 250, 5000), bool("showRight", true)));
            add("armor", "Armor Status", Category.HUD, true, exp, hud("BR", -24, choice("format", "percent", List.of("percent", "numeric", "bar")), bool("showHeld", true), choice("layout", "vertical", List.of("vertical", "horizontal"))));
            add("clock", "Clock", Category.HUD, true, exp, hud("TR", 4, bool("h24", true), bool("seconds", false)));
            add("ping", "Ping Display", Category.HUD, true, exp, hud("TL", 68, integer("goodMs", 80, 1, 2000), integer("okMs", 160, 1, 5000)));
            add("direction", "Direction HUD", Category.HUD, true, exp, hud("TC", 4, choice("display", "strip", List.of("letters", "strip")), bool("showDegrees", true)));
            add("potions", "Potion Effects", Category.HUD, true, exp, hud("TR", 20, choice("order", "duration", List.of("duration", "name")), bool("showIcons", true)));
            add("target", "Target Information", Category.HUD, true, exp, hud("TC", 30, bool("showHealth", true), bool("showDistance", false)));
            add("sessioninfo", "Session Information", Category.HUD, true, exp, hud("BL", -4, bool("showVersion", true), bool("showLoader", true), bool("showInstance", true), bool("showServer", false), bool("showDuration", true)));
            add("spotify", "Spotify", Category.HUD, true, exp + ". Needs Spotify connected in the launcher", hud("BR", -4, Registry.choice("layout", "expanded", List.of("compact", "expanded")), bool("showArt", true), bool("showProgress", true), bool("marquee", true)));
            add("modulelist", "Module List", Category.HUD, true, exp, hud("TR", 64, choice("align", "right", List.of("left", "right")), choice("sort", "length", List.of("length", "name", "category")), bool("animate", true)));
            add("brandinghud", "Client Branding", Category.HUD, true, exp, hud("TL", 4, bool("animate", false)));
            add("freelookstatus", "Freelook Status", Category.HUD, true, exp, hud("TC", 60));
            add("bossbar", "Boss Bar", Category.HUD, true, exp + ". Moves and scales Minecraft's own boss bars", plain(bool("hide", false), dbl("scale", 1.0, 0.5, 1.5), integer("offY", 0, -100, 200)));
            add("session", "Session Statistics", Category.HUD, true, exp + ". Counts what your client sees this session", hud("BR", -40, bool("showPlaytime", true), bool("showDistance", true), bool("showBlocks", true), bool("showDeaths", true)));
            add("zoom", "Zoom", Category.PLAYER, true, exp, plain(key("key", 90), dbl("factor", 4.0, 1.1, 10.0), dbl("smoothing", 0.25, 0.05, 1.0), bool("scaleSensitivity", true), bool("scrollAdjust", true)));
            add("sprint", "Toggle Sprint", Category.PLAYER, true, exp, plain(key("key", 82), bool("showStatus", true)));
            add("sneak", "Toggle Sneak", Category.PLAYER, true, exp, plain(key("key", 78), bool("showStatus", true)));
            add("freelook", "Freelook", Category.PLAYER, true, exp + ". Some servers don't allow freelook; check their rules", plain(key("key", 342), dbl("sensitivity", 1.0, 0.1, 3.0), choice("mode", "hold", List.of("hold", "toggle"))));
            add("perspective", "Perspective Controls", Category.PLAYER, true, exp, plain(key("frontKey", 86), bool("skipFront", false)));
            add("crosshair", "Crosshair Customizer", Category.VISUALS, true, exp, plain(choice("style", "cross", List.of("cross", "dot", "circle", "square")), integer("size", 5, 1, 30), integer("thickness", 1, 1, 6), integer("gap", 2, 0, 12), color("color", "FFFFFF"), integer("opacity", 100, 10, 100), bool("outline", true), bool("dot", false), bool("dynamic", false), bool("hideInThirdPerson", true)));
            add("hitcolor", "Hit Color", Category.VISUALS, true, exp + ". Applies after a game restart", plain(color("color", "FF0000"), integer("opacity", 70, 10, 100)));
            add("damage", "Damage Indicator", Category.VISUALS, false, none, plain());
            add("lowfire", "Low Fire", Category.VISUALS, true, exp, plain(dbl("height", 0.4, 0.0, 1.0), integer("opacity", 90, 10, 100)));
            add("particles", "Particle Settings", Category.VISUALS, true, exp, plain(dbl("multiplier", 1.0, 0.0, 1.0), bool("hideExplosions", false), bool("hideBlockBreak", false), bool("hideRain", false)));
            add("fullbright", "Fullbright", Category.VISUALS, true, exp + ". Some servers forbid fullbright; check their rules", plain(dbl("level", 1.0, 0.1, 1.0)));
            add("serverinfo", "Server Information", Category.INFORMATION, true, exp, hud("TL", 84, bool("showAddress", true), bool("showPlayers", true), bool("showPing", true), bool("showVersion", false)));
            add("frametime", "FPS and Frame Time", Category.INFORMATION, true, exp, hud("TL", 100, integer("graphWidth", 80, 40, 200), bool("showGraph", true)));
            add("memory", "Memory Usage", Category.INFORMATION, true, exp, hud("TL", 128, bool("showBar", false)));
            add("biome", "Biome Display", Category.INFORMATION, true, exp, hud("TL", 144, bool("showDimension", false)));
            add("logo", "Auroras Logo", Category.COSMETICS, true, exp, hud("TR", 40));
            add("cape", "Custom Capes", Category.COSMETICS, true, exp + ". Only you see this cape. It is never visible to other players, who see your Minecraft cape or none", plain(choice("design", "aurora", Cosmetics.CAPE_DESIGNS)));
            // Visuals
            add("sky", "Custom Skies", Category.SKY, true, exp, plain(choice("theme", "aurora", Sky.THEME_IDS), choice("netherTheme", "off", withOff(Sky.THEME_IDS)), choice("endTheme", "off", withOff(Sky.THEME_IDS)),
                dbl("brightness", 1.0, 0.2, 2.0), dbl("saturation", 1.0, 0.0, 2.0), dbl("contrast", 1.0, 0.5, 1.5), color("tint", "FFFFFF"), dbl("tintStrength", 0.0, 0.0, 1.0),
                dbl("starDensity", 1.0, 0.0, 3.0), dbl("starSize", 1.0, 0.5, 3.0), dbl("starBrightness", 1.0, 0.0, 2.0), dbl("twinkleSpeed", 1.0, 0.0, 3.0),
                bool("aurora", true), bool("nebula", true), bool("animate", true), dbl("sunSize", 1.0, 0.3, 3.0), dbl("moonSize", 1.0, 0.3, 3.0),
                dbl("animSpeed", 1.0, 0.0, 3.0), dbl("effectsOpacity", 1.0, 0.2, 1.0), dbl("shootingStars", 1.0, 0.0, 3.0), dbl("nebulaSpeed", 1.0, 0.0, 3.0), dbl("auroraWaves", 1.0, 0.0, 2.0),
                bool("clouds", true), bool("petals", true), bool("constellations", true), choice("skyQuality", "auto", List.of("auto", "LOW", "BALANCED", "HIGH"))));
            add("totemfx", "Totem Effects", Category.TOTEMS, true, exp + ". In game: colored particles and the screen flash. Scale and spin shape the Totem Studio preview; the floating totem keeps Minecraft's animation", plain(bool("particles", true), color("particleColor", "6FE3FF"), dbl("density", 1.0, 0.1, 3.0), dbl("duration", 1.5, 0.2, 5.0),
                bool("overlay", false), dbl("overlayIntensity", 0.4, 0.0, 1.0), dbl("overlayDuration", 0.8, 0.1, 3.0), dbl("scale", 1.0, 0.5, 2.0), dbl("spin", 1.0, 0.0, 3.0)));
            add("glow", "Player Glow", Category.PLAYER_VISUALS, true, exp + ". Outlines only your own player in third person", plain(color("color", "6FE3FF")));
            add("aura", "Cosmetic Aura", Category.PLAYER_VISUALS, false, none, plain(choice("style", "aurora", Particles.STYLE_IDS), color("color", "6FE3FF"), dbl("intensity", 0.5, 0.0, 1.0), integer("maxParticles", 48, 0, 512)));
            add("nameplate", "Nameplate Styling", Category.PLAYER_VISUALS, false, none, plain(color("color", "FFFFFF"), dbl("scale", 1.0, 0.5, 2.0), integer("bgOpacity", 25, 0, 100)));
            add("emblem", "Model Emblem", Category.PLAYER_VISUALS, false, none, plain(choice("position", "back", List.of("back", "chest", "shoulder"))));
            add("trails", "Cosmetic Trails", Category.PLAYER_VISUALS, false, none, plain(choice("style", "sakura", Particles.STYLE_IDS), color("color", "FFB7CF"), integer("maxParticles", 64, 0, 512), dbl("lifetime", 1.2, 0.2, 5.0)));
            add("particlefx", "Particle System", Category.PARTICLES, false, pending, plain(choice("style", "aurora", Particles.STYLE_IDS), color("color", "6FE3FF"), dbl("size", 1.0, 0.25, 4.0), dbl("opacity", 0.9, 0.05, 1.0),
                dbl("density", 1.0, 0.1, 3.0), dbl("lifetime", 1.5, 0.1, 10.0), dbl("spawnRate", 20.0, 0.0, 200.0), dbl("speed", 1.0, 0.1, 3.0), integer("maxDistance", 32, 4, 128), integer("maxCount", 256, 0, 4096),
                bool("ambient", true), bool("events", true), bool("autoReduce", true), bool("reducedMotion", false)));
            add("menuanim", "Menu Animations", Category.ANIMATIONS, true, exp + ". Applies to the Auroras menus", plain(dbl("speed", 1.0, 0.25, 2.0), bool("reducedMotion", false)));
            add("emotes", "Emotes", Category.COSMETICS, true, exp + ". Only you see your emotes: nothing is sent to servers or other players", plain(key("wheelKey", 66), dbl("speed", 1.0, 0.25, 3.0), dbl("blend", 0.2, 0.0, 1.0), bool("cancelOnMove", true), bool("thirdPerson", true)));
        }
        /**
         * Marks modules as not available in this build (an adapter for a Minecraft version where a feature isn't ported
         * yet), with the reason the menu shows. Settings are kept, so they come back when the feature does.
         */
        public void restrict(Collection<String> ids, String note) {
            for (String id : ids) { Module m = mods.get(id); if (m != null) mods.put(id, new Module(m.id(), m.name(), m.cat(), m.impact(), false, note, m.settings())); }
        }
        public Collection<Module> modules() { return mods.values(); }
        public Module get(String id) { return mods.get(id); }
        public static final String GUI_KEY = "settings.guiKey", QUALITY = "settings.quality";
        private static final Pattern HEX = Pattern.compile("[0-9A-Fa-f]{6}");
        /** Plain decimal numbers only (no exponents, suffixes or spaces), so the launcher can apply exactly the same rule. */
        private static final Pattern INTEGER = Pattern.compile("-?\\d{1,9}"), DECIMAL = Pattern.compile("-?\\d{1,9}(\\.\\d{1,12})?");
        /** Returns null when the key/value pair is valid, otherwise a human-readable error. */
        public String validate(String fullKey, String v) {
            if (v == null || v.length() > 64 || v.contains("\n") || v.contains("\r")) return "bad value";
            if (fullKey.equals(QUALITY)) return Quality.parse(v) != null ? null : "quality must be LOW, BALANCED or HIGH";
            if (fullKey.equals(GUI_KEY)) return v.matches("-?\\d{1,3}") && Integer.parseInt(v) >= 0 && Integer.parseInt(v) <= 348 ? null : "bad key code";
            int dot = fullKey.indexOf('.'); if (dot < 1) return "unknown key " + fullKey;
            Module m = mods.get(fullKey.substring(0, dot)); if (m == null) return "unknown module in " + fullKey;
            SettingDef d = m.setting(fullKey.substring(dot + 1)); if (d == null) return "unknown setting " + fullKey;
            try {
                switch (d.type()) {
                    case BOOL: return v.equals("true") || v.equals("false") ? null : fullKey + " must be true or false";
                    case INT: case KEY: { if (!INTEGER.matcher(v).matches()) return fullKey + " is not a number"; int n = Integer.parseInt(v); return n >= d.min() && n <= d.max() ? null : fullKey + " out of range"; }
                    case DOUBLE: { if (!DECIMAL.matcher(v).matches()) return fullKey + " is not a number"; double n = Double.parseDouble(v); return n >= d.min() && n <= d.max() ? null : fullKey + " out of range"; }
                    case COLOR: return HEX.matcher(v).matches() ? null : fullKey + " must be a 6-digit hex colour";
                    default: return d.options().contains(v) ? null : fullKey + " has an unknown option";
                }
            } catch (NumberFormatException e) { return fullKey + " is not a number"; }
        }
        public Map<String, String> defaults() {
            Map<String, String> m = new TreeMap<>(); m.put(GUI_KEY, "344"); m.put(QUALITY, "BALANCED");
            for (Module mod : mods.values()) for (SettingDef s : mod.settings()) m.put(mod.id() + "." + s.key(), s.def());
            return m;
        }
    }

    public static final class Profile {
        public final String name; public final Map<String, String> values = new TreeMap<>();
        Profile(String name) { this.name = name; }
    }

    public static final class ProfileManager {
        public static final List<String> BUILT_IN = List.of("Default", "Minimal HUD", "Competitive", "Casual");
        private static final Pattern NAME = Pattern.compile("[A-Za-z0-9][A-Za-z0-9 ._-]{0,31}");
        private final Registry reg; private final Map<String, Profile> profiles = new LinkedHashMap<>(); private String active = "Default"; private int revision;
        /** Bumps on every change, so renderers can re-parse settings only when something changed. */
        public int revision() { return revision; }
        public ProfileManager(Registry reg) {
            this.reg = reg;
            for (String n : BUILT_IN) profiles.put(n, fresh(n));
            on("Minimal HUD", "fps"); on("Competitive", "fps", "cps", "keystrokes"); on("Casual", "fps", "coords", "clock");
        }
        private Profile fresh(String n) { Profile p = new Profile(n); p.values.putAll(reg.defaults()); return p; }
        private void on(String profile, String... ids) { for (String i : ids) profiles.get(profile).values.put(i + ".enabled", "true"); }
        private void checkName(String n) { if (n == null || !NAME.matcher(n).matches()) throw new IllegalArgumentException("Profile names are 1-32 letters, numbers, spaces, dots, dashes or underscores"); }
        public List<String> names() { return new ArrayList<>(profiles.keySet()); }
        public String active() { return active; }
        // ----- per-server and per-world profiles -----
        private static final Pattern PLACE = Pattern.compile("(server|world):[A-Za-z0-9._ -]{1,64}");
        private final Map<String, String> places = new TreeMap<>(); private String placeOverride;
        /** "server:play.example.net" (lower-case, default port removed) or "world:My World"; null when neither is known. */
        public static String placeKey(String serverAddress, String worldName) {
            if (serverAddress != null && !serverAddress.isBlank()) { String a = serverAddress.trim().toLowerCase(Locale.ROOT); if (a.endsWith(":25565")) a = a.substring(0, a.length() - 6); while (a.endsWith(".")) a = a.substring(0, a.length() - 1); return "server:" + a; }
            if (worldName != null && !worldName.isBlank()) return "world:" + worldName.trim();
            return null;
        }
        public void assign(String place, String profile) {
            if (place == null || !PLACE.matcher(place).matches()) throw new IllegalArgumentException("Not a valid server or world");
            if (!profiles.containsKey(profile)) throw new IllegalArgumentException("No such profile"); places.put(place, profile); revision++;
        }
        public void unassign(String place) { if (places.remove(place) != null) revision++; }
        public Map<String, String> assignments() { return Collections.unmodifiableMap(places); }
        /** Called on joining a server or world: its assigned profile is used until leavePlace(). The saved default profile is unchanged. */
        public void enterPlace(String place) { String p = place == null ? null : places.get(place); placeOverride = p != null && profiles.containsKey(p) ? p : null; revision++; }
        public void leavePlace() { placeOverride = null; revision++; }
        /** The profile settings currently come from. */
        public String current() { return placeOverride != null ? placeOverride : active; }
        public void switchTo(String n) { revision++; if (!profiles.containsKey(n)) throw new IllegalArgumentException("No such profile"); active = n; }
        public Profile create(String n) { revision++; checkName(n); if (profiles.containsKey(n)) throw new IllegalArgumentException("Name already used"); Profile p = fresh(n); profiles.put(n, p); return p; }
        public Profile duplicate(String src, String n) { revision++; checkName(n); if (!profiles.containsKey(src) || profiles.containsKey(n)) throw new IllegalArgumentException("Cannot duplicate"); Profile p = new Profile(n); p.values.putAll(profiles.get(src).values); profiles.put(n, p); return p; }
        public void rename(String o, String n) {
            revision++;
            checkName(n); if (BUILT_IN.contains(o) || !profiles.containsKey(o) || profiles.containsKey(n)) throw new IllegalArgumentException("Cannot rename");
            Profile old = profiles.remove(o); Profile p = new Profile(n); p.values.putAll(old.values); LinkedHashMap<String, Profile> copy = new LinkedHashMap<>(profiles); profiles.clear();
            for (Map.Entry<String, Profile> e : copy.entrySet()) profiles.put(e.getKey(), e.getValue()); profiles.put(n, p); if (active.equals(o)) active = n; if (o.equals(placeOverride)) placeOverride = n; places.replaceAll((k, v) -> v.equals(o) ? n : v);
        }
        public void delete(String n) { revision++; if (BUILT_IN.contains(n) || !profiles.containsKey(n)) throw new IllegalArgumentException("Cannot delete"); profiles.remove(n); if (active.equals(n)) active = "Default"; if (n.equals(placeOverride)) placeOverride = null; places.values().removeIf(n::equals); }
        public String get(String key) { String v = profiles.get(current()).values.get(key); return v != null ? v : reg.defaults().get(key); }
        public void set(String key, String v) { revision++; String e = reg.validate(key, v); if (e != null) throw new IllegalArgumentException(e); profiles.get(current()).values.put(key, v); }
        public boolean enabled(String id) { Module m = reg.get(id); return m != null && m.available() && get(id + ".enabled").equals("true"); }
        public void setEnabled(String id, boolean on) { Module m = reg.get(id); if (m == null) throw new IllegalArgumentException("Unknown module"); if (!m.available()) throw new IllegalArgumentException(m.name() + " is unavailable: " + m.note()); set(id + ".enabled", String.valueOf(on)); }

        public String export(String n) {
            Profile p = profiles.get(n); if (p == null) throw new IllegalArgumentException("No such profile");
            StringBuilder sb = new StringBuilder("auroras-profile=" + FORMAT + "\nname=").append(n).append('\n');
            for (Map.Entry<String, String> e : p.values.entrySet()) sb.append(e.getKey()).append('=').append(e.getValue()).append('\n');
            return sb.toString();
        }
        /** Validates the whole file before touching any state. Renames on collision instead of overwriting. */
        /** Current profile file format. Older files are migrated on load and import (see MIGRATIONS). */
        public static final int FORMAT = 2;
        /** Keys renamed between formats: MIGRATIONS[v] upgrades a format-v file to v+1. A value of null drops the key. */
        static final List<Map<String, String>> MIGRATIONS = List.of(Map.of(), Map.of("branding.enabled", "brandinghud.enabled"));
        static String migrateKey(String k, int from) {
            for (int v = from; v < FORMAT && k != null; v++) { Map<String, String> m = MIGRATIONS.get(v); if (m.containsKey(k)) k = m.get(k); }
            return k;
        }
        /** Lines skipped by the last lenient load (unknown or invalid values, for example from a newer client version). */
        public int lastSkippedLines;
        public Profile importProfile(String text) { return importProfile(text, true); }
        /** strict: any bad line rejects the file (used for files the user imports). Lenient: bad lines are skipped and counted (used for the client's own saved files). */
        public Profile importProfile(String text, boolean strict) {
            revision++; lastSkippedLines = 0;
            if (text == null || text.length() > 65536) throw new IllegalArgumentException("File is too large or empty");
            String[] lines = text.split("\r?\n"); int fmt = lines.length < 2 ? -1 : lines[0].equals("auroras-profile=1") ? 1 : lines[0].equals("auroras-profile=2") ? 2 : -1;
            if (fmt < 0) throw new IllegalArgumentException("Not an Auroras profile (or an unsupported version)");
            if (!lines[1].startsWith("name=")) throw new IllegalArgumentException("Missing profile name");
            String name = lines[1].substring(5); checkName(name);
            Map<String, String> vals = new TreeMap<>();
            for (int i = 2; i < lines.length; i++) {
                if (lines[i].isBlank()) continue; int eq = lines[i].indexOf('=');
                if (eq < 1) { if (strict) throw new IllegalArgumentException("Line " + (i + 1) + " is malformed"); lastSkippedLines++; continue; }
                String k = migrateKey(lines[i].substring(0, eq), fmt), v = lines[i].substring(eq + 1); if (k == null) continue;
                String err = reg.validate(k, v); if (err != null) { if (strict) throw new IllegalArgumentException("Line " + (i + 1) + ": " + err); lastSkippedLines++; continue; }
                vals.put(k, v);
            }
            String unique = name; for (int n = 2; profiles.containsKey(unique); n++) unique = (name.length() > 28 ? name.substring(0, 28) : name) + " " + n;
            Profile p = fresh(unique); p.values.putAll(vals); profiles.put(unique, p); return p;
        }
        /** Invalid or unknown lines skipped inside otherwise good files during the last load. */
        public int skippedLines;
        public void save(Path dir) throws IOException {
            Files.createDirectories(dir); Files.writeString(dir.resolve("active.txt"), active, StandardCharsets.UTF_8);
            for (String n : profiles.keySet()) Files.writeString(dir.resolve("profile-" + n.replace(' ', '_') + ".txt"), export(n), StandardCharsets.UTF_8);
            StringBuilder pl = new StringBuilder(); for (Map.Entry<String, String> e : places.entrySet()) pl.append(e.getKey()).append('=').append(e.getValue()).append('\n');
            Files.writeString(dir.resolve("places.txt"), pl.toString(), StandardCharsets.UTF_8);
        }
        /** Loads saved profiles; invalid files are skipped, never applied. Returns the number of files skipped. */
        public int load(Path dir) throws IOException {
            int skipped = 0; skippedLines = 0; if (!Files.isDirectory(dir)) return 0;
            try (DirectoryStream<Path> ds = Files.newDirectoryStream(dir, "profile-*.txt")) {
                for (Path f : ds) {
                    try { String t = Files.readString(f, StandardCharsets.UTF_8); String n = t.split("\r?\n")[1].substring(5); Profile p = fresh(n);
                        ProfileManager tmp = new ProfileManager(reg); Profile q = tmp.importProfile(t, false); skippedLines += tmp.lastSkippedLines; p.values.putAll(q.values); profiles.put(n, p); }
                    catch (RuntimeException e) { skipped++; }
                }
            }
            Path a = dir.resolve("active.txt"); if (Files.exists(a)) { String n = Files.readString(a).trim(); if (profiles.containsKey(n)) active = n; }
            Path pl = dir.resolve("places.txt");
            if (Files.exists(pl)) for (String line : Files.readAllLines(pl, StandardCharsets.UTF_8)) {
                if (line.isBlank()) continue; int eq = line.lastIndexOf('='); if (eq < 1) { skipped++; continue; } String k = line.substring(0, eq), v = line.substring(eq + 1);
                if (PLACE.matcher(k).matches() && profiles.containsKey(v)) places.put(k, v); else skipped++;
            }
            revision++;
            return skipped;
        }
    }
}
