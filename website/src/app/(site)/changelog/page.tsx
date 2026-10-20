import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/Section";
import { Badge, ChannelBadge, CompatBadge } from "@/components/ui/Badge";
import { Markdown } from "@/components/ui/Markdown";
import { formatDate } from "@/components/ui/format";
import { getLauncherReleases, getModules } from "@/lib/public-data";

export const metadata: Metadata = { title: "Changelog", description: "Every Auroras Client release: what was added, improved and fixed, with compatibility notes." };

const SECTIONS = [["added", "Added", "ok"], ["improved", "Improved", "blue"], ["fixed", "Fixed", "violet"], ["breaking", "Breaking changes", "bad"]] as const;

export default async function ChangelogPage() {
  const [rels, mods] = await Promise.all([getLauncherReleases(), getModules()]);
  const mod = mods.find((m) => m.isClientMod);
  return (
    <>
      <PageHero eyebrow="Changelog" title="Release history">
        <p>Every launcher release, newest first, from the same release records that drive the downloads and the launcher&apos;s updates.</p>
      </PageHero>
      <div className="container-page py-14">
        {rels.length === 0 ? <p className="text-ink-mute">No releases have been published yet.</p> : (
          <ol className="space-y-6">
            {rels.map((r) => {
              const mr = mod?.releases.find((x) => x.version === r.version && x.status === "published");
              return (
                <li key={r.id} id={`v${r.version}`} className="surface scroll-mt-24 p-6 sm:p-8">
                  <div className="grid gap-6 md:grid-cols-[180px_1fr]">
                    <div>
                      <h2 className="text-xl font-semibold"><a href={`#v${r.version}`} className="hover:text-aurora-ice">{r.version}</a></h2>
                      <div className="mt-2 flex flex-wrap gap-2"><ChannelBadge channel={r.channel} />{r.status === "withdrawn" && <Badge tone="bad">Withdrawn</Badge>}{r.isLatestInChannel && r.status === "published" && <Badge tone="cyan">Latest</Badge>}</div>
                      <p className="mt-3 text-xs text-ink-faint"><time dateTime={r.publishedAt ?? undefined}>{formatDate(r.publishedAt)}</time></p>
                    </div>
                    <div className="min-w-0">
                      {r.status === "withdrawn" && <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 p-3 text-sm text-[#ffd0d0]">This release was withdrawn{r.withdrawnReason ? `: ${r.withdrawnReason}` : ""}. Its downloads are disabled.</p>}
                      {r.title && <p className="font-medium text-ink">{r.title}</p>}
                      {r.summary && <p className="mt-1 text-[15px] leading-7 text-ink-mute">{r.summary}</p>}
                      <div className="mt-5 grid gap-5 lg:grid-cols-2">
                        {SECTIONS.filter(([k]) => r.changes[k].length).map(([k, label, tone]) => (
                          <div key={k}><Badge tone={tone}>{label}</Badge><ul className="mt-3 space-y-1.5 text-sm leading-6 text-ink-soft">{r.changes[k].map((c) => <li key={c} className="flex gap-2"><span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />{c}</li>)}</ul></div>
                        ))}
                      </div>
                      {r.notesMd && <details className="mt-5"><summary className="cursor-pointer text-sm text-aurora-cyan">Release notes</summary><Markdown className="mt-2 !text-sm">{r.notesMd}</Markdown></details>}
                      {(r.compatNotes || mr) && (
                        <div className="mt-5 rounded-xl border border-line bg-night-900/50 p-4">
                          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Compatibility</p>
                          {r.compatNotes && <p className="mt-2 text-sm text-ink-mute">{r.compatNotes}</p>}
                          {mr && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-mute">Auroras mod {mr.version}:{mr.compat.map((c) => <span key={c.mcVersion} className="inline-flex items-center gap-1.5">{c.mcVersion} <CompatBadge status={c.status} /></span>)} <Link className="text-aurora-cyan hover:underline" href={`/modules/${mod!.slug}#v${mr.version}`}>jars</Link></div>}
                        </div>
                      )}
                      {r.status === "published" && r.assets.length > 0 && <Link href="/download#previous" className="mt-4 inline-block text-sm text-aurora-cyan hover:underline">Downloads for {r.version}</Link>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
