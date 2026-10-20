import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";
const base = "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 disabled:pointer-events-none disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-[#9cecff] to-[#5fc9f5] text-[#04121c] shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_10px_30px_-10px_rgba(95,201,245,0.7)] hover:from-[#b3f1ff] hover:to-[#6fd3fa] active:translate-y-px",
  secondary: "border border-line-strong bg-white/[0.04] text-ink hover:border-white/25 hover:bg-white/[0.07]",
  ghost: "text-ink-soft hover:bg-white/[0.05] hover:text-ink",
  danger: "border border-bad/40 bg-bad/10 text-[#ffc9c9] hover:bg-bad/20",
  subtle: "border border-line bg-night-800 text-ink-soft hover:text-ink hover:border-line-strong",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };
export const buttonClass = (v: Variant = "primary", s: Size = "md", extra?: string) => cn(base, variants[v], sizes[s], extra);

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...p} className={buttonClass(variant, size, className)} />;
}
export function ButtonLink({ href, variant = "primary", size = "md", className, children, external, ...p }: { href: string; variant?: Variant; size?: Size; className?: string; children: ReactNode; external?: boolean } & Omit<ComponentProps<"a">, "href">) {
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClass(variant, size, className)} {...p}>{children}</a>;
  return <Link href={href} className={buttonClass(variant, size, className)} {...p}>{children}</Link>;
}
