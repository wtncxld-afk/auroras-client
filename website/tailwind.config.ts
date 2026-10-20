import type { Config } from "tailwindcss";

// Auroras design tokens for the web. Colours extend the launcher's Aurora Dark theme (visuals/design-tokens.json):
// deep navy surfaces, icy cyan and electric blue accents, violet used sparingly.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#e8eef8", soft: "#c3cddd", mute: "#8d99b0", faint: "#5f6b82" },
        night: { 950: "#04060b", 900: "#070a12", 850: "#0a0e18", 800: "#0d1220", 750: "#111829", 700: "#162034", 600: "#1e2a42" },
        line: { DEFAULT: "rgba(148,170,210,0.12)", strong: "rgba(148,170,210,0.22)" },
        aurora: { cyan: "#6fe3ff", ice: "#b8f1ff", blue: "#4f8cff", deep: "#2f5fe0", violet: "#9b87f5", teal: "#43d6c4" },
        ok: "#5fd4a0", warn: "#f2c46d", bad: "#f27f7f",
      },
      fontFamily: { sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"], mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"] },
      fontSize: { "2xs": ["0.6875rem", { lineHeight: "1rem" }] },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem", "3xl": "1.5rem" },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -12px rgba(0,0,0,0.6)",
        lift: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 24px 60px -24px rgba(0,0,0,0.75)",
        glow: "0 0 0 1px rgba(111,227,255,0.35), 0 8px 30px -8px rgba(79,140,255,0.55)",
      },
      maxWidth: { page: "76rem" },
      keyframes: {
        drift: { "0%,100%": { transform: "translate3d(0,0,0) scale(1)" }, "50%": { transform: "translate3d(4%,-3%,0) scale(1.08)" } },
        drift2: { "0%,100%": { transform: "translate3d(0,0,0) rotate(0deg)" }, "50%": { transform: "translate3d(-5%,2%,0) rotate(6deg)" } },
        twinkle: { "0%,100%": { opacity: "0.35" }, "50%": { opacity: "0.8" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: { drift: "drift 22s ease-in-out infinite", drift2: "drift2 28s ease-in-out infinite", twinkle: "twinkle 6s ease-in-out infinite", shimmer: "shimmer 1.6s infinite" },
    },
  },
  plugins: [],
} satisfies Config;
