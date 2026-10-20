"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, FileText, LayoutDashboard, LogOut, Megaphone, Menu, Package, Puzzle, ScrollText, Shield, SlidersHorizontal, X } from "lucide-react";
import { Logo } from "../ui/Logo";
import { cn } from "../ui/cn";
import { api } from "./api";
import { ToastProvider } from "./ui";

const NAV = [
  { href: "/owner", label: "Overview", Icon: LayoutDashboard, exact: true },
  { href: "/owner/releases", label: "Releases", Icon: Package },
  { href: "/owner/modules", label: "Modules", Icon: Puzzle },
  { href: "/owner/content", label: "Site content", Icon: SlidersHorizontal },
  { href: "/owner/announcements", label: "Announcements", Icon: Megaphone },
  { href: "/owner/docs", label: "Documentation", Icon: FileText },
  { href: "/owner/audit", label: "Audit log", Icon: ScrollText },
  { href: "/owner/security", label: "Security", Icon: Shield },
];
export function OwnerShell({ username, children }: { username: string; children: React.ReactNode }) {
  const path = usePathname(); const [open, setOpen] = useState(false);
  const signOut = async () => { await api("/api/owner/auth/logout", { method: "POST" }); window.location.href = "/owner/login"; };
  const nav = (
    <nav aria-label="Owner" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, Icon, exact }) => {
        const active = exact ? path === href : path === href || path.startsWith(href + "/");
        return <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition", active ? "bg-white/[0.06] text-ink shadow-[inset_0_0_0_1px_rgba(148,170,210,0.14)]" : "text-ink-mute hover:bg-white/[0.03] hover:text-ink")}><Icon size={16} className={active ? "text-aurora-cyan" : ""} aria-hidden />{label}</Link>;
      })}
    </nav>
  );
  return (
    <ToastProvider>
      <div className="min-h-dvh bg-night-950 lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-white/[0.06] bg-night-900/70 px-3 py-5 lg:flex">
          <div className="px-2"><Logo href="/owner" size={24} /><p className="mt-1 pl-[34px] text-[11px] uppercase tracking-[0.18em] text-ink-faint">Owner</p></div>
          <div className="mt-7 flex-1">{nav}</div>
          <div className="space-y-1 border-t border-line pt-3">
            <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-ink-mute hover:text-ink"><Activity size={15} aria-hidden />View site</Link>
            <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-ink-mute hover:text-ink"><LogOut size={15} aria-hidden />Sign out <span className="ml-auto truncate text-[11px] text-ink-faint">{username}</span></button>
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-night-950/80 px-4 backdrop-blur lg:hidden">
            <Logo href="/owner" size={22} />
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line">{open ? <X size={17} /> : <Menu size={17} />}</button>
          </header>
          {open && <div className="border-b border-line bg-night-900 p-3 lg:hidden">{nav}<button type="button" onClick={signOut} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] text-ink-mute"><LogOut size={16} />Sign out</button></div>}
          <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
export function PageHeader({ title, description, actions, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-8">
      {back && <Link href={back.href} className="text-[13px] text-ink-mute hover:text-ink">← {back.label}</Link>}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0"><h1 className="text-[26px] font-semibold leading-tight">{title}</h1>{description && <p className="mt-1.5 max-w-2xl text-sm text-ink-mute">{description}</p>}</div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
