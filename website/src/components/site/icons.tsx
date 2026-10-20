import { Box, Check, Gauge, Layers, LayoutDashboard, Shirt, Smile, Sparkles, User } from "lucide-react";
export const FEATURE_ICONS = { sparkles: Sparkles, layout: LayoutDashboard, box: Box, smile: Smile, shirt: Shirt, gauge: Gauge, user: User, layers: Layers, check: Check } as const;
export function FeatureIcon({ name, size = 18 }: { name: string; size?: number }) {
  const I = FEATURE_ICONS[name as keyof typeof FEATURE_ICONS] ?? Sparkles;
  return (
    <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-white/[0.02] text-aurora-ice shadow-[0_0_24px_-6px_rgba(111,227,255,0.35)]">
      <I size={size} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
