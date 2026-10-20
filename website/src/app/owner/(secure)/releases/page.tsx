import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOwnerPage } from "@/lib/auth/guard";
import { releasesList } from "@/lib/owner/data";
import { PageHeader } from "@/components/owner/Shell";
import { Empty } from "@/components/owner/ui";
import { ChannelBadge, StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate } from "@/components/ui/format";

export const metadata = { title: "Releases" };
export default async function ReleasesPage({ searchParams }: { searchParams: Promise<{ status?: string; product?: string }> }) {
  await requireOwnerPage();
  const sp = await searchParams;
  const all = await releasesList();
  const rows = all.filter(({ r, module }) => (!sp.status || r.status === sp.status) && (!sp.product || (sp.product === "launcher" ? !r.moduleId : module === sp.product)));
  const products = [...new Set(all.map((x) => x.module).filter((x): x is string => !!x))];
  const chip = (label: string, q: Record<string, string | undefined>) => {
    const params = new URLSearchParams(Object.entries({ ...sp, ...q }).filter(([, v]) => v) as [string, string][]);
    const active = Object.entries(q).every(([k, v]) => (sp as Record<string, string | undefined>)[k] === v);
    return <Link key={label} href={`/owner/releases${params.size ? "?" + params : ""}`} className={"rounded-full border px-3 py-1 text-xs transition " + (active ? "border-aurora-cyan/40 bg-aurora-cyan/10 text-aurora-ice" : "border-line text-ink-mute hover:text-ink")}>{label}</Link>;
  };
  return (
    <>
      <PageHeader title="Releases" description="Launcher and module releases. Drafts are private until you publish them." actions={<ButtonLink href="/owner/releases/new"><Plus size={16} />New release</ButtonLink>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {chip("All statuses", { status: undefined })}{(["draft", "published", "unpublished", "withdrawn"] as const).map((s) => chip(s[0].toUpperCase() + s.slice(1), { status: s }))}
        <span className="mx-1 w-px bg-line" aria-hidden />
        {chip("All products", { product: undefined })}{chip("Launcher", { product: "launcher" })}{products.map((p) => chip(p, { product: p }))}
      </div>
      {rows.length === 0 ? <Empty title="No releases here" action={<ButtonLink href="/owner/releases/new" size="sm">Create a release</ButtonLink>}>Create a draft, upload its files, then publish when it&apos;s ready.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-night-850/70 shadow-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.1em] text-ink-faint"><th className="px-5 py-3 font-medium">Version</th><th className="px-5 py-3 font-medium">Product</th><th className="px-5 py-3 font-medium">Channel</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Files</th><th className="px-5 py-3 font-medium">Published</th><th className="px-5 py-3 font-medium">Source</th></tr></thead>
            <tbody>
              {rows.map(({ r, module, files }) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-white/[0.02]">
                  <td className="px-5 py-3"><Link href={`/owner/releases/${r.id}`} className="font-medium text-ink hover:text-aurora-ice">{r.version}</Link></td>
                  <td className="px-5 py-3 text-ink-mute">{module ?? "Launcher"}</td>
                  <td className="px-5 py-3"><ChannelBadge channel={r.channel} /></td>
                  <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-3 text-ink-mute">{files}</td>
                  <td className="px-5 py-3 text-ink-mute">{formatDate(r.publishedAt)}</td>
                  <td className="px-5 py-3 text-xs text-ink-faint">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
