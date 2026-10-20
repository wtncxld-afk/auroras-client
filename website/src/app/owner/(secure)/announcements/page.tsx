import { requireOwnerPage } from "@/lib/auth/guard";
import { announcementsList, moduleOptions, publishedReleasesForSelect } from "@/lib/owner/data";
import { PageHeader } from "@/components/owner/Shell";
import { AnnouncementEditor } from "@/components/owner/AnnouncementEditor";

export const metadata = { title: "Announcements" };
export default async function AnnouncementsPage() {
  await requireOwnerPage();
  const [items, rels, mods] = await Promise.all([announcementsList(), publishedReleasesForSelect(), moduleOptions()]);
  const name = (id: string | null) => (id ? mods.find((m) => m.id === id)?.name ?? "Module" : "Launcher");
  return (
    <>
      <PageHeader title="Announcements" description="Banners on the public site for releases, maintenance and important notices." />
      <AnnouncementEditor releases={rels.map((r) => ({ id: r.id, label: `${name(r.moduleId)} ${r.version}` }))}
        items={items.map((a) => ({ id: a.id, title: a.title, bodyMd: a.bodyMd, level: a.level, active: a.active, releaseId: a.releaseId, startsAt: a.startsAt?.toISOString() ?? null, endsAt: a.endsAt?.toISOString() ?? null, updatedAt: a.updatedAt.toISOString() }))} />
    </>
  );
}
