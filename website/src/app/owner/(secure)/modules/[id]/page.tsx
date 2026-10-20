import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireOwnerPage } from "@/lib/auth/guard";
import { moduleDetail } from "@/lib/owner/data";
import { isUuid } from "@/lib/owner/params";
import { PageHeader } from "@/components/owner/Shell";
import { ModuleForm } from "@/components/owner/ModuleForm";
import { MediaManager } from "@/components/owner/MediaManager";
import { Panel } from "@/components/owner/ui";
import { ChannelBadge, StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate } from "@/components/ui/format";

export const metadata = { title: "Module" };
export default async function ModuleDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireOwnerPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await moduleDetail(id);
  if (!d) notFound();
  const m = d.module;
  return (
    <>
      <PageHeader back={{ href: "/owner/modules", label: "Modules" }} title={<span className="flex flex-wrap items-center gap-3">{m.name}<StatusBadge status={m.status} /></span>}
        description={m.status === "published" ? <>Public page: <Link className="text-aurora-cyan hover:underline" href={`/modules/${m.slug}`}>/modules/{m.slug}</Link></> : "Not public."}
        actions={<ButtonLink href={`/owner/releases/new?module=${m.id}`} size="md"><Plus size={16} />New release</ButtonLink>} />
      <div className="space-y-6">
        <Panel title="Releases">
          {d.releases.length === 0 ? <p className="text-sm text-ink-faint">No releases yet.</p> : (
            <ul className="divide-y divide-line">{d.releases.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><Link href={`/owner/releases/${r.id}`} className="font-medium hover:text-aurora-ice">{r.version}</Link><span className="flex items-center gap-2"><ChannelBadge channel={r.channel} /><StatusBadge status={r.status} /><span className="w-24 text-right text-xs text-ink-faint">{formatDate(r.publishedAt)}</span></span></li>
            ))}</ul>
          )}
        </Panel>
        <MediaManager moduleId={m.id} media={d.media.map((x) => ({ id: x.id, kind: x.kind, alt: x.alt, size: x.size }))} />
        <ModuleForm id={m.id} deletable={d.releases.length === 0} initial={{ slug: m.slug, name: m.name, summary: m.summary, descriptionMd: m.descriptionMd, category: m.category, features: m.features, installMd: m.installMd, requirementsMd: m.requirementsMd, knownIssuesMd: m.knownIssuesMd, author: m.author, docsUrl: m.docsUrl, sourceUrl: m.sourceUrl, status: m.status, isClientMod: m.isClientMod, sort: m.sort }} />
      </div>
    </>
  );
}
