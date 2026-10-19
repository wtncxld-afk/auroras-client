package gg.auroras.core;

import java.util.List;

/**
 * Themes for the in-game Auroras menus: each sets the accent colours and the animated effect drawn behind the menus
 * (falling sakura petals, aurora ribbons, twinkling stars, rising embers, snow, drifting void motes). The particles are
 * simulated here on real frame time, in screen-independent units (0..1 across the screen), so the adapter only draws
 * them. Unit-tested in UiTests.
 */
public final class MenuTheme {
    /** One theme: accent and second accent (rgb), the colour the panels lean toward, and its background effect. */
    public record Theme(String id, String name, int acc, int acc2, int tint, Fx fx) {}
    public enum Fx { AURORA, PETALS, STARS, EMBERS, SNOW, MOTES }
    public static final List<Theme> THEMES = List.of(
        new Theme("aurora", "Aurora", 0x8FD3FF, 0xB58CFF, 0x0E1A2A, Fx.AURORA),
        new Theme("sakura", "Sakura", 0xFFB7CF, 0xFF8FB1, 0x2A1220, Fx.PETALS),
        new Theme("midnight", "Midnight", 0x9DB4FF, 0xE8EEFF, 0x0C1230, Fx.STARS),
        new Theme("ember", "Ember", 0xFFA45C, 0xFFD34D, 0x2A1208, Fx.EMBERS),
        new Theme("frost", "Frost", 0xBFEFFF, 0xFFFFFF, 0x0E2230, Fx.SNOW),
        new Theme("void", "Void", 0xB58CFF, 0x4FD6E6, 0x120A24, Fx.MOTES));
    public static final List<String> IDS = THEMES.stream().map(Theme::id).toList();
    public static Theme of(String id) { for (Theme t : THEMES) if (t.id().equals(id)) return t; return THEMES.get(0); }

    /** One particle, in screen fractions (x, y 0..1), size in fractions of the screen height, rotation in radians. */
    public static final class P { public double x, y, vx, vy, size, rot, spin, phase, alpha, life, age; public int color; }

