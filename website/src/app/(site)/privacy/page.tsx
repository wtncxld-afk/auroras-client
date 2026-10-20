import type { Metadata } from "next";
import { PageHero } from "@/components/site/Section";
import { Markdown } from "@/components/ui/Markdown";
import { getSetting } from "@/lib/public-data";

export const metadata: Metadata = { title: "Privacy" };
export default async function Privacy() {
  const l = await getSetting("legal");
  return (<><PageHero eyebrow="Legal" title="Privacy" /><div className="container-page max-w-3xl py-12"><Markdown>{l.privacyMd || "No privacy statement has been published yet."}</Markdown></div></>);
}
