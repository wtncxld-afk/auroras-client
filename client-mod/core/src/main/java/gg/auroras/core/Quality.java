package gg.auroras.core;

/** Visual quality presets. Every visual module scales its work from these. */
public enum Quality {
    LOW(64, 0.5, false, false, 8), BALANCED(256, 1.0, true, true, 16), HIGH(1024, 1.5, true, true, 32);
    public final int particleBudget, domeRings; public final double starMultiplier; public final boolean aurora, nebula;
    Quality(int particles, double stars, boolean aurora, boolean nebula, int rings) { particleBudget = particles; starMultiplier = stars; this.aurora = aurora; this.nebula = nebula; domeRings = rings; }
    public static Quality parse(String s) { if (s == null) return null; for (Quality q : values()) if (q.name().equals(s)) return q; return null; }
}
