import { requireOwnerPage } from "@/lib/auth/guard";
import { PageHeader } from "@/components/owner/Shell";
import { DocForm } from "@/components/owner/DocForm";

export const metadata = { title: "New page" };
export default async function NewDoc() {
  await requireOwnerPage();
  return (<><PageHeader title="New documentation page" back={{ href: "/owner/docs", label: "Documentation" }} /><DocForm /></>);
}
