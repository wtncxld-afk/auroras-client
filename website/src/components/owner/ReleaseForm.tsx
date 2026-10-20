"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui/Button";
import { api } from "./api";
import { Field, inputCls, Panel, Spinner, TextArea, Toggle, useToast } from "./ui";

export type ReleaseValues = {
  version: string; channel: "stable" | "beta" | "experimental"; title: string; summary: string; notesMd: string; compatNotes: string;
  minUpdaterVersion: string | null; retained: boolean; changes: { added: string[]; improved: string[]; fixed: string[]; breaking: string[] };
};
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const CHANGE_FIELDS = [["added", "Added"], ["improved", "Improved"], ["fixed", "Fixed"], ["breaking", "Breaking changes"]] as const;

/** Create (no id) or edit a release's metadata. Version and channel are locked while the release is published. */
export function ReleaseForm({ id, initial, modules, initialModuleId = null, locked }: { id?: string; initial?: ReleaseValues; modules?: { id: string; name: string }[]; initialModuleId?: string | null; locked?: boolean }) {
  const router = useRouter(); const toast = useToast();
  const [moduleId, setModuleId] = useState<string | null>(initialModuleId);
  const [v, setV] = useState<ReleaseValues>(initial ?? { version: "", channel: "stable", title: "", summary: "", notesMd: "", compatNotes: "", minUpdaterVersion: null, retained: true, changes: { added: [], improved: [], fixed: [], breaking: [] } });
  const [text, setText] = useState(() => Object.fromEntries(CHANGE_FIELDS.map(([k]) => [k, (initial?.changes[k] ?? []).join("\n")])) as Record<string, string>);
  const [busy, setBusy] = useState(false), [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ReleaseValues>(k: K, val: ReleaseValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErrors({});
    const body = { ...v, minUpdaterVersion: v.minUpdaterVersion || null, changes: Object.fromEntries(CHANGE_FIELDS.map(([k]) => [k, lines(text[k])])), ...(id ? {} : { moduleId }) };
    if (locked) { delete (body as Partial<typeof body>).version; delete (body as Partial<typeof body>).channel; }
    const r = await api<{ release: { id: string } }>(id ? `/api/owner/releases/${id}` : "/api/owner/releases", { method: id ? "PATCH" : "POST", json: body });
    setBusy(false);
    if (!r.ok) {
      const f = (r.details as { fields?: { path: string; message: string }[] })?.fields;
      if (f) setErrors(Object.fromEntries(f.map((x) => [x.path.split(".")[0], x.message])));
      return toast("error", r.message);
    }
    toast("ok", id ? "Release saved." : "Draft created. Now add its files.");
    if (!id) router.push(`/owner/releases/${r.data.release.id}`); else router.refresh();
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <Panel title="Release" description={locked ? "Version and channel can't change while the release is published." : undefined}>
        <div className="grid gap-4 md:grid-cols-3">
          {!id && modules && (
            <Field label="Product" htmlFor="product" className="md:col-span-3">
              <select id="product" className={inputCls} value={moduleId ?? ""} onChange={(e) => setModuleId(e.target.value || null)}>
                <option value="">Auroras Client launcher</option>
                {modules.map((m) => <option key={m.id} value={m.id}>Module: {m.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Version" htmlFor="version" error={errors.version} hint="Semantic version, e.g. 0.2.0 or 0.2.0-beta.1. Must be unique for the product.">
            <input id="version" required disabled={locked} value={v.version} onChange={(e) => set("version", e.target.value)} className={inputCls + " font-mono"} placeholder="0.2.0" />
          </Field>
          <Field label="Channel" htmlFor="channel" hint="Beta reaches launchers on the preview channel; experimental is never offered automatically.">
            <select id="channel" disabled={locked} value={v.channel} onChange={(e) => set("channel", e.target.value as ReleaseValues["channel"])} className={inputCls}><option value="stable">Stable</option><option value="beta">Beta</option><option value="experimental">Experimental</option></select>
          </Field>
          <Field label="Minimum updater version" htmlFor="minupd" error={errors.minUpdaterVersion} hint="Optional. Launchers older than this should update manually.">
            <input id="minupd" value={v.minUpdaterVersion ?? ""} onChange={(e) => set("minUpdaterVersion", e.target.value || null)} className={inputCls + " font-mono"} placeholder="—" />
          </Field>
          <Field label="Title" htmlFor="title" className="md:col-span-3" error={errors.title}><input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} className={inputCls} placeholder="Auroras Client 0.2.0" /></Field>
          <Field label="Summary" htmlFor="summary" className="md:col-span-3" error={errors.summary} hint="One or two sentences shown on the homepage and in the launcher."><TextArea id="summary" rows={2} value={v.summary} onChange={(e) => set("summary", e.target.value)} className="min-h-[64px]" /></Field>
        </div>
      </Panel>
      <Panel title="Changelog" description="One change per line. These lists feed the changelog, the download page and the launcher's update notes.">
        <div className="grid gap-4 md:grid-cols-2">
          {CHANGE_FIELDS.map(([k, label]) => <Field key={k} label={label} htmlFor={`ch-${k}`}><TextArea id={`ch-${k}`} rows={4} value={text[k]} onChange={(e) => setText((t) => ({ ...t, [k]: e.target.value }))} /></Field>)}
          <Field label="Release notes (Markdown)" htmlFor="notes" className="md:col-span-2" hint="Optional longer notes. Rendered without HTML."><TextArea id="notes" rows={5} value={v.notesMd} onChange={(e) => set("notesMd", e.target.value)} /></Field>
          <Field label="Compatibility notes" htmlFor="compat" className="md:col-span-2"><TextArea id="compat" rows={2} value={v.compatNotes} onChange={(e) => set("compatNotes", e.target.value)} className="min-h-[64px]" /></Field>
        </div>
        <div className="mt-5"><Toggle checked={v.retained} onChange={(x) => set("retained", x)} label="Keep downloadable after newer releases (retain in previous releases)" /></div>
      </Panel>
      <div className="flex justify-end gap-2"><Button type="submit" disabled={busy}>{busy && <Spinner />}{id ? "Save changes" : "Create draft"}</Button></div>
    </form>
  );
}
