"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1600); } catch {} }}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-line px-2 text-[12px] text-ink-mute transition hover:border-line-strong hover:text-ink" aria-label={done ? "Copied" : `${label} to clipboard`}>
      {done ? <Check size={13} className="text-ok" /> : <Copy size={13} />}{done ? "Copied" : label}
    </button>
  );
}
