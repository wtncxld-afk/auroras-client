import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Markdown } from "@/components/ui/Markdown";
import { formatDate } from "@/components/ui/format";
import { getDocs } from "@/lib/public-data";
import { cn } from "@/components/ui/cn";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const d = (await getDocs()).find((x) => x.slug === slug);
  return d ? { title: d.title, description: d.summary } : { title: "Page not found" };
}
export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params, docs = await getDocs(), d = docs.find((x) => x.slug === slug);
  if (!d) notFound();
  const sections = [...new Set(docs.map((x) => x.section))];
  return (
    <div className="container-page grid gap-10 py-12 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Documentation" className="lg:sticky lg:top-24 lg:self-start">
        <Link href="/docs" className="inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-ink"><ArrowLeft size={15} />All guides</Link>
        <div className="mt-6 hidden space-y-6 lg:block">{sections.map((s) => (
          <div key={s}><p className="text-2xs font-semibold uppercase tracking-[0.16em] text-ink-faint">{s}</p><ul className="mt-2 space-y-0.5">{docs.filter((x) => x.section === s).map((x) => <li key={x.slug}><Link href={`/docs/${x.slug}`} aria-current={x.slug === slug ? "page" : undefined} className={cn("block rounded-lg px-3 py-1.5 text-sm", x.slug === slug ? "bg-white/[0.05] text-ink" : "text-ink-mute hover:text-ink")}>{x.title}</Link></li>)}</ul></div>
        ))}</div>
      </nav>
      <article className="min-w-0 max-w-3xl">
        <p className="eyebrow">{d.section}</p>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight">{d.title}</h1>
        {d.summary && <p className="mt-3 text-[16px] leading-7 text-ink-mute">{d.summary}</p>}
        <div className="hairline my-8" />
        <Markdown>{d.bodyMd}</Markdown>
        <p className="mt-12 text-xs text-ink-faint">Last updated {formatDate(d.updatedAt)}</p>
      </article>
    </div>
  );
}
