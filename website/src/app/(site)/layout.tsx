import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Banners } from "@/components/site/Banners";
import { getAnnouncements, getLatestLauncher, getSetting } from "@/lib/public-data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [community, maintenance, announcements, latest] = await Promise.all([getSetting("community"), getSetting("maintenance"), getAnnouncements(), getLatestLauncher()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <Banners maintenance={maintenance} announcements={announcements} />
      <main id="main" className="flex-1">{children}</main>
      <Footer community={community} latestVersion={latest.stable?.version ?? null} />
    </div>
  );
}
