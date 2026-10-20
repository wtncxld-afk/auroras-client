import Image from "next/image";
import { LogoMark } from "../ui/Logo";

export function ModuleIcon({ icon, name, isClientMod, size = 48 }: { icon: string | null; name: string; isClientMod?: boolean; size?: number }) {
  const box = "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-night-700 to-night-850 shadow-[0_0_30px_-10px_rgba(111,227,255,0.4)]";
  if (icon) return <span className={box} style={{ width: size, height: size }}><Image src={icon} alt="" width={size} height={size} className="h-full w-full object-cover" unoptimized /></span>;
  if (isClientMod) return <span className={box} style={{ width: size, height: size }}><LogoMark size={Math.round(size * 0.62)} /></span>;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return <span className={box + " text-sm font-semibold text-aurora-ice"} style={{ width: size, height: size }} aria-hidden>{initials}</span>;
}
