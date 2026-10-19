package gg.auroras.client.platform;

import net.minecraft.resources.Identifier;

/** Preview stand-in: textures made by the menus are kept in memory for the preview Gfx to draw. */
public final class Platform {
    private Platform() {}
    public static void texture(Identifier id, int[] argb, int w, int h) { Gfx.register(id, argb, w, h); }
}
