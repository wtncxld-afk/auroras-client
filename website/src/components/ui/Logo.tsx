import Image from "next/image";
import Link from "next/link";

// The official Auroras mark (from the launcher) at its natural aspect ratio (256x233), never stretched.
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return <Image src="/brand/logo-mark.webp" alt="" width={size} height={Math.round((size * 233) / 256)} className={className} priority />;
}
export function Logo({ href = "/", size = 26 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 rounded-lg" aria-label="Auroras Client home">
      <LogoMark size={size} className="drop-shadow-[0_0_10px_rgba(111,227,255,0.35)] transition group-hover:drop-shadow-[0_0_14px_rgba(111,227,255,0.55)]" />
      <span className="flex items-baseline gap-1.5 leading-none">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Auroras</span>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-aurora-cyan/80">Client</span>
      </span>
    </Link>
  );
}
