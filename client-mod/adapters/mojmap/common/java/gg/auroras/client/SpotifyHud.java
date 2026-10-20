package gg.auroras.client;

// ADAPTER mojmap (Minecraft 1.21.11 and 26.x) — UNCOMPILED. The Spotify card: cover, title, artist and progress, laid out by core
// HudKit.spotifyCard exactly like the launcher's HUD editor. Long titles scroll (HudKit.marquee) or are cut with an
// ellipsis; a new track cross-fades in; with no cover a note glyph is drawn. The cover is a 64x64 PNG the launcher saves
// next to nowplaying.json; it's read on an IO thread and uploaded on the render thread, once per album.

import gg.auroras.core.*;
import com.mojang.blaze3d.platform.NativeImage;
import gg.auroras.client.platform.Gfx;
import gg.auroras.client.ui.Glass;
import gg.auroras.client.ui.HudArt;
import gg.auroras.client.platform.Platform;
import net.minecraft.client.Minecraft;
import net.minecraft.resources.Identifier;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;

final class SpotifyHud {
    private SpotifyHud() {}
    static final Identifier ART = Identifier.fromNamespaceAndPath("auroras_client", "spotify_art");
    static Path dir; static String artLoaded = "", artLoading = ""; static boolean artReady;
    static long trackVersion = -1; static String lastTitle = ""; static double trackIn = 1; static final long T0 = System.nanoTime();

    static void init(Path configDir) { dir = configDir; }

    /** Starts loading the cover for this track's artId if it isn't loaded yet. Never blocks the render thread. */
    static void art(Minecraft mc, NowPlaying.Snap n) {
        String id = n == null || !n.art() ? "" : n.artId(); if (id.equals(artLoaded) || id.equals(artLoading)) return;
        if (id.isEmpty()) { artReady = false; artLoaded = ""; return; }
        artLoading = id; Path f = dir.resolve(NowPlaying.ART_FILE);
        CompletableFuture.supplyAsync(() -> { try { return Files.size(f) <= 256 * 1024 ? Files.readAllBytes(f) : null; } catch (Exception e) { return null; } })
            .thenAccept(bytes -> mc.execute(() -> {
                if (!id.equals(artLoading)) return; artLoading = "";
                try { if (bytes == null) throw new IllegalStateException("no cover"); NativeImage img = NativeImage.read(bytes);
                    Platform.texture(ART, img); artReady = true; artLoaded = id; }
                catch (Exception e) { artReady = false; artLoaded = id; }
            }));
    }

