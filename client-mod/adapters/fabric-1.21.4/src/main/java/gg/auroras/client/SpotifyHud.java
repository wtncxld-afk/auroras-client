package gg.auroras.client;

// ADAPTER fabric-1.21.4 — UNCOMPILED. The Spotify card: cover, title, artist and progress, laid out by core
// HudKit.spotifyCard exactly like the launcher's HUD editor. Long titles scroll (HudKit.marquee) or are cut with an
// ellipsis; a new track cross-fades in; with no cover a note glyph is drawn. The cover is a 64x64 PNG the launcher saves
// next to nowplaying.json; it's read on an IO thread and uploaded on the render thread, once per album.

import gg.auroras.core.*;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderLayer;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;
import net.minecraft.util.Util;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;

final class SpotifyHud {
    private SpotifyHud() {}
    static final Identifier ART = Identifier.of("auroras_client", "spotify_art");
    static Path dir; static String artLoaded = "", artLoading = ""; static boolean artReady;
    static long trackVersion = -1; static String lastTitle = ""; static double trackIn = 1; static final long T0 = System.nanoTime();

    static void init(Path configDir) { dir = configDir; }

    /** Starts loading the cover for this track's artId if it isn't loaded yet. Never blocks the render thread. */
    static void art(MinecraftClient mc, NowPlaying.Snap n) {
        String id = n == null || !n.art() ? "" : n.artId(); if (id.equals(artLoaded) || id.equals(artLoading)) return;
        if (id.isEmpty()) { artReady = false; artLoaded = ""; return; }
        artLoading = id; Path f = dir.resolve(NowPlaying.ART_FILE);
        CompletableFuture.supplyAsync(() -> { try { return Files.size(f) <= 256 * 1024 ? Files.readAllBytes(f) : null; } catch (Exception e) { return null; } }, Util.getIoWorkerExecutor())
            .thenAccept(bytes -> mc.execute(() -> {
                if (!id.equals(artLoading)) return; artLoading = "";
                try { if (bytes == null) throw new IllegalStateException("no cover"); NativeImage img = NativeImage.read(bytes);
                    mc.getTextureManager().registerTexture(ART, new NativeImageBackedTexture(img)); artReady = true; artLoaded = id; }
                catch (Exception e) { artReady = false; artLoaded = id; }
            }));
    }

