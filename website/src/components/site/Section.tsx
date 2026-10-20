import type { ReactNode } from "react";
import { cn } from "../ui/cn";
import { Reveal } from "./Reveal";

export function SectionHeading({ eyebrow, title, children, align = "center", className }: { eyebrow?: string; title: ReactNode; children?: ReactNode; align?: "center" | "left"; className?: string }) {
  return (
    <Reveal className={cn(align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl", className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-3 text-[28px] font-semibold leading-[1.15] text-ink sm:text-[34px]">{title}</h2>
      {children && <p className="mt-4 text-[15.5px] leading-7 text-ink-mute">{children}</p>}
    </Reveal>
  );
}
export function PageHero({ eyebrow, title, children, actions }: { eyebrow?: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/[0.05]">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_120%_at_50%_-20%,rgba(79,140,255,0.18),transparent_60%),radial-gradient(40%_80%_at_85%_0%,rgba(155,135,245,0.10),transparent_70%),radial-gradient(40%_80%_at_10%_10%,rgba(67,214,196,0.10),transparent_70%)]" />
      <div className="container-page pb-14 pt-16 sm:pb-16 sm:pt-20">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-3 max-w-3xl text-[34px] font-semibold leading-[1.1] text-ink sm:text-[44px]">{title}</h1>
        {children && <div className="mt-4 max-w-2xl text-[16px] leading-7 text-ink-mute">{children}</div>}
        {actions && <div className="mt-7 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </section>
  );
}
