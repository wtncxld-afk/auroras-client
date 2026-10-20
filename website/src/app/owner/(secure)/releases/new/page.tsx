import { requireOwnerPage } from "@/lib/auth/guard";
import { moduleOptions } from "@/lib/owner/data";
import { PageHeader } from "@/components/owner/Shell";
import { ReleaseForm } from "@/components/owner/ReleaseForm";

export const metadata = { title: "New release" };
export default async function NewRelease({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  await requireOwnerPage();
  const [mods, sp] = await Promise.all([moduleOptions(), searchParams]);
  return (
    <>
      <PageHeader title="New release" description="Step 1 of 3: describe the release. Next you upload its files, then review and publish. Nothing is public until you publish." back={{ href: "/owner/releases", label: "Releases" }} />
      <ReleaseForm modules={mods} initialModuleId={sp.module && mods.some((m) => m.id === sp.module) ? sp.module : null} />
    </>
  );
}
