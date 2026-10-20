"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades content up once as it scrolls into view. Content is rendered visible on the server and stays visible without
 * JavaScript; only elements that start below the fold are hidden (after hydration) and then revealed. Off when the
 * visitor asks for reduced motion.
 */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"shown" | "waiting" | "revealed">("shown");
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setState("waiting");
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setState("revealed"); io.disconnect(); } }, { rootMargin: "0px 0px 120px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}
      style={state === "waiting" ? { opacity: 0, transform: "translateY(14px)" } : state === "revealed" ? { opacity: 1, transform: "none", transition: `opacity 550ms cubic-bezier(.2,.7,.2,1) ${delay}s, transform 550ms cubic-bezier(.2,.7,.2,1) ${delay}s` } : undefined}>
      {children}
    </div>
  );
}
