"use client";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ProductFrame } from "./ProductFrame";

export function HeroPreview({ caption }: { caption: string }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const rot = useTransform(scrollY, [0, 500], [reduce ? 0 : 10, 0]);
  const y = useTransform(scrollY, [0, 500], [0, reduce ? 0 : -30]);
  const scale = useTransform(scrollY, [0, 500], [reduce ? 1 : 0.96, 1]);
  return (
    <div className="relative [perspective:1600px]">
      <div aria-hidden className="absolute -inset-x-10 -top-10 bottom-10 rounded-[40px] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(79,140,255,0.25),transparent)] blur-2xl" />
      <motion.div style={{ rotateX: rot, y, scale }} initial={reduce ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }} className="origin-top">
        <ProductFrame src="/product/launcher-home.webp" alt="The Auroras launcher home screen: sidebar navigation, a welcome card with Add account, the 3D skin preview, the featured VexVanilla server, recent instances and what's new." caption={caption} priority />
      </motion.div>
    </div>
  );
}
