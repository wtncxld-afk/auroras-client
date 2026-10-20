"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, ShieldCheck, X } from "lucide-react";
import { ModuleIcon } from "./ModuleIcon";
import { Badge, ChannelBadge } from "../ui/Badge";
import { CATEGORY_LABEL, formatDate } from "../ui/format";

export type ModuleCard = { slug: string; name: string; summary: string; category: string; author: string; icon: string | null; isClientMod: boolean; version: string | null; channel: string | null; publishedAt: string | null; mc: string[]; loaders: string[]; updatedAt: string };
/** Newest Minecraft version first (26.3 before 26.1 before 1.21.11). */
const mcDesc = (a: string, b: string) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0); return 0; };
const SORTS = { featured: "Featured", name: "Name", updated: "Recently updated" } as const;

export function ModuleBrowser({ modules, initial }: { modules: ModuleCard[]; initial: { q?: string; category?: string; mc?: string; loader?: string } }) {
  const [q, setQ] = useState(initial.q ?? ""), [cat, setCat] = useState(initial.category ?? ""), [mc, setMc] = useState(initial.mc ?? ""), [loader, setLoader] = useState(initial.loader ?? "");
  const [sort, setSort] = useState<keyof typeof SORTS>("featured");
  const allMc = useMemo(() => [...new Set(modules.flatMap((m) => m.mc))].sort(mcDesc), [modules]);
  const allLoaders = useMemo(() => [...new Set(modules.flatMap((m) => m.loaders))].sort(), [modules]);
  const cats = useMemo(() => Object.keys(CATEGORY_LABEL), []);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = modules.filter((m) => (!t || (m.name + " " + m.summary + " " + m.author).toLowerCase().includes(t)) && (!cat || m.category === cat) && (!mc || m.mc.includes(mc)) && (!loader || m.loaders.includes(loader)));
    if (sort === "name") r.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "updated") r.sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt));
    return r;
  }, [modules, q, cat, mc, loader, sort]);
  const active = !!(q || cat || mc || loader);
  const sel = "h-10 rounded-xl border border-line bg-night-850 px-3 text-sm text-ink focus:border-aurora-cyan/50 focus:outline-none";
  return (
    <div>
      <div className="surface flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search modules</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search modules" type="search" className="h-10 w-full rounded-xl border border-line bg-night-900 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-aurora-cyan/50 focus:outline-none" />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <label><span className="sr-only">Category</span><select value={cat} onChange={(e) => setCat(e.target.value)} className={sel}><option value="">All categories</option>{cats.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select></label>
          <label><span className="sr-only">Minecraft version</span><select value={mc} onChange={(e) => setMc(e.target.value)} className={sel}><option value="">Any Minecraft</option>{allMc.map((v) => <option key={v} value={v}>Minecraft {v}</option>)}</select></label>
          <label><span className="sr-only">Loader</span><select value={loader} onChange={(e) => setLoader(e.target.value)} className={sel}><option value="">Any loader</option>{allLoaders.map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></label>
          <label><span className="sr-only">Sort</span><select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} className={sel}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-ink-mute" aria-live="polite">
        <span>{list.length} module{list.length === 1 ? "" : "s"}{active ? " match" : ""}</span>
        {active && <button type="button" onClick={() => { setQ(""); setCat(""); setMc(""); setLoader(""); }} className="inline-flex items-center gap-1 text-aurora-cyan hover:underline"><X size={14} />Clear filters</button>}
      </div>
      {list.length === 0 ? (
        <div className="surface mt-6 flex flex-col items-center px-6 py-16 text-center">
          <p className="font-medium">No modules match these filters</p>
          <p className="mt-2 max-w-sm text-sm text-ink-mute">{mc ? `Nothing is published for Minecraft ${mc}${loader ? " with " + loader : ""} yet. ` : ""}Try another version or clear the filters.</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {list.map((m) => (
            <li key={m.slug}>
              <Link href={`/modules/${m.slug}`} className="surface surface-hover group flex h-full flex-col p-5">
                <div className="flex items-start gap-4">
                  <ModuleIcon icon={m.icon} name={m.name} isClientMod={m.isClientMod} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{m.name}</h3><Badge tone="neutral">{CATEGORY_LABEL[m.category] ?? m.category}</Badge></div>
                    <p className="mt-0.5 text-xs text-ink-faint">by {m.author}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-mute">{m.summary}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-xs text-ink-mute">
                  {m.version ? <><span className="font-medium text-ink-soft">v{m.version}</span>{m.channel && <ChannelBadge channel={m.channel} />}<span aria-hidden>·</span><span>{formatDate(m.publishedAt)}</span></> : <span>No published release yet</span>}
                  {m.mc.length > 0 && <><span aria-hidden>·</span><span>Minecraft {m.mc.join(", ")}</span></>}
                  {m.loaders.length > 0 && <><span aria-hidden>·</span><span className="capitalize">{m.loaders.join(", ")}</span></>}
                  {m.version && <span className="ml-auto inline-flex items-center gap-1 text-ok/90"><ShieldCheck size={13} aria-hidden />SHA-256 listed</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