    /** The live effect behind the menus for one theme. amount 0..1 scales how many particles there are. */
    public static final class Effect {
        public final Theme theme; public final P[] ps; public double t; private final Sky.Rng rng;
        public Effect(Theme theme, double amount, int seed) {
            this.theme = theme; rng = new Sky.Rng(seed); int n = (int) Math.round(base(theme.fx()) * Math.max(0, Math.min(1, amount)));
            ps = new P[n]; for (int i = 0; i < n; i++) { ps[i] = new P(); spawn(ps[i], true); }
        }
        static int base(Fx fx) { return switch (fx) { case PETALS -> 46; case STARS -> 120; case EMBERS -> 60; case SNOW -> 90; case MOTES -> 50; case AURORA -> 40; }; }
        private double r() { return rng.next(); }
        /** Places a particle: anywhere on screen at the start (scatter), otherwise where it enters (top, or bottom for embers). */
        private void spawn(P p, boolean scatter) {
            Fx fx = theme.fx(); p.age = 0; p.phase = r() * Math.PI * 2; p.rot = r() * Math.PI * 2; p.x = r();
            switch (fx) {
                case PETALS -> { p.y = scatter ? r() : -0.05; p.vy = 0.05 + r() * 0.05; p.vx = 0.012 + r() * 0.02; p.size = 0.010 + r() * 0.010; p.spin = (r() - 0.5) * 2.4; p.alpha = 0.55 + r() * 0.4; p.color = r() < 0.7 ? theme.acc() : 0xFFF0F5; }
                case SNOW -> { p.y = scatter ? r() : -0.03; p.vy = 0.025 + r() * 0.04; p.vx = (r() - 0.5) * 0.01; p.size = 0.002 + r() * 0.005; p.alpha = 0.35 + r() * 0.55; p.color = 0xFFFFFF; }
                case EMBERS -> { p.y = scatter ? r() : 1.03; p.vy = -(0.03 + r() * 0.06); p.vx = (r() - 0.5) * 0.02; p.size = 0.0018 + r() * 0.004; p.life = 6 + r() * 8; p.age = scatter ? r() * p.life : 0; p.alpha = 0.7 + r() * 0.3; p.color = r() < 0.5 ? theme.acc() : theme.acc2(); }
                case STARS -> { p.y = r() * 0.92; p.vx = p.vy = 0; p.size = 0.0012 + Math.pow(r(), 3) * 0.004; p.alpha = 0.25 + r() * 0.75; p.spin = 0.6 + r() * 2.2; p.color = r() < 0.8 ? 0xFFFFFF : theme.acc(); }
                case MOTES -> { p.y = r(); p.vx = (r() - 0.5) * 0.012; p.vy = (r() - 0.5) * 0.012; p.size = 0.002 + r() * 0.006; p.alpha = 0.2 + r() * 0.5; p.spin = 0.3 + r() * 0.8; p.color = r() < 0.6 ? theme.acc() : theme.acc2(); }
                case AURORA -> { p.y = r() * 0.85; p.vx = (r() - 0.5) * 0.004; p.vy = 0; p.size = 0.0012 + Math.pow(r(), 3) * 0.0035; p.alpha = 0.2 + r() * 0.6; p.spin = 0.5 + r() * 1.5; p.color = 0xFFFFFF; }
            }
        }
        /** Advances by dt seconds (clamped, so a stall never teleports anything). Reduced motion keeps everything still. */
        public void update(double dt, boolean reduced) {
            if (reduced) return; dt = Math.max(0, Math.min(dt, 0.1)); t += dt;
            for (P p : ps) {
                p.age += dt;
                switch (theme.fx()) {
                    case PETALS -> { p.x += (p.vx + Math.sin(t * 1.3 + p.phase) * 0.018) * dt; p.y += p.vy * dt; p.rot += p.spin * dt; if (p.y > 1.05) spawn(p, false); }
                    case SNOW -> { p.x += (p.vx + Math.sin(t * 0.8 + p.phase) * 0.008) * dt; p.y += p.vy * dt; if (p.y > 1.03) spawn(p, false); }
                    case EMBERS -> { p.x += (p.vx + Math.sin(t * 2 + p.phase) * 0.01) * dt; p.y += p.vy * dt; if (p.y < -0.03 || p.age > p.life) spawn(p, false); }
                    case MOTES, AURORA -> { p.x += p.vx * dt; p.y += p.vy * dt; }
                    case STARS -> {}
                }
                if (p.x < -0.05) p.x += 1.1; else if (p.x > 1.05) p.x -= 1.1;
                if (theme.fx() == Fx.MOTES) { if (p.y < -0.05) p.y += 1.1; else if (p.y > 1.05) p.y -= 1.1; }
            }
        }
        /** How bright a particle is right now (twinkle, ember fade-out), 0..1. */
        public double brightness(P p) {
            return switch (theme.fx()) {
                case STARS, AURORA -> p.alpha * (0.55 + 0.45 * Math.sin(t * p.spin + p.phase));
                case MOTES -> p.alpha * (0.6 + 0.4 * Math.sin(t * p.spin + p.phase));
                case EMBERS -> p.alpha * Math.max(0, 1 - p.age / p.life) * Math.min(1, p.age * 2);
                default -> p.alpha;
            };
        }
        /** Aurora ribbons (AURORA only): height of ribbon k (0..2) at screen x, as a fraction of the screen. */
        public double ribbon(int k, double x) { return 0.16 + k * 0.07 + Math.sin(x * (5 + k) + t * (0.25 + 0.1 * k) + k * 1.7) * 0.04 + Math.sin(x * 11 - t * 0.4 + k) * 0.012; }
    }
}
