"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Download, Eye, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatBytes, formatDateTime, KIND_LABEL, PLATFORM_LABEL } from "../ui/format";
import { CopyButton } from "../site/CopyButton";
import { api, uploadFile } from "./api";
import { ConfirmDialog, Empty, Field, inputCls, Panel, Spinner, Toggle, useToast } from "./ui";

type Asset = { id: string; filename: string; size: number; sha256: string; kind: string; platform: string; arch: string; mcVersion: string | null; loader: string | null; storage: string; checksumSource: string; validation: { checks: { name: string; ok: boolean; detail?: string }[] }; createdAt: string };
type Compat = { mcVersion: string; loader: string; status: string; notes: string };
type Dep = { name: string; versionRange: string; required: boolean; url: string | null; moduleId: string | null };
type Check = { name: string; ok: boolean; detail: string };
type Hook = { name: string; ok: boolean; detail: string };
export type ManagerProps = {
  id: string; version: string; status: string; channel: string; isModule: boolean; isClientMod: boolean;
  assets: Asset[]; compat: Compat[]; deps: Dep[]; downloads: Record<string, number>;
  rollbackTargets: { id: string; version: string; status: string }[];
  history: { id: number; at: string; action: string; actor: string; severity: string; detail: Record<string, unknown> }[];
};

