"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { api } from "./api";
import { Field, inputCls, Panel, Spinner, TextArea, Toggle, useToast } from "./ui";

type F = { k: string; label: string; type?: "text" | "area" | "md" | "bool"; hint?: string };
const SIMPLE: Record<string, { title: string; description: string; fields: F[] }> = {
  home: { title: "Homepage", description: "Hero text on the homepage.", fields: [{ k: "eyebrow", label: "Eyebrow" }, { k: "headline", label: "Headline" }, { k: "subheadline", label: "Subheadline", type: "area" }, { k: "previewCaption", label: "Product preview caption" }] },
  community: { title: "Community and support links", description: "Leave a link empty to hide it. Only https:// links are accepted.", fields: [{ k: "discordUrl", label: "Discord invite", hint: "Empty until you have a public invite link." }, { k: "githubUrl", label: "GitHub" }, { k: "issuesUrl", label: "Bug reports (issues)" }, { k: "featuredServerName", label: "Featured server name" }, { k: "featuredServer", label: "Featured server address" }, { k: "supportEmail", label: "Support email", hint: "Optional." }] },
  maintenance: { title: "Maintenance banner", description: "Shown at the top of every public page while enabled.", fields: [{ k: "enabled", label: "Show maintenance banner", type: "bool" }, { k: "message", label: "Message", type: "area" }] },
  downloads: { title: "Download page", description: "Text around the download files.", fields: [{ k: "intro", label: "Intro", type: "area" }, { k: "signingNote", label: "Signing and verification note", type: "area" }] },
  legal: { title: "Privacy and terms", description: "Markdown, rendered without HTML. Have these reviewed before relying on them.", fields: [{ k: "privacyMd", label: "Privacy policy", type: "md" }, { k: "termsMd", label: "Terms of use", type: "md" }] },
};
type Row = { mc: string; loader: string; status: string; note: string };
type Plat = { os: string; status: string; note: string };

function useSave(key: string) {
  const toast = useToast(); const router = useRouter(); const [busy, setBusy] = useState(false);
  const save = async (value: unknown) => { setBusy(true); const r = await api(`/api/owner/settings/${key}`, { method: "PUT", json: { value } }); setBusy(false); if (!r.ok) return toast("error", r.message); toast("ok", "Saved. Public pages update within a few seconds."); router.refresh(); };
  return { busy, save };
}
const SaveBar = ({ busy }: { busy: boolean }) => <div className="mt-5 flex justify-end"><Button type="submit" disabled={busy}>{busy && <Spinner />}Save</Button></div>;

export function SimpleSetting({ settingKey, value }: { settingKey: keyof typeof SIMPLE; value: Record<string, unknown> }) {
  const spec = SIMPLE[settingKey]; const [v, setV] = useState(value); const { busy, save } = useSave(settingKey);
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(v); }}>
      <Panel title={spec.title} description={spec.description}>
        <div className="grid gap-4 md:grid-cols-2">
          {spec.fields.map((f) => {
            const id = `${settingKey}-${f.k}`, val = v[f.k];
            if (f.type === "bool") return <div key={f.k} className="md:col-span-2"><Toggle id={id} checked={!!val} onChange={(x) => setV({ ...v, [f.k]: x })} label={f.label} /></div>;
            if (f.type === "area" || f.type === "md") return <Field key={f.k} label={f.label} htmlFor={id} hint={f.hint} className="md:col-span-2"><TextArea id={id} rows={f.type === "md" ? 10 : 3} value={String(val ?? "")} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} /></Field>;
            return <Field key={f.k} label={f.label} htmlFor={id} hint={f.hint}><input id={id} value={String(val ?? "")} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} className={inputCls} /></Field>;
          })}
        </div>
        <SaveBar busy={busy} />
      </Panel>
    </form>
  );
}

