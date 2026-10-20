"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { Button } from "../ui/Button";
import { api, uploadFile } from "./api";
import { Field, inputCls, Panel, Spinner, useToast } from "./ui";

export function MediaManager({ moduleId, media }: { moduleId: string; media: { id: string; kind: string; alt: string; size: number }[] }) {
  const router = useRouter(); const toast = useToast();
  const [kind, setKind] = useState<"icon" | "preview">("preview"), [alt, setAlt] = useState(""), [pct, setPct] = useState<number | null>(null);
  const onFile = async (f: File | undefined) => {
    if (!f) return; setPct(0);
    const r = await uploadFile(`/api/owner/modules/${moduleId}/media?kind=${kind}&alt=${encodeURIComponent(alt)}`, f, setPct);
    setPct(null);
    if (!r.ok) return toast("error", r.message);
    toast("ok", "Image uploaded."); setAlt(""); router.refresh();
  };
  const remove = async (id: string) => { const r = await api(`/api/owner/modules/${moduleId}/media/${id}`, { method: "DELETE" }); if (!r.ok) return toast("error", r.message); router.refresh(); };
  return (
    <Panel title="Images" description="PNG, JPEG or WebP, checked by content (not just the file name). One icon; any number of previews.">
      {media.length > 0 && (
        <ul className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((m) => (
            <li key={m.id} className="group relative overflow-hidden rounded-xl border border-line bg-night-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${m.id}`} alt={m.alt} className={m.kind === "icon" ? "mx-auto my-4 h-16 w-16 rounded-xl object-cover" : "aspect-video w-full object-cover"} />
              <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-ink-mute"><span>{m.kind}</span><button type="button" aria-label="Delete image" onClick={() => remove(m.id)} className="text-ink-faint hover:text-bad"><Trash2 size={14} /></button></div>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
        <Field label="Type" htmlFor="mkind"><select id="mkind" value={kind} onChange={(e) => setKind(e.target.value as "icon" | "preview")} className={inputCls}><option value="preview">Preview</option><option value="icon">Icon</option></select></Field>
        <Field label="Alt text" htmlFor="malt"><input id="malt" value={alt} onChange={(e) => setAlt(e.target.value)} className={inputCls} placeholder="Describe the image" /></Field>
        <label className="inline-flex"><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} disabled={pct !== null} />
          <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-white/[0.04] px-4 text-sm font-medium hover:border-line-strong">{pct !== null ? <><Spinner />{pct}%</> : <><Upload size={15} />Upload image</>}</span></label>
      </div>
    </Panel>
  );
}
