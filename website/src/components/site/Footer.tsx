import { LogoMark } from "../ui/Logo";
import { FooterLink } from "./Header";
import type { SettingValue } from "@/lib/settings-schema";

export function Footer({ community, latestVersion }: { community: SettingValue<"community">; latestVersion: string | null }) {
  const cols: { title: string; links: { href: string; label: string }[] }[] = [
    { title: "Product", links: [{ href: "/features", label: "Features" }, { href: "/modules", label: "Modules" }, { href: "/changelog", label: "Changelog" }, { href: "/download#verify", label: "Verify a download" }] },
    { title: "Downloads", links: [{ href: "/download", label: "Windows launcher" }, { href: "/download#previous", label: "Previous releases" }, { href: "/modules/auroras-client-mod", label: "Client mod builds" }, { href: "/updates/manifest.json", label: "Update manifest" }] },
    { title: "Documentation", links: [{ href: "/docs", label: "All guides" }, { href: "/docs/installation", label: "Installation" }, { href: "/docs/troubleshooting", label: "Troubleshooting" }, { href: "/docs/reporting-bugs", label: "Report a bug" }] },
    { title: "Community", links: [
      ...(community.discordUrl ? [{ href: community.discordUrl, label: "Discord" }] : []),
      ...(community.githubUrl ? [{ href: community.githubUrl, label: "GitHub" }] : []),
      ...(community.issuesUrl ? [{ href: community.issuesUrl, label: "Issue tracker" }] : []),
      { href: "/community", label: community.featuredServerName ? `${community.featuredServerName} server` : "Community" },
    ] },
  ];
  return (
    <footer className="relative mt-24 border-t border-white/[0.06] bg-night-950">
      <div className="hairline absolute inset-x-0 top-0" />
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5"><LogoMark size={26} /><span className="text-[15px] font-semibold">Auroras Client</span></div>
          <p className="mt-4 text-sm leading-6 text-ink-mute">A launcher and Fabric client mod for Minecraft Java Edition. Not an official Minecraft product; not approved by or associated with Mojang or Microsoft.</p>
          {latestVersion && <p className="mt-4 text-xs text-ink-faint">Latest stable launcher: v{latestVersion}</p>}
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{c.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">{c.links.map((l) => <li key={l.href + l.label}><FooterLink href={l.href}>{l.label}</FooterLink></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.05]">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getUTCFullYear()} Auroras Client. Minecraft is a trademark of Mojang Synergies AB.</p>
          <ul className="flex gap-5"><li><FooterLink href="/privacy">Privacy</FooterLink></li><li><FooterLink href="/terms">Terms</FooterLink></li><li><FooterLink href="/docs/faq">FAQ</FooterLink></li></ul>
        </div>
      </div>
    </footer>
  );
}