    static void draw(Gfx ctx, Minecraft mc, HudRenderer.El e, int sw, int sh, double dt, double fade, boolean reduced) {
        NowPlaying.Snap n = NowPlaying.current; long now = System.currentTimeMillis(); art(mc, n);
        boolean showArt = e.b("showArt"), prog = e.b("showProgress"), marquee = e.b("marquee") && !reduced;
        HudKit.SpotifyCard c = HudKit.spotifyCard(e.s("layout"), showArt, prog);
        e.w = Hud.scaled(c.w(), e.scale); e.h = Hud.scaled(c.h(), e.scale); Hud.resolveInto(e.anchor, e.offX, e.offY, e.w, e.h, sw, sh, e.pos);
        String title, artist; boolean has = n != null && n.status().isEmpty() && !n.title().isEmpty();
        if (n == null) { title = "Spotify"; artist = "Play something in the Spotify app"; } else if (!n.status().isEmpty()) { title = "Spotify"; artist = cap(n.status()); }
        else if (n.title().isEmpty()) { title = "Spotify"; artist = "Nothing playing"; } else { title = n.title(); artist = n.artist(); }
        if (n != null && n.version() != trackVersion) { if (!title.equals(lastTitle)) trackIn = reduced ? 1 : 0; trackVersion = n.version(); lastTitle = title; }
        trackIn = Math.min(1, trackIn + dt / 0.25); double a = 0.35 + 0.65 * trackIn;
        double sec = (System.nanoTime() - T0) / 1e9;
        HudArt.Look l = HudRenderer.look(e, fade); HudArt.card(ctx, l, c.w(), c.h());
        if (c.art() > 0) {
            double x = c.pad(), y = c.pad(), s = c.art(), r = Math.min(3, s * 0.18);
            if (artReady && has) { ctx.texture(ART, (int) Math.round(l.X(x)), (int) Math.round(l.Y(y)), (int) Math.round(s * l.k), (int) Math.round(s * l.k), HudKit.argb(0xFFFFFF, e.opacity, fade * a));
                Glass.outline(ctx, l.X(x), l.Y(y), s * l.k, s * l.k, r * l.k, l.a(0xFFFFFF, 12)); }
            else { HudArt.rect(ctx, l, x, y, s, s, r, l.a(Sky.mix(e.bgColor, e.accent, 0.18), 100)); Glass.icon(ctx, "music", l.X(x + s * 0.25), l.Y(y + s * 0.25), s * 0.5 * l.k, l.a(e.accent, 90)); }
        }
        double ts = c.expanded() ? 7.5 : 7, small = 6.5;
        if (c.expanded()) { line(ctx, l, c, title, c.titleY() - 1, ts, e.color, a, sec, marquee); line(ctx, l, c, artist, c.artistY() - 1, small, 0x9AA3B8, a, sec, marquee); }
        else line(ctx, l, c, artist.isEmpty() ? title : title + " · " + artist, c.titleY() - 0.5, ts, e.color, a, sec, marquee);
        if (prog && has && n.durationMs() > 0) {
            double f = HudKit.progressFrac(n.progressNow(now), n.durationMs()); int track = l.a(0xFFFFFF, 14), fill = l.a(e.accent, 100);
            if (c.expanded()) {
                String[] t = HudKit.spotify("x", "", true, n.progressNow(now), n.durationMs(), true, null).split("  ")[1].split(" / ");
                double l0 = HudArt.width(small, t[0]), l1 = HudArt.width(small, t[1]), bx = c.textX() + l0 + 4, bw = c.textW() - l0 - l1 - 8, by = c.barY() + 0.5;
                HudArt.text(ctx, l, small, t[0], c.textX(), by - 2.2, 0x9AA3B8); HudArt.text(ctx, l, small, t[1], c.textX() + c.textW() - l1, by - 2.2, 0x9AA3B8);
                HudArt.rect(ctx, l, bx, by, bw, 2, 1, track); if (f > 0) HudArt.rect(ctx, l, bx, by, Math.max(2, bw * f), 2, 1, fill);
            } else { double bw = c.w() - c.pad() * 2; HudArt.rect(ctx, l, c.pad(), c.barY() - 0.5, bw, 1.5, 0.75, track); if (f > 0) HudArt.rect(ctx, l, c.pad(), c.barY() - 0.5, Math.max(1.5, bw * f), 1.5, 0.75, fill); }
        }
    }
    /** One text line clipped to the card's text column: scrolls when too long (marquee on), otherwise ends with an ellipsis. */
    static void line(Gfx ctx, HudArt.Look l, HudKit.SpotifyCard c, String s, double top, double size, int color, double alpha, double sec, boolean marquee) {
        double w = HudArt.width(size, s);
        if (w <= c.textW() || !marquee) { HudArt.text(ctx, l, size, w <= c.textW() ? s : Glass.fit(HudArt.W, size, s, c.textW()), c.textX(), top, color, alpha, 0, 0); return; }
        double off = HudKit.marquee((int) Math.ceil(w), c.textW(), sec, 24, 1.5, false);
        // Since 1.21.6 the clip box goes through the current transform; here that is plain GUI units.
        ctx.scissor((int) Math.floor(l.X(c.textX())), (int) Math.floor(l.Y(top - 2)), (int) Math.ceil(l.X(c.textX() + c.textW())), (int) Math.ceil(l.Y(top + size + 3)));
        HudArt.text(ctx, l, size, s, c.textX() - off, top, color, alpha, 0, 0); ctx.noScissor();
    }
    static String cap(String s) { return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1); }
}
