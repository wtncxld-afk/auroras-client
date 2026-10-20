package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x). Skin Changer: wear a skin on your own screen. The launcher's Skins page
// writes config/auroras/skin.png (a PNG you picked, or the skin of a username the launcher looked up through Mojang's
// own profile service); the mod never goes online. Like Custom Capes (AurorasCape), mixin/AbstractClientPlayerMixin
// wraps AbstractClientPlayer#getSkin and, for your own player only, returns a copy whose body texture is this file.
// **Only you see it**: other players and the server still see your Minecraft skin.

import com.mojang.blaze3d.platform.NativeImage;
import gg.auroras.client.platform.Platform;
import gg.auroras.core.Cosmetics;
import gg.auroras.core.PlayerFx;
import net.minecraft.client.Minecraft;
import net.minecraft.core.ClientAsset;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.player.PlayerModelType;
import net.minecraft.world.entity.player.PlayerSkin;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public final class AurorasSkin {
    private AurorasSkin() {}
    static final Identifier ID = Identifier.fromNamespaceAndPath("auroras_client", "skin/local");
    static final ClientAsset.ResourceTexture TEXTURE = new ClientAsset.ResourceTexture(ID, ID);
    static final Cosmetics.CapeWatch WATCH = new Cosmetics.CapeWatch(); // same file watching rules as the cape: at most once a second, reload on change
    static Path file;
    static PlayerSkin from, swapped; static String model = "auto";

    static void init(Path configDir) { file = configDir.resolve("skin.png"); }

    static void tick(Minecraft mc) {
        if (file == null) return;
        boolean on = AurorasClient.PM.enabled("skinchanger"); long now = System.currentTimeMillis();
        String m = AurorasClient.PM.get("skinchanger.model"); if (!m.equals(model)) { model = m; from = null; }
        if (!WATCH.due(now, on)) return;
        boolean exists = false; long modified = 0, size = 0;
        if (on) try { exists = Files.isRegularFile(file); if (exists) { modified = Files.getLastModifiedTime(file).toMillis(); size = Files.size(file); } } catch (Exception e) { exists = false; }
        switch (WATCH.update(now, on, exists, modified, size)) {
            case LOAD -> { if (WATCH.loaded(load()) == Cosmetics.CapeWatch.Action.CLEAR) release(mc); }
            case CLEAR -> release(mc);
            default -> { }
        }
    }
    static boolean load() {
        try (InputStream in = Files.newInputStream(file)) {
            NativeImage img = NativeImage.read(in); int w = img.getWidth(), h = img.getHeight();
            if (!PlayerFx.skinSize(w, h)) { img.close(); throw new IllegalArgumentException("skins must be 64x64 or 64x32, this one is " + w + "x" + h); }
            if (h == 32) { // old layout: Minecraft's own conversion (copy the right arm and leg into the left slots, mirrored)
                int[] px = new int[64 * 32]; for (int y = 0; y < 32; y++) for (int x = 0; x < 64; x++) px[y * 64 + x] = img.getPixel(x, y);
                img.close(); img = Platform.image(PlayerFx.legacySkin(px), 64, 64);
            }
            Platform.texture(ID, img); from = null; swapped = null;
            System.out.println("[Auroras] skin.png loaded (" + w + "x" + h + "), shown on your player only");
            return true;
        } catch (Exception e) { System.out.println("[Auroras] skin.png not used: " + e.getMessage()); return false; }
    }
    static void release(Minecraft mc) { from = null; swapped = null; mc.getTextureManager().release(ID); }

    /** The skin to use for this player: yours gets the local skin while one is loaded; everyone else is untouched. */
    public static PlayerSkin skin(Object player, PlayerSkin skin) {
        if (skin == null || !WATCH.active() || player != Minecraft.getInstance().player) return skin;
        if (skin != from) {
            from = skin; boolean slim = PlayerFx.slim(model, skin.model() == PlayerModelType.SLIM);
            swapped = new PlayerSkin(TEXTURE, skin.cape(), skin.elytra(), slim ? PlayerModelType.SLIM : PlayerModelType.WIDE, skin.secure());
        }
        return swapped;
    }
}
