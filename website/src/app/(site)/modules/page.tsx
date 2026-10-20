import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site/Section";
import { ModuleBrowser, type ModuleCard } from "@/components/site/ModuleBrowser";
import { getModules } from "@/lib/public-data";

export const metadata: Metadata = { title: "Modules", description: "Download Auroras Client modules and extensions, with supported Minecraft versions, loaders, checksums and changelogs." };

export default async function ModulesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams, str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 80) : undefined);
  const modules = await getModules();
  const cards: ModuleCard[] = modules.map((m) => {
    const l = m.latest;
    const mc = l ? [...new Set([...l.compat.filter((c) => c.status !== "unsupported").map((c) => c.mcVersion), ...l.assets.map((a) => a.mcVersion).filter((x): x is string => !!x)])] : [];
    const loaders = l ? [...new Set([...l.compat.map((c) => c.loader), ...l.assets.map((a) => a.loader).filter((x): x is string => !!x)])] : [];
    return { slug: m.slug, name: m.name, summary: m.summary, category: m.category, author: m.author, icon: m.icon, isClientMod: m.isClientMod, version: l?.version ?? null, channel: l?.channel ?? null, publishedAt: l?.publishedAt ?? null, mc, loaders, updatedAt: m.updatedAt };
  });
  return (
    <>
      <PageHero eyebrow="Modules" title="Module downloads">
        <p>Packages built for Auroras Client, each with the Minecraft versions and loaders it supports, its dependencies, checksums and full version history. Only modules published for Auroras are listed. The client&apos;s built-in modules are on the <Link href="/features#catalog" className="text-aurora-cyan hover:underline">features page</Link>.</p>
      </PageHero>
      <div className="container-page py-12"><ModuleBrowser modules={cards} initial={{ q: str("q"), category: str("category"), mc: str("mc"), loader: str("loader") }} /></div>
    </>
  );
}
