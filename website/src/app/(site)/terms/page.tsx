import type { Metadata } from "next";
import { PageHero } from "@/components/site/Section";
import { Markdown } from "@/components/ui/Markdown";
import { getSetting } from "@/lib/public-data";

export const metadata: Metadata = { title: "Terms" };
export default async function Terms() {
  const l = await getSetting("legal");
  return (<><PageHero eyebrow="Legal" title="Terms of use" /><div className="container-page max-w-3xl py-12"><Markdown>{l.termsMd || "No terms have been published yet."}</Markdown></div></>);
}