    static void draw(DrawContext ctx, MinecraftClient mc, HudRenderer.El e, int sw, int sh, double dt, double fade, boolean reduced) {
        NowPlaying.Snap n = NowPlaying.current; long now = System.currentTimeMillis(); art(mc, n);
        boolean showArt = e.b("showArt"), prog = e.b("showProgress"), marquee = e.b("marquee") && !reduced;
        HudKit.SpotifyCard c = HudKit.spotifyCard(e.s("layout"), showArt, prog);
        e.w = Hud.scaled(c.w(), e.scale); e.h = Hud.scaled(c.h(), e.scale); Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        String title, artist; boolean has = n != null && n.status().isEmpty() && !n.title().isEmpty();
        if (n == null) { title = "Spotify"; artist = "Not connected in the launcher"; } else if (!n.status().isEmpty()) { title = "Spotify"; artist = cap(n.status()); }
        else if (n.title().isEmpty()) { title = "Spotify"; artist = "Nothing playing"; } else { title = n.title(); artist = n.artist(); }
        if (n != null && n.version() != trackVersion) { if (!title.equals(lastTitle)) trackIn = reduced ? 1 : 0; trackVersion = n.version(); lastTitle = title; }
        trackIn = Math.min(1, trackIn + dt / 0.25); double a = fade * (0.35 + 0.65 * trackIn); int op = e.opacity;
        TextRenderer tr = mc.textRenderer; double sec = (System.nanoTime() - T0) / 1e9;
        ctx.getMatrices().push(); ctx.getMatrices().translate(e.pos[0], e.pos[1], 0); ctx.getMatrices().scale(e.scale, e.scale, 1f);
        if (e.bg) ctx.fill(0, 0, c.w(), c.h(), HudKit.argb(0x0C0F16, e.bgPct * op / 100, fade));
        if (e.border) { int bc = HudKit.argb(e.accent, 55 * op / 100, fade); ctx.fill(0, 0, c.w(), 1, bc); ctx.fill(0, c.h() - 1, c.w(), c.h(), bc); ctx.fill(0, 0, 1, c.h(), bc); ctx.fill(c.w() - 1, 0, c.w(), c.h(), bc); }
        if (c.art() > 0) {
            int x = c.pad(), y = c.pad(), s = c.art();
            if (artReady && has) ctx.drawTexture(RenderLayer::getGuiTextured, ART, x, y, 0, 0, s, s, s, s, s, s, HudKit.argb(0xFFFFFF, op, a));
            else { ctx.fill(x, y, x + s, y + s, HudKit.argb(0x222836, op, fade)); int k = s / 16; int nc = HudKit.argb(e.accent, 90 * op / 100, fade);
                ctx.fill(x + 9 * k, y + 3 * k, x + 10 * k + 1, y + 11 * k, nc); ctx.fill(x + 9 * k, y + 3 * k, x + 13 * k, y + 4 * k + 1, nc); ctx.fill(x + 6 * k, y + 10 * k, x + 10 * k, y + 13 * k, nc); }
        }
        int txt = HudKit.argb(e.color, op, a), mute = HudKit.argb(0x8A93A6, op, a);
        if (c.expanded()) { line(ctx, tr, e, c, title, c.titleY(), txt, sec, marquee); line(ctx, tr, e, c, artist, c.artistY(), mute, sec, marquee); }
        else line(ctx, tr, e, c, artist.isEmpty() ? title : title + " · " + artist, c.titleY(), txt, sec, marquee);
        if (prog && has && n.durationMs() > 0) {
            double f = HudKit.progressFrac(n.progressNow(now), n.durationMs()); int track = HudKit.argb(0xFFFFFF, 14 * op / 100, fade), fill = HudKit.argb(e.accent, op, fade);
            if (c.expanded()) {
                String[] t = HudKit.spotify("x", "", true, n.progressNow(now), n.durationMs(), true, null).split("  ")[1].split(" / ");
                int l0 = tr.getWidth(t[0]), l1 = tr.getWidth(t[1]), bx = c.textX() + l0 + 4, bw = c.textW() - l0 - l1 - 8;
                ctx.drawText(tr, t[0], c.textX(), c.barY() - 3, mute, false); ctx.drawText(tr, t[1], c.textX() + c.textW() - l1, c.barY() - 3, mute, false);
                ctx.fill(bx, c.barY(), bx + bw, c.barY() + c.barH(), track); ctx.fill(bx, c.barY(), bx + (int) Math.round(bw * f), c.barY() + c.barH(), fill);
            } else { int bw = c.w() - c.pad() * 2; ctx.fill(c.pad(), c.barY(), c.pad() + bw, c.barY() + c.barH(), track); ctx.fill(c.pad(), c.barY(), c.pad() + (int) Math.round(bw * f), c.barY() + c.barH(), fill); }
        }
        ctx.getMatrices().pop();
    }
    /** One text line clipped to the card's text column: scrolls when too long (marquee on), otherwise ends with an ellipsis. */
    static void line(DrawContext ctx, TextRenderer tr, HudRenderer.El e, HudKit.SpotifyCard c, String s, int y, int color, double sec, boolean marquee) {
        int w = tr.getWidth(s);
        if (w <= c.textW() || !marquee) { ctx.drawText(tr, UiKit.ellipsize(s, c.textW(), tr::getWidth), c.textX(), y, color, e.shadow); return; }
        double off = HudKit.marquee(w, c.textW(), sec, 24, 1.5, false);
        // the scissor box is in screen pixels: the element's position plus its scaled text column
        int sx = e.pos[0] + Math.round(c.textX() * e.scale), sy = e.pos[1] + Math.round((y - 1) * e.scale);
        ctx.enableScissor(sx, sy, sx + Math.round(c.textW() * e.scale), sy + Math.round(11 * e.scale));
        ctx.drawText(tr, s, c.textX() - (int) Math.round(off), y, color, e.shadow); ctx.disableScissor();
    }
    static String cap(String s) { return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1); }
}
