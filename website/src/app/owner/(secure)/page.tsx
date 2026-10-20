import Link from "next/link";
import { CheckCircle2, CircleAlert, Plus } from "lucide-react";
import { requireOwnerPage } from "@/lib/auth/guard";
import { dashboard } from "@/lib/owner/data";
import { PageHeader } from "@/components/owner/Shell";
import { Badge, ChannelBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate, formatDateTime } from "@/components/ui/format";
import { ResyncButton } from "./ResyncButton";

export const metadata = { title: "Overview" };
const sevTone = { info: "neutral", notice: "blue", warning: "warn", critical: "bad" } as const;

function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string }) {
  const inner = <><p className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-faint">{label}</p><p className="mt-3 text-[28px] font-semibold leading-none tracking-tight">{value}</p>{hint && <p className="mt-2 text-xs text-ink-mute">{hint}</p>}</>;
  return href ? <Link href={href} className="rounded-2xl border border-line bg-night-850/70 p-5 shadow-card transition hover:border-line-strong">{inner}</Link> : <div className="rounded-2xl border border-line bg-night-850/70 p-5 shadow-card">{inner}</div>;
}
function Events({ rows }: { rows: { id: number; at: Date; action: string; actor: string; severity: "info" | "notice" | "warning" | "critical"; detail: unknown }[] }) {
  if (!rows.length) return <p className="text-sm text-ink-faint">Nothing recorded yet.</p>;
  return (
    <ul className="divide-y divide-line">{rows.map((e) => {
      const d = e.detail as Record<string, unknown>;
      return (
        <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0"><p className="truncate"><span className="font-mono text-[12.5px] text-ink">{e.action}</span>{typeof d?.version === "string" && <span className="text-ink-mute"> · {d.version}</span>}{typeof d?.reason === "string" && <span className="text-ink-mute"> · {d.reason}</span>}</p><p className="text-xs text-ink-faint">{e.actor} · {formatDateTime(e.at)}</p></div>
          <Badge tone={sevTone[e.severity]}>{e.severity}</Badge>
        </li>
      );
    })}</ul>
  );
}

export default async function OwnerHome() {
  await requireOwnerPage();
  const d = await dashboard();
  const total30 = d.downloads.reduce((a, x) => a + x.n, 0), max = Math.max(1, ...d.downloads.map((x) => x.n));
  const days = Array.from({ length: 30 }, (_, i) => { const dt = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10); return { day: dt, n: d.downloads.find((x) => String(x.day) === dt)?.n ?? 0 }; });
  return (
    <>
      <PageHeader title="Overview" description="Release state, activity and system health. Every number here comes from the database." actions={<ButtonLink href="/owner/releases/new" size="md"><Plus size={16} />New release</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Published launcher releases" value={d.publishedLauncher} hint={`${d.drafts} draft${d.drafts === 1 ? "" : "s"} · ${d.withdrawn} withdrawn (all products)`} href="/owner/releases" />
        <Stat label="Published modules" value={d.publishedModules} hint={`${d.publishedModuleReleases} published module release${d.publishedModuleReleases === 1 ? "" : "s"}`} href="/owner/modules" />
        <Stat label="Latest stable" value={d.latest.stable ? `v${d.latest.stable.version}` : "—"} hint={d.latest.stable ? `Published ${formatDate(d.latest.stable.publishedAt)}` : "Nothing published"} href={d.latest.stable ? `/owner/releases/${d.latest.stable.id}` : undefined} />
        <Stat label="Downloads, last 30 days" value={total30.toLocaleString("en")} hint="Counted per file per day; no personal data" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-line bg-night-850/70 p-5 shadow-card">
          <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold">Downloads per day</h2><span className="text-xs text-ink-faint">Last 30 days (UTC)</span></div>
          {total30 === 0 ? <p className="mt-10 pb-8 text-center text-sm text-ink-faint">No downloads recorded in the last 30 days.</p> : (
            <div className="mt-6 flex h-36 items-end gap-[3px]" role="img" aria-label={`Downloads per day for the last 30 days, ${total30} in total`}>
              {days.map((x) => <div key={x.day} title={`${x.day}: ${x.n}`} className="flex-1 rounded-t-[3px] bg-gradient-to-t from-aurora-blue/50 to-aurora-cyan/80" style={{ height: `${Math.max(2, (x.n / max) * 100)}%`, opacity: x.n ? 1 : 0.18 }} />)}
            </div>
          )}
        </section>
        <section className="rounded-2xl border border-line bg-night-850/70 p-5 shadow-card">
          <div className="flex items-center justify-between gap-3"><h2 className="text-[15px] font-semibold">Release channels</h2><ResyncButton /></div>
          <ul className="mt-4 space-y-2">
            {(["stable", "beta", "experimental"] as const).map((ch) => { const r = d.latest[ch]; return (
              <li key={ch} className="flex items-center justify-between rounded-xl border border-line bg-night-900/60 px-4 py-3 text-sm"><ChannelBadge channel={ch} />{r ? <Link href={`/owner/releases/${r.id}`} className="text-ink hover:text-aurora-ice">v{r.version} · {formatDate(r.publishedAt)}</Link> : <span className="text-ink-faint">Nothing published</span>}</li>
            ); })}
          </ul>
          <p className="mt-4 text-xs leading-5 text-ink-mute">Update manifest: {d.manifest ? <>generated {formatDateTime(d.manifest.createdAt)} ({d.manifest.reason}), {d.manifest.signed ? <span className="text-ok">signed</span> : <span className="text-warn">unsigned</span>}. <a href="/updates/manifest.json" className="text-aurora-cyan hover:underline">View</a></> : "not generated yet."}</p>
        </section>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-night-850/70 p-5 shadow-card"><div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold">Recent publishing activity</h2><Link href="/owner/audit?q=release." className="text-xs text-aurora-cyan hover:underline">Audit log</Link></div><div className="mt-3"><Events rows={d.recent} /></div></section>
        <section className="rounded-2xl border border-line bg-night-850/70 p-5 shadow-card"><div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold">Recent security events</h2><Link href="/owner/audit?q=auth." className="text-xs text-aurora-cyan hover:underline">Audit log</Link></div><div className="mt-3"><Events rows={d.security} /></div></section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-night-850/70 p-5 shadow-card">
        <h2 className="text-[15px] font-semibold">System health</h2>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {d.health.map((h) => <li key={h.name} className="flex items-start gap-3 rounded-xl border border-line bg-night-900/60 px-4 py-3 text-sm">{h.ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-ok" aria-label="OK" /> : <CircleAlert size={17} className="mt-0.5 shrink-0 text-bad" aria-label="Problem" />}<div className="min-w-0"><p className="font-medium">{h.name}</p><p className="break-words text-xs text-ink-mute">{h.detail}</p></div></li>)}
        </ul>
      </section>
    </>
  );
}
