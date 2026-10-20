import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Code2, ExternalLink } from "lucide-react";
import { ModuleIcon } from "@/components/site/ModuleIcon";
import { ReleaseFiles } from "@/components/site/ReleaseFiles";
import { Markdown } from "@/components/ui/Markdown";
import { Badge, ChannelBadge, CompatBadge } from "@/components/ui/Badge";
import { CATEGORY_LABEL, formatDate } from "@/components/ui/format";
import { getModule } from "@/lib/public-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const m = await getModule((await params).slug);
  return m ? { title: m.name, description: m.summary } : { title: "Module not found" };
}

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24"><h2 id={`${id}-h`} className="text-lg font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) notFound();
  const m = await getModule(slug);
  if (!m) notFound();
  const l = m.latest, published = m.releases.filter((r) => r.status === "published");
  const toc = [["overview", "Overview"], ...(m.previews.length ? [["previews", "Previews"]] : []), ["downloads", "Downloads"], ["install", "Installation"], ["requirements", "Requirements"], ["compat", "Supported versions"], ...(m.knownIssuesMd ? [["issues", "Known issues"]] : []), ["history", "Version history"]];
  return (
    <div className="container-page py-10">
      <Link href="/modules" className="inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-ink"><ArrowLeft size={15} /> All modules</Link>
      <header className="mt-6 flex flex-col gap-6 border-b border-white/[0.06] pb-10 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-5">
          <ModuleIcon icon={m.icon} name={m.name} isClientMod={m.isClientMod} size={72} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[30px] font-semibold leading-tight sm:text-[36px]">{m.name}</h1><Badge>{CATEGORY_LABEL[m.category] ?? m.category}</Badge></div>
            <p className="mt-2 max-w-2xl text-[15.5px] leading-7 text-ink-mute">{m.summary}</p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-faint">
              <span>by {m.author}</span>
              {l && <><span aria-hidden>·</span><span>v{l.version}</span><ChannelBadge channel={l.channel} /><span aria-hidden>·</span><span>{formatDate(l.publishedAt)}</span></>}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {m.docsUrl && <a href={m.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-aurora-cyan hover:underline"><BookOpen size={15} />Documentation<ExternalLink size={12} /></a>}
              {m.sourceUrl && <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-aurora-cyan hover:underline"><Code2 size={15} />Source code<ExternalLink size={12} /></a>}
            </div>
          </div>
        </div>
        {l && <a href="#downloads" className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-[#9cecff] to-[#5fc9f5] px-5 text-sm font-medium text-[#04121c] shadow-[0_10px_30px_-10px_rgba(95,201,245,0.7)]">Downloads</a>}
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[200px_1fr]">
        <nav aria-label="On this page" className="hidden lg:block"><ul className="sticky top-24 space-y-1 text-sm">{toc.map(([id, t]) => <li key={id}><a href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-ink-mute hover:bg-white/[0.04] hover:text-ink">{t}</a></li>)}</ul></nav>
        <div className="min-w-0 space-y-14">
          <Block id="overview" title="Overview">
            <Markdown>{m.descriptionMd}</Markdown>
            {m.features.length > 0 && <ul className="mt-6 grid gap-2 sm:grid-cols-2">{m.features.map((f) => <li key={f} className="flex gap-2.5 rounded-xl border border-line bg-night-900/50 p-3 text-sm text-ink-soft"><span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-aurora-cyan" />{f}</li>)}</ul>}
          </Block>
          {m.previews.length > 0 && (
            <Block id="previews" title="Previews">
              <div className="grid gap-4 sm:grid-cols-2">{m.previews.map((p) => <figure key={p.url} className="overflow-hidden rounded-2xl border border-line bg-night-900"><Image src={p.url} alt={p.alt || `${m.name} preview`} width={1280} height={800} className="h-auto w-full" unoptimized /></figure>)}</div>
            </Block>
          )}
          <Block id="downloads" title={l ? `Downloads for ${l.version}` : "Downloads"}>
            {l ? <><ReleaseFiles assets={l.assets} /><p className="mt-3 text-xs text-ink-faint">Pick the file for your exact Minecraft version. Every file&apos;s SHA-256 was recorded when it was published.</p></> : <p className="text-sm text-ink-mute">No release of this module is published yet.</p>}
          </Block>
          <Block id="install" title="Installation"><Markdown>{m.installMd || "Put the file in your instance's `mods` folder."}</Markdown></Block>
          <Block id="requirements" title="Requirements and dependencies">
            <Markdown>{m.requirementsMd}</Markdown>
            {l && l.deps.length > 0 && (
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line">{l.deps.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>{d.moduleSlug ? <Link href={`/modules/${d.moduleSlug}`} className="text-aurora-cyan hover:underline">{d.name}</Link> : d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-aurora-cyan hover:underline">{d.name}</a> : d.name}{d.versionRange && <span className="text-ink-faint"> · {d.versionRange}</span>}</span>
                  <Badge tone={d.required ? "blue" : "neutral"}>{d.required ? "Required" : "Optional"}</Badge>
                </li>))}</ul>
            )}
          </Block>
          <Block id="compat" title="Supported versions and loaders">
            {l && l.compat.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[480px] text-sm">
                  <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint"><th className="px-4 py-3 font-medium">Minecraft</th><th className="px-4 py-3 font-medium">Loader</th><th className="px-4 py-3 font-medium">State</th><th className="px-4 py-3 font-medium">Notes</th></tr></thead>
                  <tbody>{l.compat.map((c) => <tr key={c.mcVersion + c.loader} className="border-b border-line last:border-0"><td className="px-4 py-3">{c.mcVersion}</td><td className="px-4 py-3 capitalize">{c.loader}</td><td className="px-4 py-3"><CompatBadge status={c.status} /></td><td className="px-4 py-3 text-ink-mute">{c.notes}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="text-sm text-ink-mute">No compatibility information has been published.</p>}
            {l?.compatNotes && <p className="mt-3 text-sm text-ink-mute">{l.compatNotes}</p>}
          </Block>
          {m.knownIssuesMd && <Block id="issues" title="Known issues"><Markdown>{m.knownIssuesMd}</Markdown></Block>}
          <Block id="history" title="Version history and changelog">
            <ol className="relative space-y-6 border-l border-line pl-6">
              {m.releases.map((r) => (
                <li key={r.id} id={`v${r.version}`} className="relative">
                  <span aria-hidden className={"absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-night-950 " + (r.status === "withdrawn" ? "bg-bad" : r.isLatestInChannel ? "bg-aurora-cyan" : "bg-ink-faint")} />
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{r.version}</h3><ChannelBadge channel={r.channel} />{r.status === "withdrawn" && <Badge tone="bad">Withdrawn</Badge>}<span className="text-xs text-ink-faint">{formatDate(r.publishedAt)}</span></div>
                  {r.withdrawnReason && <p className="mt-1 text-sm text-[#ffc9c9]">Withdrawn: {r.withdrawnReason}</p>}
                  {r.summary && <p className="mt-1 text-sm text-ink-mute">{r.summary}</p>}
                  {[...r.changes.added, ...r.changes.improved, ...r.changes.fixed].length > 0 && <ul className="mt-2 space-y-1 text-sm text-ink-soft">{[...r.changes.added, ...r.changes.improved, ...r.changes.fixed].map((c) => <li key={c}>– {c}</li>)}</ul>}
                  {r.status === "published" && r.id !== l?.id && r.assets.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm text-aurora-cyan">Files ({r.assets.length})</summary><div className="mt-3"><ReleaseFiles assets={r.assets} compact /></div></details>}
                </li>
              ))}
              {published.length === 0 && <li className="text-sm text-ink-mute">No releases yet.</li>}
            </ol>
          </Block>
        </div>
      </div>
    </div>
  );
}
