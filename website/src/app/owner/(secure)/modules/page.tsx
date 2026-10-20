import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOwnerPage } from "@/lib/auth/guard";
import { modulesList } from "@/lib/owner/data";
import { PageHeader } from "@/components/owner/Shell";
import { Empty } from "@/components/owner/ui";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { CATEGORY_LABEL, formatDate } from "@/components/ui/format";

export const metadata = { title: "Modules" };
export default async function ModulesPage() {
  await requireOwnerPage();
  const rows = await modulesList();
  return (
    <>
      <PageHeader title="Modules" description="Marketplace listings. A module appears publicly when it is published and has at least one published release with files." actions={<ButtonLink href="/owner/modules/new"><Plus size={16} />New module</ButtonLink>} />
      {rows.length === 0 ? <Empty title="No modules yet" action={<ButtonLink href="/owner/modules/new" size="sm">Create a module</ButtonLink>}>Add a listing, then create its first release.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-night-850/70 shadow-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.1em] text-ink-faint"><th className="px-5 py-3 font-medium">Module</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 font-medium">Visibility</th><th className="px-5 py-3 font-medium">Releases</th><th className="px-5 py-3 font-medium">Updated</th></tr></thead>
            <tbody>{rows.map(({ m, releases, published }) => (
              <tr key={m.id} className="border-b border-line last:border-0 hover:bg-white/[0.02]">
                <td className="px-5 py-3"><Link href={`/owner/modules/${m.id}`} className="font-medium hover:text-aurora-ice">{m.name}</Link>{m.isClientMod && <Badge tone="blue" className="ml-2">Client mod</Badge>}<p className="font-mono text-xs text-ink-faint">{m.slug}</p></td>
                <td className="px-5 py-3 text-ink-mute">{CATEGORY_LABEL[m.category] ?? m.category}</td>
                <td className="px-5 py-3"><StatusBadge status={m.status} /></td>
                <td className="px-5 py-3 text-ink-mute">{published} published / {releases}</td>
                <td className="px-5 py-3 text-ink-mute">{formatDate(m.updatedAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
