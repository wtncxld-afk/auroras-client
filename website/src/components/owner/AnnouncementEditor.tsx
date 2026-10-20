"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatDateTime } from "../ui/format";
import { api } from "./api";
import { ConfirmDialog, Empty, Field, inputCls, Panel, Spinner, TextArea, Toggle, useToast } from "./ui";

export type Ann = { id: string; title: string; bodyMd: string; level: string; active: boolean; releaseId: string | null; startsAt: string | null; endsAt: string | null; updatedAt: string };
type Opt = { id: string; label: string };
const blank = { title: "", bodyMd: "", level: "info", active: false, releaseId: null as string | null, startsAt: "", endsAt: "" };
const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const fromLocal = (s: string) => (s ? new Date(s + ":00Z").toISOString() : null);
const tone = { info: "blue", success: "ok", warning: "warn", maintenance: "violet" } as const;

export function AnnouncementEditor({ items, releases }: { items: Ann[]; releases: Opt[] }) {
  const router = useRouter(); const toast = useToast();
  const [edit, setEdit] = useState<string | "new" | null>(null), [v, setV] = useState(blank), [busy, setBusy] = useState(false), [del, setDel] = useState<string | null>(null);
  const open = (a?: Ann) => { setEdit(a ? a.id : "new"); setV(a ? { title: a.title, bodyMd: a.bodyMd, level: a.level, active: a.active, releaseId: a.releaseId, startsAt: toLocal(a.startsAt), endsAt: toLocal(a.endsAt) } : blank); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const body = { ...v, startsAt: fromLocal(v.startsAt), endsAt: fromLocal(v.endsAt) };
    const r = await api(edit === "new" ? "/api/owner/announcements" : `/api/owner/announcements/${edit}`, { method: edit === "new" ? "POST" : "PUT", json: body });
    setBusy(false); if (!r.ok) return toast("error", r.message);
    toast("ok", "Announcement saved."); setEdit(null); router.refresh();
  };
  const remove = async () => { if (!del) return; setBusy(true); const r = await api(`/api/owner/announcements/${del}`, { method: "DELETE" }); setBusy(false); setDel(null); if (!r.ok) return toast("error", r.message); router.refresh(); };
  return (
    <div className="space-y-6">
      {edit ? (
        <form onSubmit={submit}>
          <Panel title={edit === "new" ? "New announcement" : "Edit announcement"} description="Active announcements show as a banner on every public page (at most three). Times are UTC.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title" htmlFor="a-title" className="md:col-span-2"><input id="a-title" required value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className={inputCls} /></Field>
              <Field label="Body (Markdown)" htmlFor="a-body" className="md:col-span-2"><TextArea id="a-body" rows={3} value={v.bodyMd} onChange={(e) => setV({ ...v, bodyMd: e.target.value })} /></Field>
              <Field label="Style" htmlFor="a-level"><select id="a-level" value={v.level} onChange={(e) => setV({ ...v, level: e.target.value })} className={inputCls}><option value="info">Information</option><option value="success">Release / success</option><option value="warning">Warning</option><option value="maintenance">Maintenance</option></select></Field>
              <Field label="Linked release" htmlFor="a-rel" hint="Shown only while that release is published."><select id="a-rel" value={v.releaseId ?? ""} onChange={(e) => setV({ ...v, releaseId: e.target.value || null })} className={inputCls}><option value="">None</option>{releases.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field>
              <Field label="Starts (UTC, optional)" htmlFor="a-start"><input id="a-start" type="datetime-local" value={v.startsAt} onChange={(e) => setV({ ...v, startsAt: e.target.value })} className={inputCls} /></Field>
              <Field label="Ends (UTC, optional)" htmlFor="a-end"><input id="a-end" type="datetime-local" value={v.endsAt} onChange={(e) => setV({ ...v, endsAt: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="mt-5"><Toggle checked={v.active} onChange={(x) => setV({ ...v, active: x })} label="Active" /></div>
            <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy && <Spinner />}Save</Button></div>
          </Panel>
        </form>
      ) : <div className="flex justify-end"><Button onClick={() => open()}><Plus size={16} />New announcement</Button></div>}
      {items.length === 0 ? <Empty title="No announcements">Use one for a new release, planned maintenance or an important notice.</Empty> : (
        <ul className="space-y-3">{items.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-night-850/70 p-4 shadow-card">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{a.title}</p><Badge tone={tone[a.level as keyof typeof tone] ?? "neutral"}>{a.level}</Badge>{a.active ? <Badge tone="ok" dot>Active</Badge> : <Badge>Inactive</Badge>}</div>
              {a.bodyMd && <p className="mt-1 line-clamp-2 text-sm text-ink-mute">{a.bodyMd}</p>}
              <p className="mt-1 text-xs text-ink-faint">Updated {formatDateTime(a.updatedAt)}{a.startsAt ? ` · from ${formatDateTime(a.startsAt)}` : ""}{a.endsAt ? ` · until ${formatDateTime(a.endsAt)}` : ""}</p></div>
            <div className="flex shrink-0 gap-1"><button type="button" aria-label="Edit" onClick={() => open(a)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-mute hover:text-ink"><Pencil size={15} /></button><button type="button" aria-label="Delete" onClick={() => setDel(a.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-mute hover:text-bad"><Trash2 size={15} /></button></div>
          </li>
        ))}</ul>
      )}
      <ConfirmDialog open={!!del} title="Delete this announcement?" confirmLabel="Delete" tone="danger" busy={busy} onConfirm={remove} onClose={() => setDel(null)} />
    </div>
  );
}
