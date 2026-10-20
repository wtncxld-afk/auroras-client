"use client";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useMemo } from "react";

// Cinematic aurora scene drawn with CSS and SVG only (no video, no large images): soft curtains of light that drift
// slowly, a star field, a mountain horizon and film grain. Parallax on scroll; static when reduced motion is requested.
function stars(n: number, seed: number) {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ x: r() * 100, y: r() * 62, s: r() < 0.08 ? 1.6 : r() < 0.4 ? 1.1 : 0.7, o: 0.25 + r() * 0.6, d: r() * 6 }));
}
const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export function AuroraBackdrop({ intensity = 1, horizon = true, className = "" }: { intensity?: number; horizon?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const ySky = useTransform(scrollY, [0, 800], [0, reduce ? 0 : 120]);
  const yAur = useTransform(scrollY, [0, 800], [0, reduce ? 0 : 60]);
  const yHills = useTransform(scrollY, [0, 800], [0, reduce ? 0 : 20]);
  const field = useMemo(() => stars(110, 7), []);
  return (
    <div aria-hidden className={"pointer-events-none absolute inset-0 overflow-hidden " + className}>
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#0b1630_0%,#070b17_45%,#04060b_100%)]" />
      <motion.div style={{ y: ySky }} className="absolute inset-0">
        <svg className="h-full w-full" preserveAspectRatio="none">
          {field.map((p, i) => (
            <circle key={i} cx={p.x + "%"} cy={p.y + "%"} r={p.s} fill="#dff6ff" opacity={p.o} className={i % 5 === 0 ? "animate-twinkle" : undefined} style={i % 5 === 0 ? { animationDelay: `-${p.d}s` } : undefined} />
          ))}
        </svg>
      </motion.div>
      <motion.div style={{ y: yAur, opacity: intensity }} className="absolute inset-0 mix-blend-screen">
        <div className="absolute -left-[10%] top-[6%] h-[46%] w-[70%] rotate-[-8deg] animate-drift rounded-[50%] bg-[radial-gradient(closest-side,rgba(67,214,196,0.55),rgba(67,214,196,0.0))] blur-3xl" />
        <div className="absolute left-[22%] top-[0%] h-[40%] w-[62%] rotate-[6deg] animate-drift2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(79,140,255,0.55),rgba(79,140,255,0))] blur-3xl" />
        <div className="absolute right-[-12%] top-[10%] h-[38%] w-[48%] rotate-[-4deg] animate-drift rounded-[50%] bg-[radial-gradient(closest-side,rgba(155,135,245,0.42),rgba(155,135,245,0))] blur-3xl [animation-delay:-9s]" />
        {/* light curtains: fine vertical rays, masked into a soft band */}
        <div className="absolute inset-x-0 top-[8%] h-[40%] opacity-[0.16] blur-[1.5px] [mask-image:radial-gradient(50%_60%_at_30%_60%,black,transparent)]"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(150,255,235,0) 0px, rgba(150,255,235,0.35) 3px, rgba(150,255,235,0) 9px, rgba(120,190,255,0) 23px, rgba(120,200,255,0.25) 26px, rgba(120,190,255,0) 37px)" }} />
      </motion.div>
      {horizon && (
        <motion.svg style={{ y: yHills }} className="absolute inset-x-0 bottom-0 h-[34%] w-full" viewBox="0 0 1440 300" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hz1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1830" /><stop offset="1" stopColor="#04060b" /></linearGradient>
            <linearGradient id="hz2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#081022" /><stop offset="1" stopColor="#04060b" /></linearGradient>
          </defs>
          <path d="M0 170 L90 128 L170 150 L260 96 L350 140 L430 118 L520 156 L610 104 L700 132 L790 88 L880 136 L980 112 L1070 150 L1160 100 L1250 138 L1340 116 L1440 148 L1440 300 L0 300 Z" fill="url(#hz1)" opacity="0.9" />
          <path d="M0 220 L120 186 L230 210 L340 176 L470 214 L590 190 L720 222 L850 184 L980 214 L1110 192 L1230 220 L1350 196 L1440 214 L1440 300 L0 300 Z" fill="url(#hz2)" />
        </motion.svg>
      )}
      <div className="absolute inset-0 opacity-[0.06] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_50%_30%,transparent_55%,rgba(2,3,7,0.7)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-night-950" />
    </div>
  );
}
