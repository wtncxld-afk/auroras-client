"use client";
import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProductFrame } from "./ProductFrame";
import { cn } from "../ui/cn";

export type Shot = { id: string; label: string; src: string; alt: string; text: string };
/** Tabs that switch between real launcher captures (keyboard: arrow keys move between tabs). */
export function ShotTabs({ shots }: { shots: Shot[] }) {
  const [i, setI] = useState(0); const uid = useId();
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = (i + (e.key === "ArrowRight" ? 1 : shots.length - 1)) % shots.length; setI(n); document.getElementById(`${uid}-t${n}`)?.focus(); }
  };
  const s = shots[i];
  return (
    <div>
      <div role="tablist" aria-label="Launcher screens" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0" onKeyDown={onKey}>
        {shots.map((x, n) => (
          <button key={x.id} id={`${uid}-t${n}`} role="tab" type="button" aria-selected={n === i} aria-controls={`${uid}-p`} tabIndex={n === i ? 0 : -1} onClick={() => setI(n)}
            className={cn("shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium transition", n === i ? "border-aurora-cyan/40 bg-aurora-cyan/10 text-aurora-ice" : "border-line text-ink-mute hover:border-line-strong hover:text-ink")}>
            {x.label}
          </button>
        ))}
      </div>
      <div id={`${uid}-p`} role="tabpanel" aria-labelledby={`${uid}-t${i}`} className="mt-8">
        <p className="mx-auto mb-6 max-w-2xl text-center text-[15px] leading-7 text-ink-mute">{s.text}</p>
        <AnimatePresence mode="wait">
          <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
            <ProductFrame src={s.src} alt={s.alt} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
