package gg.auroras.client;
import gg.auroras.core.Config;
public final class AurorasClient {
    public static final Config.Registry REG = new Config.Registry(); public static final Config.ProfileManager PM = new Config.ProfileManager(REG);
    public static String mcVersion = "1.21.11"; public static void save() {}
}
