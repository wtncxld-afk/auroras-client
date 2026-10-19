package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. Custom Capes. LOCAL ONLY: only you see this cape. Nothing
// is sent to the server, and other players are never touched; they see your Minecraft cape or none.
//
// Since 1.21.9 a player's skin is a PlayerSkin record (body, cape and elytra textures as ClientAsset.Texture). The
// launcher's Cape Studio writes config/auroras/cape.png (64x32, or 128x64 / 256x128 / 512x256 for HD capes). tick()
// checks that file at most once a second (core Cosmetics.CapeWatch) and registers it as a dynamic texture at its own
// resolution; the cape model samples it by normalized coordinates, so HD capes need nothing else. AbstractClientPlayerMixin
// then gives your own player, and only yours, a copy of its skin whose cape is that texture. Elytra keep Minecraft's
// rule: with no elytra texture of their own they use the cape. Minecraft's "Cape" skin-customization switch still
// decides whether the cape is drawn.

import gg.auroras.client.platform.Platform;
import gg.auroras.core.Cosmetics;
import com.mojang.blaze3d.platform.NativeImage;
import net.minecraft.client.Minecraft;
import net.minecraft.core.ClientAsset;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.player.PlayerSkin;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public final class AurorasCape {
    private AurorasCape() {}
    static final Identifier ID = Identifier.fromNamespaceAndPath("auroras_client", "cape/local");
    static final ClientAsset.ResourceTexture TEXTURE = new ClientAsset.ResourceTexture(ID, ID);
    static final Cosmetics.CapeWatch WATCH = new Cosmetics.CapeWatch();
    static Path file;
    static PlayerSkin from, swapped; // last skin we were given and our copy of it, so getSkin() doesn't allocate every frame

    static void init(Path configDir) { file = configDir.resolve("cape.png"); }

    /** END_CLIENT_TICK (client = render thread): notices the setting and file changing, loads or drops the texture. */
    static void tick(Minecraft mc) {
        if (file == null) return;
        boolean on = AurorasClient.PM.enabled("cape"); long now = System.currentTimeMillis();
        if (!WATCH.due(now, on)) return;
        boolean exists = false; long modified = 0, size = 0;
        if (on) try { exists = Files.isRegularFile(file); if (exists) { modified = Files.getLastModifiedTime(file).toMillis(); size = Files.size(file); } } catch (Exception e) { exists = false; }
        switch (WATCH.update(now, on, exists, modified, size)) {
            case LOAD -> { if (WATCH.loaded(load(mc)) == Cosmetics.CapeWatch.Action.CLEAR) release(mc); }
            case CLEAR -> release(mc);
            default -> { }
        }
    }
    static boolean load(Minecraft mc) {
        try (InputStream in = Files.newInputStream(file)) {
            NativeImage img = NativeImage.read(in); int w = img.getWidth(), h = img.getHeight(), scale;
            try { scale = Cosmetics.capeScale(w, h); } catch (IllegalArgumentException e) { img.close(); throw e; }
            if (scale == 0) { // old 22x17 layout: same coordinates as the top-left of 64x32
                int[] px = new int[22 * 17]; for (int y = 0; y < 17; y++) for (int x = 0; x < 22; x++) px[y * 22 + x] = img.getPixel(x, y);
                img.close(); img = Platform.image(Cosmetics.legacyCape(px), 64, 32);
            }
            Platform.texture(ID, img); from = null; swapped = null;
            System.out.println("[Auroras] cape.png loaded (" + w + "x" + h + "), shown on your player only");
            return true;
        } catch (Exception e) { System.out.println("[Auroras] cape.png not used: " + e.getMessage()); return false; }
    }
    static void release(Minecraft mc) { from = null; swapped = null; mc.getTextureManager().release(ID); }

    /** AbstractClientPlayerMixin: the skin to use for this player. Changes only your own player, and only while a cape is loaded. */
    public static PlayerSkin skin(Object player, PlayerSkin skin) {
        if (skin == null || !WATCH.active() || player != Minecraft.getInstance().player) return skin;
        if (skin != from) { from = skin; swapped = new PlayerSkin(skin.body(), TEXTURE, skin.elytra(), skin.model(), skin.secure()); }
        return swapped;
    }
}
