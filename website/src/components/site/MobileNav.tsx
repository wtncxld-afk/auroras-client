"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { buttonClass } from "../ui/Button";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  return (
    <div className="md:hidden">
      <button type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-soft hover:text-ink">
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div id="mobile-nav" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
            className="fixed inset-x-0 top-16 z-40 h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-night-950/95 px-4 pb-10 pt-4 backdrop-blur-xl">
            <nav aria-label="Mobile">
              <ul className="divide-y divide-line">
                {items.map((i) => (
                  <li key={i.href}><Link href={i.href} className="flex items-center justify-between py-4 text-lg font-medium text-ink" aria-current={path.startsWith(i.href) ? "page" : undefined}>{i.label}<span aria-hidden className="text-ink-faint">→</span></Link></li>
                ))}
              </ul>
              <Link href="/download" className={buttonClass("primary", "lg", "mt-6 w-full")}>Download Auroras Client</Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