export function VersionsSetting({ value }: { value: { summary: string; rows: Row[]; platforms: Plat[] } }) {
  const [v, setV] = useState(value); const { busy, save } = useSave("supportedVersions");
  const setRow = (i: number, p: Partial<Row>) => setV({ ...v, rows: v.rows.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  const setPlat = (i: number, p: Partial<Plat>) => setV({ ...v, platforms: v.platforms.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(v); }}>
      <Panel title="Supported versions" description="The table on the homepage and download page. Mark a version tested only after it has really been tested in game.">
        <Field label="Summary" htmlFor="sv-summary"><TextArea id="sv-summary" rows={2} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} className="min-h-[64px]" /></Field>
        <div className="mt-5 space-y-2">
          {v.rows.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[120px_120px_150px_1fr_auto]">
              <input aria-label="Minecraft version" value={r.mc} onChange={(e) => setRow(i, { mc: e.target.value })} className={inputCls + " font-mono"} placeholder="1.21.11" />
              <input aria-label="Loader" value={r.loader} onChange={(e) => setRow(i, { loader: e.target.value })} className={inputCls} placeholder="Fabric" />
              <select aria-label="Status" value={r.status} onChange={(e) => setRow(i, { status: e.target.value })} className={inputCls}><option value="tested">Tested</option><option value="partial">Partial</option><option value="experimental">Experimental</option><option value="unsupported">Unsupported</option></select>
              <input aria-label="Note" value={r.note} onChange={(e) => setRow(i, { note: e.target.value })} className={inputCls} placeholder="Note" />
              <button type="button" aria-label="Remove row" onClick={() => setV({ ...v, rows: v.rows.filter((_, j) => j !== i) })} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-faint hover:text-bad"><Trash2 size={15} /></button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setV({ ...v, rows: [...v.rows, { mc: "", loader: "Fabric", status: "experimental", note: "" }] })}><Plus size={14} />Add version</Button>
        </div>
        <h3 className="mt-6 text-sm font-semibold">Platforms</h3>
        <div className="mt-2 space-y-2">
          {v.platforms.map((p, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[160px_150px_1fr_auto]">
              <input aria-label="Operating system" value={p.os} onChange={(e) => setPlat(i, { os: e.target.value })} className={inputCls} />
              <select aria-label="Platform status" value={p.status} onChange={(e) => setPlat(i, { status: e.target.value })} className={inputCls}><option value="available">Available</option><option value="planned">Planned</option></select>
              <input aria-label="Platform note" value={p.note} onChange={(e) => setPlat(i, { note: e.target.value })} className={inputCls} />
              <button type="button" aria-label="Remove platform" onClick={() => setV({ ...v, platforms: v.platforms.filter((_, j) => j !== i) })} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line text-ink-faint hover:text-bad"><Trash2 size={15} /></button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setV({ ...v, platforms: [...v.platforms, { os: "", status: "planned", note: "" }] })}><Plus size={14} />Add platform</Button>
        </div>
        <SaveBar busy={busy} />
      </Panel>
    </form>
  );
}

export function FeatureCopySetting({ value, features }: { value: Record<string, { title: string; body: string }>; features: { id: string; title: string; body: string }[] }) {
  const [v, setV] = useState(value); const { busy, save } = useSave("featureCopy");
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(Object.fromEntries(Object.entries(v).filter(([, x]) => x.title.trim() || x.body.trim()).map(([k, x]) => [k, { title: x.title.trim() || features.find((f) => f.id === k)!.title, body: x.body.trim() || features.find((f) => f.id === k)!.body }]))); }}>
      <Panel title="Feature copy" description="Override the wording of a feature on the homepage and features page. Empty fields use the built-in text. What a feature does and its availability come from the product itself and can't be changed here.">
        <div className="space-y-4">
          {features.map((f) => (
            <div key={f.id} className="grid gap-2 rounded-xl border border-line p-3 md:grid-cols-[240px_1fr]">
              <input aria-label={`${f.title} title`} value={v[f.id]?.title ?? ""} placeholder={f.title} onChange={(e) => setV({ ...v, [f.id]: { title: e.target.value, body: v[f.id]?.body ?? "" } })} className={inputCls} />
              <TextArea aria-label={`${f.title} description`} rows={2} value={v[f.id]?.body ?? ""} placeholder={f.body} onChange={(e) => setV({ ...v, [f.id]: { title: v[f.id]?.title ?? "", body: e.target.value } })} className="min-h-[64px]" />
            </div>
          ))}
        </div>
        <SaveBar busy={busy} />
      </Panel>
    </form>
  );
}
