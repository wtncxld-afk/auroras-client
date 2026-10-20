import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "cyan" | "blue" | "violet" | "ok" | "warn" | "bad";
const tones: Record<Tone, string> = {
  neutral: "border-line-strong bg-white/[0.04] text-ink-soft",
  cyan: "border-aurora-cyan/30 bg-aurora-cyan/10 text-aurora-ice",
  blue: "border-aurora-blue/35 bg-aurora-blue/10 text-[#b9cfff]",
  violet: "border-aurora-violet/35 bg-aurora-violet/10 text-[#d6ccff]",
  ok: "border-ok/30 bg-ok/10 text-[#bff0d8]",
  warn: "border-warn/35 bg-warn/10 text-[#fbe3b0]",
  bad: "border-bad/35 bg-bad/10 text-[#ffd0d0]",
};
export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-5", tones[tone], className)}>
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
export const channelTone = (c: string): Tone => (c === "stable" ? "ok" : c === "beta" ? "blue" : "violet");
export function ChannelBadge({ channel }: { channel: string }) { return <Badge tone={channelTone(channel)} dot>{channel[0].toUpperCase() + channel.slice(1)}</Badge>; }
const compatTone: Record<string, Tone> = { tested: "ok", partial: "blue", experimental: "warn", unsupported: "neutral" };
const compatLabel: Record<string, string> = { tested: "Tested", partial: "Partially supported", experimental: "Experimental", unsupported: "Unsupported" };
export function CompatBadge({ status }: { status: string }) { return <Badge tone={compatTone[status] ?? "neutral"}>{compatLabel[status] ?? status}</Badge>; }
const statusTone: Record<string, Tone> = { draft: "neutral", published: "ok", unpublished: "warn", withdrawn: "bad", hidden: "warn", disabled: "bad" };
export function StatusBadge({ status }: { status: string }) { return <Badge tone={statusTone[status] ?? "neutral"} dot>{status[0].toUpperCase() + status.slice(1)}</Badge>; }
