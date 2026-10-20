"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/cn";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <ul className="flex items-center gap-1">
      {items.map((i) => {
        const active = path === i.href || path.startsWith(i.href + "/");
        return (
          <li key={i.href}>
            <Link href={i.href} aria-current={active ? "page" : undefined} className={cn("relative rounded-lg px-3 py-2 text-[13.5px] font-medium transition", active ? "text-ink" : "text-ink-mute hover:text-ink")}>
              {i.label}
              {active && <span aria-hidden className="absolute inset-x-3 -bottom-[17px] h-px bg-gradient-to-r from-transparent via-aurora-cyan to-transparent" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
