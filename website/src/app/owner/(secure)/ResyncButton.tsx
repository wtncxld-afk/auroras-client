"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/components/owner/api";
import { useToast } from "@/components/owner/ui";

/** Re-runs the post-publication steps: regenerate and re-sign the manifest, invalidate caches, re-send the webhook. */
export function ResyncButton() {
  const [busy, setBusy] = useState(false); const toast = useToast();
  return (
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); const r = await api<{ hooks: { name: string; ok: boolean; detail: string }[] }>("/api/owner/system/resync", { method: "POST" }); setBusy(false);
      if (!r.ok) return toast("error", r.message);
      const bad = r.data.hooks.filter((h) => !h.ok);
      toast(bad.length ? "error" : "ok", bad.length ? "Synced, but: " + bad.map((h) => `${h.name}: ${h.detail}`).join("; ") : "Manifest re-signed and caches refreshed.");
    }} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs text-ink-mute transition hover:border-line-strong hover:text-ink disabled:opacity-50">
      <RefreshCw size={13} className={busy ? "animate-spin" : ""} aria-hidden />Retry sync
    </button>
  );
}
