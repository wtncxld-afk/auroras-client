"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui/Button";
import { api } from "./api";
import { ConfirmDialog, Field, inputCls, Panel, Spinner, TextArea, Toggle, useToast } from "./ui";

export type ModuleValues = {
  slug: string; name: string; summary: string; descriptionMd: string; category: string; features: string[]; installMd: string; requirementsMd: string;
  knownIssuesMd: string; author: string; docsUrl: string | null; sourceUrl: string | null; status: string; isClientMod: boolean; sort: number;
};
const CATS = [["hud", "HUD"], ["visuals", "Visuals"], ["skies", "Skies"], ["emotes", "Emotes"], ["cosmetics", "Cosmetics"], ["utilities", "Utilities"], ["experimental", "Experimental"]];
const STATUSES = [["draft", "Draft (private)"], ["published", "Published"], ["hidden", "Hidden (not listed, page still reachable)"], ["disabled", "Disabled (not listed, page gone)"]];
const EMPTY: ModuleValues = { slug: "", name: "", summary: "", descriptionMd: "", category: "utilities", features: [], installMd: "", requirementsMd: "", knownIssuesMd: "", author: "Auroras Client", docsUrl: null, sourceUrl: null, status: "draft", isClientMod: false, sort: 0 };

export function ModuleForm({ id, initial, deletable }: { id?: string; initial?: ModuleValues; deletable?: boolean }) {
  const router = useRouter(); const toast = useToast();
  const [v, setV] = useState<ModuleValues>(initial ?? EMPTY);
  const [features, setFeatures] = useState((initial?.features ?? []).join("\n"));
  const [busy, setBusy] = useState(false), [errors, setErrors] = useState<Record<string, string>>({}), [del, setDel] = useState(false);
  const set = <K extends keyof ModuleValues>(k: K, val: ModuleValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErrors({});
    const body = { ...v, docsUrl: v.docsUrl || null, sourceUrl: v.sourceUrl || null, features: features.split("\n").map((x) => x.trim()).filter(Boolean) };
    const r = await api<{ module: { id: string } }>(id ? `/api/owner/modules/${id}` : "/api/owner/modules", { method: id ? "PATCH" : "POST", json: body });
    setBusy(false);
    if (!r.ok) { const f = (r.details as { fields?: { path: string; message: string }[] })?.fields; if (f) setErrors(Object.fromEntries(f.map((x) => [x.path.split(".")[0], x.message]))); return toast("error", r.message); }
    toast("ok", id ? "Module saved." : "Module created.");
    if (!id) router.push(`/owner/modules/${r.data.module.id}`); else router.refresh();
  };
  const remove = async () => { setBusy(true); const r = await api(`/api/owner/modules/${id}`, { method: "DELETE" }); setBusy(false); setDel(false); if (!r.ok) return toast("error", r.message); toast("ok", "Module deleted."); router.push("/owner/modules"); };
  const md = (k: "descriptionMd" | "installMd" | "requirementsMd" | "knownIssuesMd", label: string, rows = 4) => <Field label={label} htmlFor={k} className="md:col-span-2" error={errors[k]}><TextArea id={k} rows={rows} value={v[k]} onChange={(e) => set(k, e.target.value)} /></Field>;
  return (
    <form onSubmit={submit} className="space-y-5">
      <Panel title="Listing">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" htmlFor="name" error={errors.name}><input id="name" required value={v.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></Field>
          <Field label="Slug" htmlFor="slug" error={errors.slug} hint="Used in the page address: /modules/your-slug"><input id="slug" required value={v.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} className={inputCls + " font-mono"} /></Field>
          <Field label="Category" htmlFor="cat"><select id="cat" value={v.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>{CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Visibility" htmlFor="status"><select id="status" value={v.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>{STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Summary" htmlFor="summary" className="md:col-span-2" error={errors.summary}><TextArea id="summary" rows={2} value={v.summary} onChange={(e) => set("summary", e.target.value)} className="min-h-[64px]" /></Field>
          <Field label="Author" htmlFor="author"><input id="author" value={v.author} onChange={(e) => set("author", e.target.value)} className={inputCls} /></Field>
          <Field label="Sort order" htmlFor="sort" hint="Lower numbers are listed first."><input id="sort" type="number" value={v.sort} onChange={(e) => set("sort", Number(e.target.value) || 0)} className={inputCls} /></Field>
          <Field label="Documentation link" htmlFor="docs" error={errors.docsUrl}><input id="docs" value={v.docsUrl ?? ""} onChange={(e) => set("docsUrl", e.target.value || null)} className={inputCls} placeholder="https://" /></Field>
          <Field label="Source code link" htmlFor="src" error={errors.sourceUrl}><input id="src" value={v.sourceUrl ?? ""} onChange={(e) => set("sourceUrl", e.target.value || null)} className={inputCls} placeholder="https://" /></Field>
        </div>
        <div className="mt-5"><Toggle checked={v.isClientMod} onChange={(x) => set("isClientMod", x)} label="This is the Auroras client mod (its releases are listed in the launcher update manifest)" /></div>
      </Panel>
      <Panel title="Page content" description="Markdown, rendered without HTML.">
        <div className="grid gap-4 md:grid-cols-2">
          {md("descriptionMd", "Description", 6)}
          <Field label="Features (one per line)" htmlFor="features" className="md:col-span-2"><TextArea id="features" rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} /></Field>
          {md("installMd", "Installation")}{md("requirementsMd", "Requirements")}{md("knownIssuesMd", "Known issues")}
        </div>
      </Panel>
      <div className="flex justify-between gap-2">
        {id && deletable ? <Button type="button" variant="ghost" onClick={() => setDel(true)}>Delete module</Button> : <span />}
        <Button type="submit" disabled={busy}>{busy && <Spinner />}{id ? "Save changes" : "Create module"}</Button>
      </div>
      <ConfirmDialog open={del} title="Delete this module?" confirmLabel="Delete" tone="danger" busy={busy} onConfirm={remove} onClose={() => setDel(false)}>Its page and images are removed. Modules with releases can't be deleted; hide or disable them instead.</ConfirmDialog>
    </form>
  );
}
