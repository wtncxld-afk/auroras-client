import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOwnerPage } from "@/lib/auth/guard";
import { docsList } from "@/lib/owner/data";
import { PageHeader } from "@/components/owner/Shell";
import { Empty } from "@/components/owner/ui";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate } from "@/components/ui/format";

export const metadata = { title: "Documentation" };
export default async function DocsAdmin() {
  await requireOwnerPage();
  const docs = await docsList();
  return (
    <>
      <PageHeader title="Documentation" description="Pages under /docs." actions={<ButtonLink href="/owner/docs/new"><Plus size={16} />New page</ButtonLink>} />
      {docs.length === 0 ? <Empty title="No pages yet" /> : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-night-850/70 shadow-card">{docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <div className="min-w-0"><Link href={`/owner/docs/${d.id}`} className="font-medium hover:text-aurora-ice">{d.title}</Link><p className="text-xs text-ink-faint">{d.section} · /docs/{d.slug}</p></div>
            <div className="flex items-center gap-3">{d.published ? <Badge tone="ok" dot>Published</Badge> : <Badge>Draft</Badge>}<span className="w-24 text-right text-xs text-ink-faint">{formatDate(d.updatedAt)}</span></div>
          </li>
        ))}</ul>
      )}
    </>
  );
}
