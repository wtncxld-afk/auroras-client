import type { Metadata } from "next";
import { Github, Mail, MessageCircle, Server } from "lucide-react";
import { PageHero } from "@/components/site/Section";
import { CopyButton } from "@/components/site/CopyButton";
import { getSetting } from "@/lib/public-data";

export const metadata: Metadata = { title: "Community", description: "Where to find other Auroras players, get help and report bugs." };
export default async function Community() {
  const c = await getSetting("community");
  const card = "surface flex items-start gap-4 p-6";
  return (
    <>
      <PageHero eyebrow="Community" title="Play, talk, report"><p>Official places to find other players and get help.</p></PageHero>
      <div className="container-page grid gap-4 py-12 md:grid-cols-2">
        {c.featuredServer && (
          <div className={card}><Server className="mt-0.5 text-aurora-cyan" size={20} aria-hidden /><div className="min-w-0 flex-1"><h2 className="font-semibold">{c.featuredServerName || "Featured server"}</h2><p className="mt-1 text-sm text-ink-mute">Featured in the launcher with live status and one-click Join, and pinned first in every instance&apos;s server list.</p><div className="mt-4 flex items-center gap-3"><code className="rounded-lg border border-line bg-night-900 px-3 py-1.5 font-mono text-sm">{c.featuredServer}</code><CopyButton value={c.featuredServer} label="Copy address" /></div></div></div>
        )}
        {c.discordUrl ? (
          <div className={card}><MessageCircle className="mt-0.5 text-aurora-cyan" size={20} aria-hidden /><div><h2 className="font-semibold">Discord</h2><p className="mt-1 text-sm text-ink-mute">Chat with other players and get help.</p><a href={c.discordUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-aurora-cyan hover:underline">Join the Discord</a></div></div>
        ) : null}
        {c.githubUrl && (
          <div className={card}><Github className="mt-0.5 text-aurora-cyan" size={20} aria-hidden /><div><h2 className="font-semibold">GitHub</h2><p className="mt-1 text-sm text-ink-mute">Source code, releases and the issue tracker for bugs and ideas.</p><div className="mt-4 flex gap-4 text-sm"><a href={c.githubUrl} target="_blank" rel="noopener noreferrer" className="text-aurora-cyan hover:underline">Repository</a>{c.issuesUrl && <a href={c.issuesUrl} target="_blank" rel="noopener noreferrer" className="text-aurora-cyan hover:underline">Issues</a>}</div></div></div>
        )}
        {c.supportEmail && (
          <div className={card}><Mail className="mt-0.5 text-aurora-cyan" size={20} aria-hidden /><div><h2 className="font-semibold">Email</h2><a href={`mailto:${c.supportEmail}`} className="mt-2 inline-block text-sm text-aurora-cyan hover:underline">{c.supportEmail}</a></div></div>
        )}
      </div>
    </>
  );
}
