import { notFound } from "next/navigation";
import { requireOwnerPage } from "@/lib/auth/guard";
import { releaseDetail } from "@/lib/owner/data";
import { isUuid } from "@/lib/owner/params";
import { PageHeader } from "@/components/owner/Shell";
import { ReleaseForm, type ReleaseValues } from "@/components/owner/ReleaseForm";
import { ReleaseManager } from "@/components/owner/ReleaseManager";
import { ChannelBadge, StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/components/ui/format";

export const metadata = { title: "Release" };
export default async function ReleaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwnerPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await releaseDetail(id);
  if (!d) notFound();
  const r = d.release;
  const initial: ReleaseValues = { version: r.version, channel: r.channel as ReleaseValues["channel"], title: r.title, summary: r.summary, notesMd: r.notesMd, compatNotes: r.compatNotes, minUpdaterVersion: r.minUpdaterVersion, retained: r.retained, changes: { added: r.changes.added ?? [], improved: r.changes.improved ?? [], fixed: r.changes.fixed ?? [], breaking: r.changes.breaking ?? [] } };
  const product = d.module ? d.module.name : "Auroras Client launcher";
  return (
    <>
      <PageHeader back={{ href: "/owner/releases", label: "Releases" }}
        title={<span className="flex flex-wrap items-center gap-3">{product} {r.version}<StatusBadge status={r.status} /><ChannelBadge channel={r.channel} /></span>}
        description={<>{r.publishedAt ? <>Published {formatDateTime(r.publishedAt)}. </> : r.firstPublishedAt ? <>First published {formatDateTime(r.firstPublishedAt)}. </> : <>Never published; only you can see it. </>}{r.status === "withdrawn" && r.withdrawnReason ? <>Withdrawn: {r.withdrawnReason}. </> : null}Source: {r.source}.</>} />
      <div className="space-y-6">
        <ReleaseManager id={r.id} version={r.version} status={r.status} channel={r.channel} isModule={!!r.moduleId} isClientMod={!!d.module?.isClientMod}
          assets={d.assets.map((a) => ({ id: a.id, filename: a.filename, size: a.size, sha256: a.sha256, kind: a.kind, platform: a.platform, arch: a.arch, mcVersion: a.mcVersion, loader: a.loader, storage: a.storage, checksumSource: a.checksumSource, validation: a.validation, createdAt: a.createdAt.toISOString() }))}
          compat={d.compat.map((c) => ({ mcVersion: c.mcVersion, loader: c.loader, status: c.status, notes: c.notes }))}
          deps={d.deps.map((x) => ({ name: x.name, versionRange: x.versionRange, required: x.required, url: x.url, moduleId: x.moduleId }))}
          downloads={d.downloads}
          rollbackTargets={d.rollbackTargets.map((t) => ({ id: t.id, version: t.version, status: t.status }))}
          history={d.history.map((h) => ({ id: h.id, at: h.at.toISOString(), action: h.action, actor: h.actor, severity: h.severity, detail: (h.detail ?? {}) as Record<string, unknown> }))} />
        <ReleaseForm id={r.id} initial={initial} locked={r.status === "published" || r.status === "withdrawn"} />
      </div>
    </>
  );
}
