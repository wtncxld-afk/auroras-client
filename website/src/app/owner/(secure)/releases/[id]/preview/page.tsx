import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { requireOwnerPage } from "@/lib/auth/guard";
import { releaseDetail } from "@/lib/owner/data";
import { isUuid } from "@/lib/owner/params";
import { PageHeader } from "@/components/owner/Shell";
import { Markdown } from "@/components/ui/Markdown";
import { ChannelBadge, CompatBadge, StatusBadge } from "@/components/ui/Badge";
import { formatBytes, formatDate, KIND_LABEL, PLATFORM_LABEL } from "@/components/ui/format";

export const metadata = { title: "Release preview" };
/** Private preview of how a release (draft or not) will read on the public changelog and download page. */
export default async function ReleasePreview({ params }: { params: Promise<{ id: string }> }) {
  await requireOwnerPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await releaseDetail(id);
  if (!d) notFound();
  const r = d.release;
  const groups = [["Added", r.changes.added], ["Improved", r.changes.improved], ["Fixed", r.changes.fixed], ["Breaking changes", r.changes.breaking]] as const;
  return (
    <>
      <PageHeader back={{ href: `/owner/releases/${r.id}`, label: "Back to release" }} title="Preview" description="Only you can see this page. Public pages show the release only after you publish it." />
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-aurora-violet/30 bg-aurora-violet/10 px-4 py-3 text-sm text-ink-soft"><Eye size={16} aria-hidden className="text-aurora-violet" />Preview of {d.module?.name ?? "the launcher"} {r.version}. <StatusBadge status={r.status} /></div>
      <article className="surface max-w-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold tracking-tight">{r.title || `Auroras Client ${r.version}`}</h2><ChannelBadge channel={r.channel} /></div>
        <p className="mt-1 text-sm text-ink-faint">Version {r.version}{r.publishedAt ? ` · ${formatDate(r.publishedAt)}` : " · not published"}</p>
        {r.summary && <p className="mt-4 text-[15px] leading-7 text-ink-soft">{r.summary}</p>}
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {groups.filter(([, xs]) => xs?.length).map(([label, xs]) => (
            <div key={label}><p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">{label}</p><ul className="mt-2 space-y-1.5 text-sm text-ink-soft">{xs.map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-aurora-cyan/80" />{x}</li>)}</ul></div>
          ))}
        </div>
        {r.notesMd && <Markdown className="mt-6">{r.notesMd}</Markdown>}
        {d.compat.length > 0 && (
          <div className="mt-6"><p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Compatibility</p>
            <ul className="mt-2 flex flex-wrap gap-2">{d.compat.map((c) => <li key={c.mcVersion + c.loader} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs">{c.mcVersion} · {c.loader} <CompatBadge status={c.status} /></li>)}</ul>
            {r.compatNotes && <p className="mt-2 text-sm text-ink-mute">{r.compatNotes}</p>}
          </div>
        )}
        <div className="mt-6"><p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Files</p>
          {d.assets.length === 0 ? <p className="mt-2 text-sm text-ink-faint">No files yet.</p> : (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-night-900/60">{d.assets.map((a) => (
              <li key={a.id} className="p-4"><p className="font-mono text-[13px]">{a.filename}</p><p className="mt-1 text-xs text-ink-mute">{PLATFORM_LABEL[a.platform] ?? a.platform} · {KIND_LABEL[a.kind] ?? a.kind}{a.mcVersion ? ` · Minecraft ${a.mcVersion}` : ""} · {formatBytes(a.size)}</p><code className="mono-hash mt-2 block">{a.sha256}</code></li>
            ))}</ul>
          )}
        </div>
      </article>
    </>
  );
}
