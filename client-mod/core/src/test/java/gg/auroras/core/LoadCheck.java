package gg.auroras.core;

import java.nio.file.Path;

/** Loads a config/auroras folder the way the mod does and prints what it sees. Used by the launcher's cross-language test. */
public final class LoadCheck {
    public static void main(String[] a) throws Exception {
        Config.ProfileManager pm = new Config.ProfileManager(new Config.Registry()); int skipped = pm.load(Path.of(a[0]));
        if (a.length > 2 && !a[2].equals("-")) pm.enterPlace(a[2]);
        StringBuilder b = new StringBuilder("{\"active\":\"" + pm.active() + "\",\"current\":\"" + pm.current() + "\",\"skipped\":" + skipped + ",\"values\":{");
        String[] keys = a[1].split(","); for (int k = 0; k < keys.length; k++) b.append(k > 0 ? "," : "").append("\"").append(keys[k]).append("\":\"").append(pm.get(keys[k])).append("\"");
        b.append("}");
        if (a.length > 3 && a[3].equals("layouts")) { b.append(",\"layouts\":{"); boolean f1 = true;
            for (java.util.Map.Entry<String, java.util.Map<String, String>> e : HudKit.loadLayouts(new Config.Registry(), Path.of(a[0])).entrySet()) { b.append(f1 ? "" : ",").append("\"").append(e.getKey()).append("\":{"); boolean f2 = true;
                for (java.util.Map.Entry<String, String> kv : e.getValue().entrySet()) { b.append(f2 ? "" : ",").append("\"").append(kv.getKey()).append("\":\"").append(kv.getValue()).append("\""); f2 = false; } b.append("}"); f1 = false; }
            b.append("}"); }
        System.out.println(b.append("}"));
    }
}
