"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Monitor } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { formatDateTime } from "../ui/format";
import { CopyButton } from "../site/CopyButton";
import { api } from "./api";
import { ConfirmDialog, Field, inputCls, Panel, Spinner, Toggle, useToast } from "./ui";

type S = { id: string; createdAt: string; lastSeenAt: string; expiresAt: string; userAgent: string | null; current: boolean };
const browser = (ua: string | null) => { if (!ua) return "Unknown browser"; const b = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser"; const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : ""; return os ? `${b} on ${os}` : b; };

export function SessionsPanel({ sessions }: { sessions: S[] }) {
  const router = useRouter(); const toast = useToast(); const [busy, setBusy] = useState(false);
  const revoke = async (id: string) => { const r = await api(`/api/owner/sessions/${id}`, { method: "DELETE" }); if (!r.ok) return toast("error", r.message); toast("ok", "Session signed out."); router.refresh(); };
  const others = async () => { setBusy(true); const r = await api<{ revoked: number }>("/api/owner/sessions/revoke-others", { method: "POST" }); setBusy(false); if (!r.ok) return toast("error", r.message); toast("ok", `${r.data.revoked} other session${r.data.revoked === 1 ? "" : "s"} signed out.`); router.refresh(); };
  return (
    <Panel title="Active sessions" description="Each sign-in is a server-side session bound to the browser that created it. Signing out here takes effect immediately." actions={sessions.length > 1 ? <Button variant="ghost" size="sm" onClick={others} disabled={busy}>{busy && <Spinner />}Sign out all others</Button> : undefined}>
      <ul className="divide-y divide-line">{sessions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
          <div className="flex min-w-0 items-start gap-3"><Monitor size={17} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden /><div className="min-w-0"><p className="font-medium">{browser(s.userAgent)} {s.current && <Badge tone="ok" className="ml-1">This browser</Badge>}</p><p className="text-xs text-ink-faint">Signed in {formatDateTime(s.createdAt)} · last active {formatDateTime(s.lastSeenAt)} · expires {formatDateTime(s.expiresAt)}</p></div></div>
          {!s.current && <Button variant="ghost" size="sm" onClick={() => revoke(s.id)}>Sign out</Button>}
        </li>
      ))}</ul>
    </Panel>
  );
}

type T = { id: string; name: string; scopes: string[]; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };
export function CiTokensPanel({ tokens }: { tokens: T[] }) {
  const router = useRouter(); const toast = useToast();
  const [name, setName] = useState("GitHub Actions"), [pub, setPub] = useState(false), [busy, setBusy] = useState(false), [shown, setShown] = useState<string | null>(null), [rev, setRev] = useState<T | null>(null);
  const create = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); const r = await api<{ token: string }>("/api/owner/ci-tokens", { method: "POST", json: { name, allowPublish: pub } }); setBusy(false); if (!r.ok) return toast("error", r.message); setShown(r.data.token); router.refresh(); };
  const revoke = async () => { if (!rev) return; setBusy(true); const r = await api(`/api/owner/ci-tokens/${rev.id}`, { method: "DELETE" }); setBusy(false); setRev(null); if (!r.ok) return toast("error", r.message); toast("ok", "Token revoked."); router.refresh(); };
  return (
    <Panel title="CI tokens" description="Let a CI workflow create draft releases and upload files. A token with publish rights can also publish; keep publishing behind a manual approval in your CI. Tokens are stored only as hashes.">
      {shown && (
        <div className="mb-5 rounded-xl border border-aurora-cyan/30 bg-aurora-cyan/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-medium"><KeyRound size={15} className="text-aurora-cyan" />Copy this token now. It won&apos;t be shown again.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><code className="mono-hash break-all">{shown}</code><CopyButton value={shown} /></div>
          <p className="mt-2 text-xs text-ink-mute">Store it as the repository secret <code className="font-mono">AURORAS_SITE_CI_TOKEN</code>.</p>
        </div>
      )}
      <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Token name" htmlFor="ci-name"><input id="ci-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Button type="submit" disabled={busy}>{busy && <Spinner />}Create token</Button>
        <div className="sm:col-span-2"><Toggle checked={pub} onChange={setPub} label="Allow publishing (not only drafts)" /></div>
      </form>
      {tokens.length > 0 && (
        <ul className="mt-5 divide-y divide-line">{tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div className="min-w-0"><p className="font-medium">{t.name} {t.revokedAt ? <Badge tone="bad" className="ml-1">Revoked</Badge> : t.scopes.includes("releases:publish") ? <Badge tone="warn" className="ml-1">Draft + publish</Badge> : <Badge className="ml-1">Drafts only</Badge>}</p><p className="text-xs text-ink-faint">Created {formatDateTime(t.createdAt)} · last used {t.lastUsedAt ? formatDateTime(t.lastUsedAt) : "never"}</p></div>
            {!t.revokedAt && <Button variant="ghost" size="sm" onClick={() => setRev(t)}>Revoke</Button>}
          </li>
        ))}</ul>
      )}
      <ConfirmDialog open={!!rev} title={`Revoke “${rev?.name}”?`} confirmLabel="Revoke" tone="danger" busy={busy} onConfirm={revoke} onClose={() => setRev(null)}>Any workflow using it stops working immediately.</ConfirmDialog>
    </Panel>
  );
}
