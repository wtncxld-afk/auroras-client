import { requireOwnerPage } from "@/lib/auth/guard";
import { PageHeader } from "@/components/owner/Shell";
import { ModuleForm } from "@/components/owner/ModuleForm";

export const metadata = { title: "New module" };
export default async function NewModule() {
  await requireOwnerPage();
  return (<><PageHeader title="New module" back={{ href: "/owner/modules", label: "Modules" }} description="Create the listing. It stays private until you set it to Published and publish a release for it." /><ModuleForm /></>);
}
