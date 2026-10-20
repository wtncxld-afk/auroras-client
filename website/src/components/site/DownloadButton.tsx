"use client";
import { AlertCircle, Download, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { buttonClass } from "../ui/Button";

/**
 * A download link that first asks the server whether the file is still available (HEAD), so a withdrawn or missing
 * file shows a clear message instead of a browser error page. The download itself (and its progress bar) is the
 * browser's own. Without JavaScript it is a plain link to the same authorized endpoint.
 */
export function DownloadButton({ assetId, children, variant = "primary", size = "lg", className, meta, center }: { assetId: string; children: ReactNode; variant?: "primary" | "secondary" | "subtle"; size?: "sm" | "md" | "lg"; className?: string; meta?: string; center?: boolean }) {
  const href = `/api/download/${assetId}`;
  const [state, setState] = useState<"idle" | "checking" | "started" | "error">("idle");
  const [msg, setMsg] = useState("");
  const go = async (e: React.MouseEvent) => {
    e.preventDefault(); setState("checking");
    try {
      const r = await fetch(href, { method: "HEAD", cache: "no-store" });
      if (!r.ok) { setState("error"); setMsg(r.status === 404 ? "This file is no longer available. Refresh the page for the current release." : "The download server is having trouble. Please try again in a minute."); return; }
      setState("started"); window.location.assign(href);
      setTimeout(() => setState("idle"), 4000);
    } catch { setState("error"); setMsg("Couldn't reach the download server. Check your connection and try again."); }
  };
  return (
    <div className={"inline-flex flex-col gap-2 " + (center ? "items-center text-center" : "items-start")}>
      <a href={href} onClick={go} className={buttonClass(variant, size, className)} aria-describedby={meta ? `dl-${assetId}` : undefined} data-download={assetId}>
        {state === "checking" ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
        {children}
      </a>
      {meta && <span id={`dl-${assetId}`} className="text-xs text-ink-mute">{meta}</span>}
      {state === "started" && <span role="status" className="text-xs text-ok">Download started. Your browser shows its progress.</span>}
      {state === "error" && <span role="alert" className="flex items-center gap-1.5 text-xs text-[#ffc2c2]"><AlertCircle size={13} />{msg}</span>}
    </div>
  );
}