export function ReleaseManager(p: ManagerProps) {
  const router = useRouter(); const toast = useToast();
  const editable = p.status === "draft" || p.status === "unpublished";
  const [pf, setPf] = useState<{ ok: boolean; checks: Check[] } | null>(null);
  const [dialog, setDialog] = useState<null | "publish" | "unpublish" | "withdraw" | "rollback" | "delete" | { asset: Asset }>(null);
  const [busy, setBusy] = useState(false), [reason, setReason] = useState(""), [target, setTarget] = useState(p.rollbackTargets[0]?.id ?? ""), [withdrawCur, setWithdrawCur] = useState(false);
  const loadPf = useCallback(async () => { const r = await api<{ ok: boolean; checks: Check[] }>(`/api/owner/releases/${p.id}/preflight`); if (r.ok) setPf(r.data); }, [p.id]);
  useEffect(() => { loadPf(); }, [loadPf, p.assets.length, p.status]);

  const report = (hooks: Hook[] | undefined, okText: string) => {
    const bad = (hooks ?? []).filter((h) => !h.ok);
    toast(bad.length ? "error" : "ok", bad.length ? `${okText} Follow-up step failed: ${bad.map((h) => `${h.name} (${h.detail})`).join("; ")}. Use Retry sync on the overview.` : okText);
  };
  const act = async (path: string, json: unknown, okText: string) => {
    setBusy(true); const r = await api<{ hooks?: Hook[] }>(`/api/owner/releases/${p.id}/${path}`, { method: "POST", json }); setBusy(false);
    if (!r.ok) { const checks = (r.details as { checks?: Check[] })?.checks; if (checks) setPf({ ok: false, checks }); toast("error", r.message); return false; }
    setDialog(null); report(r.data.hooks, okText); router.refresh(); return true;
  };
  return (
    <div className="space-y-5">
      <FilesPanel {...p} editable={editable} onChanged={() => { router.refresh(); loadPf(); }} onDelete={(a) => setDialog({ asset: a })} />
      <div className="grid gap-5 lg:grid-cols-2">
        <CompatEditor id={p.id} initial={p.compat} />
        <DepsEditor id={p.id} initial={p.deps} />
      </div>
      <Panel title={editable ? "Review and publish" : "Release state"} description={editable ? "Everything below must pass before the release can go live. Publishing updates the homepage, downloads, changelog and the signed launcher manifest in one transaction." : "This release is live or withdrawn. Changing its state updates the homepage, downloads, changelog and signed manifest together."}
        actions={<><Button variant="subtle" size="sm" onClick={loadPf}><RefreshCw size={14} />Re-check</Button><Link href={`/owner/releases/${p.id}/preview`} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-night-800 px-3 text-[13px] text-ink-soft hover:text-ink"><Eye size={14} />Preview</Link></>}>
        {!pf ? <p className="flex items-center gap-2 text-sm text-ink-mute"><Spinner />Checking…</p> : (
          <ul className="grid gap-2 md:grid-cols-2">
            {pf.checks.filter((c) => editable || c.name !== "Status allows publishing").map((c) => <li key={c.name} className="flex items-start gap-3 rounded-xl border border-line bg-night-900/60 px-4 py-2.5 text-sm">{c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" aria-label="Passed" /> : <CircleAlert size={16} className="mt-0.5 shrink-0 text-bad" aria-label="Failed" />}<div className="min-w-0"><p className="font-medium">{c.name}</p><p className="break-words text-xs text-ink-mute">{c.detail}</p></div></li>)}
          </ul>
        )}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
          {editable && <Button onClick={() => setDialog("publish")} disabled={!pf?.ok}>Publish release</Button>}
          {p.status === "published" && <Button variant="secondary" onClick={() => setDialog("unpublish")}>Unpublish</Button>}
          {p.status === "published" && p.rollbackTargets.length > 0 && <Button variant="secondary" onClick={() => setDialog("rollback")}>Roll back…</Button>}
          {p.status !== "withdrawn" && p.status !== "draft" && <Button variant="danger" onClick={() => setDialog("withdraw")}>Withdraw</Button>}
          {p.status === "draft" && <Button variant="danger" onClick={() => setDialog("delete")}><Trash2 size={14} />Delete draft</Button>}
        </div>
      </Panel>

      <Panel title="History" description="Everything that happened to this release, from the audit log.">
        {p.history.length === 0 ? <p className="text-sm text-ink-faint">No events yet.</p> : (
          <ol className="space-y-2.5">{p.history.map((h) => <li key={h.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm"><span className="font-mono text-[12.5px] text-ink">{h.action}</span><span className="text-xs text-ink-faint">{h.actor} · {formatDateTime(h.at)}</span>{typeof h.detail.filename === "string" && <span className="text-xs text-ink-mute">{h.detail.filename}</span>}{typeof h.detail.reason === "string" && <span className="text-xs text-ink-mute">“{h.detail.reason}”</span>}</li>)}</ol>
        )}
      </Panel>

      <ConfirmDialog open={dialog === "publish"} title={`Publish ${p.version}?`} confirmLabel="Publish now" busy={busy} onClose={() => setDialog(null)} onConfirm={() => act("publish", { confirm: true }, `Version ${p.version} is live.`)}>
        <p>This makes it public immediately:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5"><li>{p.isModule ? "The module page, catalog and version history" : "The homepage, download buttons, downloads page and changelog"} show {p.version}{p.channel === "stable" ? " as the latest stable release" : ` on the ${p.channel} channel`}.</li>{(!p.isModule || p.isClientMod) && <li>The signed update manifest is regenerated, so launchers {p.channel === "experimental" ? "can see it under experimental" : "are offered it"}.</li>}<li>The publication is recorded in the audit log.</li></ul>
      </ConfirmDialog>
      <ConfirmDialog open={dialog === "unpublish"} title={`Unpublish ${p.version}?`} confirmLabel="Unpublish" busy={busy} onClose={() => setDialog(null)} onConfirm={() => act("unpublish", { confirm: true }, `${p.version} is no longer public.`)}>
        It disappears from the website and the manifest, and its downloads stop working. The previous published release becomes the latest. You can publish it again later.
      </ConfirmDialog>
      <ConfirmDialog open={dialog === "withdraw"} title={`Withdraw ${p.version}?`} tone="danger" confirmLabel="Withdraw release" busy={busy} confirmDisabled={reason.trim().length < 4} onClose={() => setDialog(null)} onConfirm={() => act("withdraw", { reason }, `${p.version} was withdrawn.`)}>
        <p>For broken or compromised builds. Downloads stop immediately, the release is removed from the manifest and listed there as withdrawn, and the changelog shows the reason. This can&apos;t be undone.</p>
        <Field label="Reason (public)" htmlFor="wreason" className="mt-4"><input id="wreason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="e.g. Crashes on start for some Windows 10 users" /></Field>
      </ConfirmDialog>
      <ConfirmDialog open={dialog === "rollback"} title="Roll back to an earlier release" confirmLabel="Roll back" busy={busy} confirmDisabled={!target || (withdrawCur && reason.trim().length < 4)} onClose={() => setDialog(null)} onConfirm={() => act("rollback", { targetId: target, withdrawCurrent: withdrawCur, reason }, "Rolled back.")}>
        <p>The chosen release becomes the current {p.channel} release again; {p.version} and anything newer in this channel are taken down. Launchers that already installed {p.version} are not downgraded automatically.</p>
        <Field label="Roll back to" htmlFor="rtarget" className="mt-4"><select id="rtarget" value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>{p.rollbackTargets.map((t) => <option key={t.id} value={t.id}>{t.version} ({t.status})</option>)}</select></Field>
        <div className="mt-4"><Toggle checked={withdrawCur} onChange={setWithdrawCur} label={`Also withdraw ${p.version} (broken or compromised)`} /></div>
        {withdrawCur && <Field label="Reason (public)" htmlFor="rreason" className="mt-3"><input id="rreason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} /></Field>}
      </ConfirmDialog>
      <ConfirmDialog open={dialog === "delete"} title={`Delete draft ${p.version}?`} tone="danger" confirmLabel="Delete draft" busy={busy} onClose={() => setDialog(null)} onConfirm={async () => { setBusy(true); const r = await api(`/api/owner/releases/${p.id}`, { method: "DELETE" }); setBusy(false); if (!r.ok) return toast("error", r.message); toast("ok", "Draft deleted."); router.push("/owner/releases"); }}>
        The draft and its uploaded files are deleted permanently.
      </ConfirmDialog>
      <ConfirmDialog open={typeof dialog === "object" && dialog !== null} title="Remove this file?" tone="danger" confirmLabel="Remove file" busy={busy} onClose={() => setDialog(null)} onConfirm={async () => {
        if (typeof dialog !== "object" || !dialog) return; setBusy(true); const r = await api(`/api/owner/releases/${p.id}/assets/${dialog.asset.id}`, { method: "DELETE" }); setBusy(false);
        if (!r.ok) return toast("error", r.message); setDialog(null); toast("ok", "File removed."); router.refresh();
      }}>{typeof dialog === "object" && dialog ? <span className="font-mono text-ink">{dialog.asset.filename}</span> : null} will be deleted from storage.</ConfirmDialog>
    </div>
  );
}

function FilesPanel(p: ManagerProps & { editable: boolean; onChanged: () => void; onDelete: (a: Asset) => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null), [pct, setPct] = useState<number | null>(null), [failed, setFailed] = useState<{ name: string; ok: boolean; detail?: string }[] | null>(null);
  const [kind, setKind] = useState(p.isModule ? (p.isClientMod ? "mod_jar" : "module_package") : "installer"), [platform, setPlatform] = useState(p.isModule ? "any" : "windows"), [arch, setArch] = useState(p.isModule ? "any" : "x64"), [mc, setMc] = useState(""), [loader, setLoader] = useState("fabric");
  const upload = async (e: React.FormEvent) => {
    e.preventDefault(); if (!file) return; setFailed(null); setPct(0);
    const q = new URLSearchParams({ filename: file.name, kind, platform, arch, ...(kind === "mod_jar" || p.isModule ? (mc ? { mc } : {}) : {}), ...(kind === "mod_jar" ? { loader } : {}) });
    const r = await uploadFile(`/api/owner/releases/${p.id}/assets?${q}`, file, setPct);
    setPct(null);
    if (!r.ok) { setFailed((r.details as { checks?: { name: string; ok: boolean; detail?: string }[] })?.checks ?? null); return toast("error", r.message); }
    toast("ok", `${file.name} uploaded and checksummed.`); setFile(null); (e.target as HTMLFormElement).reset(); p.onChanged();
  };
  return (
    <Panel title="Files" description={p.editable ? "Upload each build. The server checks the type from the file's contents, enforces the size limit and computes the SHA-256." : "Files of a published or withdrawn release can't change. Unpublish to edit."}>
      {p.assets.length === 0 ? <Empty title="No files yet">{p.editable ? "Upload the installer or package below." : ""}</Empty> : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {p.assets.map((a) => (
            <li key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all font-mono text-[13px] text-ink">{a.filename}</p>
                  <p className="mt-1 text-xs text-ink-mute">{KIND_LABEL[a.kind]} · {PLATFORM_LABEL[a.platform]}{a.platform !== "any" ? ` ${a.arch}` : ""}{a.mcVersion ? ` · Minecraft ${a.mcVersion}` : ""}{a.loader ? ` · ${a.loader}` : ""} · {formatBytes(a.size)} · {a.storage === "external" ? "hosted externally" : `stored (${a.storage})`}{p.downloads[a.id] ? ` · ${p.downloads[a.id]} downloads` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`/api/owner/releases/${p.id}/assets/${a.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] text-ink-soft hover:text-ink"><Download size={14} />Download</a>
                  {p.editable && <Button variant="danger" size="sm" onClick={() => p.onDelete(a)} aria-label={`Remove ${a.filename}`}><Trash2 size={14} /></Button>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone={a.checksumSource === "server" ? "ok" : "blue"}>SHA-256 {a.checksumSource === "server" ? "computed on upload" : "imported"}</Badge><code className="mono-hash">{a.sha256}</code><CopyButton value={a.sha256} /></div>
              <ul className="mt-2 flex flex-wrap gap-1.5">{a.validation.checks.map((c) => <li key={c.name}><Badge tone={c.ok ? "neutral" : "bad"}>{c.ok ? "✓" : "✗"} {c.name}{c.detail ? `: ${c.detail}` : ""}</Badge></li>)}</ul>
            </li>
          ))}
        </ul>
      )}
      {p.editable && (
        <form onSubmit={upload} className="mt-5 rounded-xl border border-dashed border-line-strong bg-night-900/40 p-4">
          <div className="grid gap-3 md:grid-cols-6">
            <Field label="File" htmlFor="file" className="md:col-span-6"><input id="file" type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-ink-mute file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-ink hover:file:bg-white/15" /></Field>
            <Field label="Type" htmlFor="kind" className="md:col-span-2"><select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>{Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Platform" htmlFor="platform"><select id="platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>{Object.entries(PLATFORM_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Architecture" htmlFor="arch"><select id="arch" value={arch} onChange={(e) => setArch(e.target.value)} className={inputCls}>{["x64", "arm64", "universal", "any"].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Minecraft" htmlFor="mc"><input id="mc" value={mc} onChange={(e) => setMc(e.target.value)} placeholder={kind === "mod_jar" ? "26.3" : "—"} className={inputCls + " font-mono"} /></Field>
            <Field label="Loader" htmlFor="loader"><select id="loader" value={loader} onChange={(e) => setLoader(e.target.value)} className={inputCls} disabled={kind !== "mod_jar"}>{["fabric", "quilt", "neoforge", "forge"].map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div>
          {pct !== null && <div className="mt-4" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress"><div className="h-1.5 overflow-hidden rounded-full bg-night-700"><div className="h-full rounded-full bg-gradient-to-r from-aurora-blue to-aurora-cyan transition-all" style={{ width: `${pct}%` }} /></div><p className="mt-1.5 text-xs text-ink-mute">{pct < 100 ? `Uploading… ${pct}%` : "Checking and hashing on the server…"}</p></div>}
          {failed && <ul className="mt-4 space-y-1 rounded-xl border border-bad/30 bg-bad/10 p-3 text-xs">{failed.map((c) => <li key={c.name} className={c.ok ? "text-ink-mute" : "text-[#ffc9c9]"}>{c.ok ? "✓" : "✗"} {c.name}{c.detail ? ` — ${c.detail}` : ""}</li>)}</ul>}
          <div className="mt-4 flex justify-end"><Button type="submit" size="sm" disabled={!file || pct !== null}><Upload size={14} />Upload</Button></div>
        </form>
      )}
    </Panel>
  );
}

function CompatEditor({ id, initial }: { id: string; initial: Compat[] }) {
  const toast = useToast(); const router = useRouter();
  const [rows, setRows] = useState<Compat[]>(initial), [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); const r = await api(`/api/owner/releases/${id}/compat`, { method: "PUT", json: { items: rows } }); setBusy(false); if (!r.ok) return toast("error", r.message); toast("ok", "Compatibility saved."); router.refresh(); };
  return (
    <Panel title="Compatibility" description="Only claim Tested for what was verified in a real game." actions={<Button size="sm" variant="subtle" onClick={() => setRows((r) => [...r, { mcVersion: "", loader: "fabric", status: "experimental", notes: "" }])}>Add row</Button>}>
      {rows.length === 0 ? <p className="text-sm text-ink-faint">No compatibility rows.</p> : (
        <ul className="space-y-2">{rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-2">
            <input aria-label="Minecraft version" value={r.mcVersion} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, mcVersion: e.target.value } : y)))} placeholder="26.3" className={inputCls + " font-mono"} />
            <select aria-label="Loader" value={r.loader} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, loader: e.target.value } : y)))} className={inputCls}>{["fabric", "quilt", "neoforge", "forge", "vanilla"].map((l) => <option key={l}>{l}</option>)}</select>
            <select aria-label="State" value={r.status} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, status: e.target.value } : y)))} className={inputCls}><option value="tested">Tested</option><option value="partial">Partially supported</option><option value="experimental">Experimental</option><option value="unsupported">Unsupported</option></select>
            <Button variant="ghost" size="sm" aria-label="Remove row" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="h-10"><Trash2 size={14} /></Button>
          </li>
        ))}</ul>
      )}
      <div className="mt-4 flex justify-end"><Button size="sm" onClick={save} disabled={busy}>{busy && <Spinner />}Save compatibility</Button></div>
    </Panel>
  );
}
function DepsEditor({ id, initial }: { id: string; initial: Dep[] }) {
  const toast = useToast(); const router = useRouter();
  const [rows, setRows] = useState<Dep[]>(initial), [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); const r = await api(`/api/owner/releases/${id}/dependencies`, { method: "PUT", json: { items: rows.map((r) => ({ ...r, url: r.url || null })) } }); setBusy(false); if (!r.ok) return toast("error", r.message); toast("ok", "Dependencies saved."); router.refresh(); };
  return (
    <Panel title="Dependencies" description="Required mods or software, with https links." actions={<Button size="sm" variant="subtle" onClick={() => setRows((r) => [...r, { name: "", versionRange: "", required: true, url: "", moduleId: null }])}>Add</Button>}>
      {rows.length === 0 ? <p className="text-sm text-ink-faint">No dependencies.</p> : (
        <ul className="space-y-3">{rows.map((r, i) => (
          <li key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-line p-3">
            <input aria-label="Name" value={r.name} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="Fabric API" className={inputCls} />
            <input aria-label="Version range" value={r.versionRange} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, versionRange: e.target.value } : y)))} placeholder="Version" className={inputCls} />
            <input aria-label="Link" value={r.url ?? ""} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} placeholder="https://…" className={inputCls + " col-span-2"} />
            <div className="col-span-2 flex items-center justify-between"><Toggle checked={r.required} onChange={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, required: v } : y)))} label="Required" /><Button variant="ghost" size="sm" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} />Remove</Button></div>
          </li>
        ))}</ul>
      )}
      <div className="mt-4 flex justify-end"><Button size="sm" onClick={save} disabled={busy}>{busy && <Spinner />}Save dependencies</Button></div>
    </Panel>
  );
}
