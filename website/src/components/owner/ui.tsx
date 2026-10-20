"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { cn } from "../ui/cn";
import { Button } from "../ui/Button";

// Shared dashboard controls: fields, toasts and confirmation dialogs, all in the site's design system.
export const inputCls = "h-10 w-full rounded-xl border border-line bg-night-900 px-3 text-sm text-ink placeholder:text-ink-faint transition focus:border-aurora-cyan/60 focus:outline-none focus:ring-2 focus:ring-aurora-cyan/15 disabled:opacity-60";
export function Field({ label, hint, error, children, className, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-soft">{label}</label>
      {children}
      {error ? <p className="text-xs text-[#ffb4b4]" role="alert">{error}</p> : hint ? <p className="text-xs leading-5 text-ink-faint">{hint}</p> : null}
    </div>
  );
}
export function TextArea(p: React.ComponentProps<"textarea">) { return <textarea {...p} className={cn(inputCls, "h-auto min-h-[96px] py-2.5 leading-6", p.className)} />; }
export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-3 text-sm text-ink-soft">
      <span className={cn("relative h-5 w-9 rounded-full border transition", checked ? "border-aurora-cyan/50 bg-aurora-cyan/40" : "border-line-strong bg-night-700")}><span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition", checked ? "left-[18px]" : "left-0.5")} /></span>{label}
    </button>
  );
}
export function Panel({ title, description, actions, children, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-night-850/70 shadow-card", className)}>
      {(title || actions) && <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4"><div>{title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}{description && <p className="mt-1 text-[13px] leading-5 text-ink-mute">{description}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>}
      <div className="p-5">{children}</div>
    </section>
  );
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong px-6 py-12 text-center"><p className="font-medium text-ink">{title}</p>{children && <p className="mt-2 max-w-sm text-sm text-ink-mute">{children}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}
export function Spinner({ className }: { className?: string }) { return <Loader2 className={cn("animate-spin", className)} size={16} aria-hidden />; }

type Toast = { id: number; kind: "ok" | "error"; text: string };
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => { const id = Date.now() + Math.random(); setItems((x) => [...x, { id, kind, text }]); setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === "error" ? 8000 : 4000); }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={cn("pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lift backdrop-blur", t.kind === "ok" ? "border-ok/30 bg-night-800/95 text-ink" : "border-bad/40 bg-night-800/95 text-ink")}>
            {t.kind === "ok" ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-ok" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0 text-bad" />}
            <span className="flex-1 leading-5">{t.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))} className="text-ink-faint hover:text-ink"><X size={15} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Modal confirmation for anything destructive or public. Uses the native <dialog> (focus trap, Escape to close). */
export function ConfirmDialog({ open, title, children, confirmLabel, tone = "primary", busy, onConfirm, onClose, confirmDisabled }: { open: boolean; title: string; children?: ReactNode; confirmLabel: string; tone?: "primary" | "danger"; busy?: boolean; onConfirm: () => void; onClose: () => void; confirmDisabled?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (open && !d.open) d.showModal(); if (!open && d.open) d.close(); }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onCancel={(e) => { if (busy) e.preventDefault(); }} className="w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-line-strong bg-night-850 p-0 text-ink shadow-lift backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-3 text-sm leading-6 text-ink-mute">{children}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-night-900/60 px-6 py-4">
        <Button variant="ghost" type="button" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} type="button" onClick={onConfirm} disabled={busy || confirmDisabled}>{busy && <Spinner />}{confirmLabel}</Button>
      </div>
    </dialog>
  );
}
