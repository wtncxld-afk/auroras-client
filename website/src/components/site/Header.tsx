import Link from "next/link";
import { Logo } from "../ui/Logo";
import { ButtonLink } from "../ui/Button";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";

export const NAV = [
  { href: "/features", label: "Features" },
  { href: "/download", label: "Download" },
  { href: "/modules", label: "Modules" },
  { href: "/changelog", label: "Changelog" },
  { href: "/docs", label: "Docs" },
];
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-night-950/70 backdrop-blur-md supports-[backdrop-filter]:bg-night-950/55">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-night-800 focus:px-3 focus:py-2 focus:text-sm">Skip to content</a>
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Main" className="hidden md:block"><NavLinks items={NAV} /></nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/download" size="sm" className="hidden sm:inline-flex">Download</ButtonLink>
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
export function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const ext = /^https?:/.test(href);
  return ext ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-ink-mute transition hover:text-ink">{children}</a> : <Link href={href} className="text-ink-mute transition hover:text-ink">{children}</Link>;
}
