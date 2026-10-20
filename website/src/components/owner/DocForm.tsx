"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Markdown } from "../ui/Markdown";
import { api } from "./api";
import { ConfirmDialog, Field, inputCls, Panel, Spinner, TextArea, Toggle, useToast } from "./ui";

export type DocValues = { slug: string; title: string; section: string; summary: string; bodyMd: string; sort: number; published: boolean };
export function DocForm({ id, initial }: { id?: string; initial?: DocValues }) {
  const router = useRouter(); const toast = useToast();
  const [v, setV] = useState<DocValues>(initial ?? { slug: "", title: "", section: "Guides", summary: "", bodyMd: "", sort: 0, published: false });
  const [busy, setBusy] = useState(false), [preview, setPreview] = useState(false), [del, setDel] = useState(false);
  const set = <K extends keyof DocValues>(k: K, val: DocValues[K]) => setV((x) => ({ ...x, [k]: val }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const r = await api<{ doc: { id: string } }>(id ? `/api/owner/docs/${id}` : "/api/owner/docs", { method: id ? "PUT" : "POST", json: v });
    setBusy(false); if (!r.ok) return toast("error", r.message);
    toast("ok", "Page saved."); if (!id) router.push(`/owner/docs/${r.data.doc.id}`); else router.refresh();
  };
  const remove = async () => { setBusy(true); const r = await api(`/api/owner/docs/${id}`, { method: "DELETE" }); setBusy(false); if (!r.ok) return toast("error", r.message); router.push("/owner/docs"); };
  return (
    <form onSubmit={submit} className="space-y-5">
      <Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title" htmlFor="d-title"><input id="d-title" required value={v.title} onChange={(e) => set("title", e.target.value)} className={inputCls} /></Field>
          <Field label="Slug" htmlFor="d-slug" hint="/docs/your-slug"><input id="d-slug" required value={v.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} className={inputCls + " font-mono"} /></Field>
          <Field label="Section" htmlFor="d-section"><input id="d-section" value={v.section} onChange={(e) => set("section", e.target.value)} className={inputCls} /></Field>
          <Field label="Sort order" htmlFor="d-sort"><input id="d-sort" type="number" value={v.sort} onChange={(e) => set("sort", Number(e.target.value) || 0)} className={inputCls} /></Field>
          <Field label="Summary" htmlFor="d-summary" className="md:col-span-2"><input id="d-summary" value={v.summary} onChange={(e) => set("summary", e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="mt-5"><Toggle checked={v.published} onChange={(x) => set("published", x)} label="Published" /></div>
      </Panel>
      <Panel title="Body" actions={<Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>{preview ? "Edit" : "Preview"}</Button>} description="Markdown with tables and code blocks. Raw HTML is not rendered.">
        {preview ? <Markdown>{v.bodyMd || "_Empty_"}</Markdown> : <TextArea aria-label="Body" rows={22} value={v.bodyMd} onChange={(e) => set("bodyMd", e.target.value)} className="font-mono text-[13px]" />}
      </Panel>
      <div className="flex justify-between">{id ? <Button type="button" variant="ghost" onClick={() => setDel(true)}>Delete page</Button> : <span />}<Button type="submit" disabled={busy}>{busy && <Spinner />}Save</Button></div>
      <ConfirmDialog open={del} title="Delete this page?" confirmLabel="Delete" tone="danger" busy={busy} onConfirm={remove} onClose={() => setDel(false)}>It disappears from the public docs immediately.</ConfirmDialog>
    </form>
  );
}
