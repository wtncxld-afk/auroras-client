import { notFound } from "next/navigation";
import { requireOwnerPage } from "@/lib/auth/guard";
import { docById } from "@/lib/owner/data";
import { isUuid } from "@/lib/owner/params";
import { PageHeader } from "@/components/owner/Shell";
import { DocForm } from "@/components/owner/DocForm";

export const metadata = { title: "Edit page" };
export default async function EditDoc({ params }: { params: Promise<{ id: string }> }) {
  await requireOwnerPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await docById(id);
  if (!d) notFound();
  return (<><PageHeader title={d.title} back={{ href: "/owner/docs", label: "Documentation" }} description={d.published ? <>Live at <a className="text-aurora-cyan hover:underline" href={`/docs/${d.slug}`}>/docs/{d.slug}</a></> : "Draft: not public."} /><DocForm id={d.id} initial={{ slug: d.slug, title: d.title, section: d.section, summary: d.summary, bodyMd: d.bodyMd, sort: d.sort, published: d.published }} /></>);
}
