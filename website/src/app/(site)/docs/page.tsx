import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/site/Section";
import { getDocs, getSetting } from "@/lib/public-data";

export const metadata: Metadata = { title: "Documentation", description: "Install, update and use Auroras Client: sign-in, modules, compatibility, troubleshooting and FAQ." };

export default async function DocsIndex() {
  const [docs, community] = await Promise.all([getDocs(), getSetting("community")]);
  const sections = [...new Set(docs.map((d) => d.section))];
  return (
    <>
      <PageHero eyebrow="Documentation" title="Guides and help"><p>Everything from the first install to reporting a bug.</p></PageHero>
      <div className="container-page space-y-12 py-14">
        {docs.length === 0 && <p className="text-ink-mute">Documentation is being written.</p>}
        {sections.map((s) => (
          <section key={s} aria-labelledby={`s-${s}`}>
            <h2 id={`s-${s}`} className="text-2xs font-semibold uppercase tracking-[0.16em] text-ink-faint">{s}</h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {docs.filter((d) => d.section === s).map((d) => (
                <li key={d.slug}><Link href={`/docs/${d.slug}`} className="surface surface-hover group flex h-full flex-col p-5"><h3 className="font-semibold text-ink">{d.title}</h3><p className="mt-2 text-sm leading-6 text-ink-mute">{d.summary}</p><span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm text-aurora-cyan">Read<ArrowRight size={14} className="transition group-hover:translate-x-0.5" /></span></Link></li>
              ))}
            </ul>
          </section>
        ))}
        <section className="surface flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold">Need more help?</h2><p className="mt-1 text-sm text-ink-mute">Ask the community or open an issue.</p></div>
          <div className="flex flex-wrap gap-3 text-sm">{community.discordUrl && <a className="text-aurora-cyan hover:underline" href={community.discordUrl} target="_blank" rel="noopener noreferrer">Discord</a>}{community.issuesUrl && <a className="text-aurora-cyan hover:underline" href={community.issuesUrl} target="_blank" rel="noopener noreferrer">Issue tracker</a>}<Link className="text-aurora-cyan hover:underline" href="/community">Community</Link></div>
        </section>
      </div>
    </>
  );
}
