import Image from "next/image";
import { cn } from "../ui/cn";

/** A real launcher capture inside a quiet window frame. */
export function ProductFrame({ src, alt, caption, priority, className }: { src: string; alt: string; caption?: string; priority?: boolean; className?: string }) {
  return (
    <figure className={cn("group relative", className)}>
      <div className="absolute -inset-px rounded-[18px] bg-gradient-to-b from-white/20 via-white/[0.04] to-transparent opacity-80" aria-hidden />
      <div className="relative overflow-hidden rounded-[17px] border border-white/[0.07] bg-night-900 shadow-lift">
        <div className="flex h-8 items-center gap-1.5 border-b border-white/[0.06] bg-night-850/90 px-3.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" /><span className="h-2.5 w-2.5 rounded-full bg-white/10" /><span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        </div>
        <Image src={src} alt={alt} width={2160} height={1350} sizes="(min-width: 1280px) 1100px, 100vw" className="h-auto w-full" priority={priority} />
      </div>
      {caption && <figcaption className="mt-3 text-center text-xs text-ink-faint">{caption}</figcaption>}
    </figure>
  );
}
