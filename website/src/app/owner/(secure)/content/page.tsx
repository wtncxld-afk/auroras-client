import { requireOwnerPage } from "@/lib/auth/guard";
import { allSettings } from "@/lib/owner/data";
import { parseSetting } from "@/lib/settings-schema";
import { FEATURES } from "@/lib/product";
import { PageHeader } from "@/components/owner/Shell";
import { FeatureCopySetting, SimpleSetting, VersionsSetting } from "@/components/owner/SettingsEditor";

export const metadata = { title: "Site content" };
const SECTIONS = [["home", "Homepage"], ["supportedVersions", "Supported versions"], ["downloads", "Download page"], ["community", "Community links"], ["featureCopy", "Feature copy"], ["maintenance", "Maintenance"], ["legal", "Privacy and terms"]] as const;
export default async function ContentPage() {
  await requireOwnerPage();
  const s = await allSettings();
  return (
    <>
      <PageHeader title="Site content" description="Text and links on the public site. Release facts (versions, files, dates, checksums) come from releases, not from here." />
      <nav aria-label="Sections" className="mb-6 flex flex-wrap gap-2">{SECTIONS.map(([k, l]) => <a key={k} href={`#${k}`} className="rounded-full border border-line px-3 py-1 text-xs text-ink-mute hover:text-ink">{l}</a>)}</nav>
      <div className="space-y-6">
        <section id="home" className="scroll-mt-20"><SimpleSetting settingKey="home" value={parseSetting("home", s.home)} /></section>
        <section id="supportedVersions" className="scroll-mt-20"><VersionsSetting value={parseSetting("supportedVersions", s.supportedVersions)} /></section>
        <section id="downloads" className="scroll-mt-20"><SimpleSetting settingKey="downloads" value={parseSetting("downloads", s.downloads)} /></section>
        <section id="community" className="scroll-mt-20"><SimpleSetting settingKey="community" value={parseSetting("community", s.community)} /></section>
        <section id="featureCopy" className="scroll-mt-20"><FeatureCopySetting value={parseSetting("featureCopy", s.featureCopy)} features={FEATURES.map((f) => ({ id: f.id, title: f.title, body: f.body }))} /></section>
        <section id="maintenance" className="scroll-mt-20"><SimpleSetting settingKey="maintenance" value={parseSetting("maintenance", s.maintenance)} /></section>
        <section id="legal" className="scroll-mt-20"><SimpleSetting settingKey="legal" value={parseSetting("legal", s.legal)} /></section>
      </div>
    </>
  );
}
