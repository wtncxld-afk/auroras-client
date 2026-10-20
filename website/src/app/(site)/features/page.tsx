import type { Metadata } from "next";
import { PageHero, SectionHeading } from "@/components/site/Section";
import { Reveal } from "@/components/site/Reveal";
import { ProductFrame } from "@/components/site/ProductFrame";
import { FeatureIcon } from "@/components/site/icons";
import { AvailabilityBadge } from "@/components/site/AvailabilityBadge";
import { ButtonLink } from "@/components/ui/Button";
import { CompatBadge, Badge } from "@/components/ui/Badge";
import { FEATURES, registryCatalog, registryCounts } from "@/lib/product";
import { getSetting } from "@/lib/public-data";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Features", description: "Animated skies, a customisable HUD, Totem Studio, emotes, cosmetic previews, account and instance management — and exactly what state each one is in." };

export default async function FeaturesPage() {
  const [copy, sv] = await Promise.all([getSetting("featureCopy"), getSetting("supportedVersions")]);
  const features = FEATURES.map((f) => ({ ...f, ...(copy[f.id] ?? {}) }));
  const catalog = registryCatalog(), counts = registryCounts();
  return (
    <>
      <PageHero eyebrow="Features" title={<>Built for how you actually play</>} actions={<><ButtonLink href="/download">Download</ButtonLink><ButtonLink href="#catalog" variant="secondary">All modules</ButtonLink></>}>
        <p>Each feature says where it works today. <strong className="font-medium text-ink">Available</strong> is in the launcher now; <strong className="font-medium text-ink">experimental</strong> is written and builds but hasn't been verified in a real game yet; <strong className="font-medium text-ink">planned</strong> isn't built.</p>
      </PageHero>

      <nav aria-label="Features on this page" className="sticky top-16 z-30 border-b border-white/[0.05] bg-night-950/80 backdrop-blur-md">
        <ul className="container-page flex gap-1 overflow-x-auto py-2.5 text-[13px]">
          {features.map((f) => <li key={f.id}><a href={`#${f.id}`} className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-ink-mute transition hover:bg-white/[0.04] hover:text-ink">{f.title}</a></li>)}
        </ul>
      </nav>

      <div className="container-page space-y-24 py-20 sm:space-y-32">
        {features.map((f, i) => (
          <section key={f.id} id={f.id} aria-labelledby={`${f.id}-h`} className={cn("grid items-center gap-10", f.shot ? "lg:grid-cols-[0.9fr_1.1fr]" : "lg:grid-cols-[0.9fr_1.1fr]")}>
            <Reveal className={cn(f.shot && i % 2 === 1 ? "lg:order-2" : "")}>
              <div className="flex items-center gap-3"><FeatureIcon name={f.icon} /><p className="eyebrow">{f.kicker}</p></div>
              <h2 id={`${f.id}-h`} className="mt-5 text-[28px] font-semibold leading-tight sm:text-[32px]">{f.title}</h2>
              <p className="mt-4 text-[15.5px] leading-7 text-ink-mute">{f.body}</p>
              <ul className="mt-6 space-y-2.5">
                {f.bullets.map((b) => <li key={b} className="flex gap-3 text-[14.5px] leading-6 text-ink-soft"><span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-aurora-cyan" />{b}</li>)}
              </ul>
              <div className="mt-6 flex flex-wrap gap-2">{f.status.map((s) => <span key={s.where} title={s.note}><AvailabilityBadge level={s.level} where={s.where} /></span>)}</div>
              {f.status.some((s) => s.note) && <p className="mt-3 text-xs leading-5 text-ink-faint">{f.status.filter((s) => s.note).map((s) => s.note).join(". ")}.</p>}
            </Reveal>
            <Reveal delay={0.05} className={cn(f.shot && i % 2 === 1 ? "lg:order-1" : "")}>
              {f.shot ? <ProductFrame src={f.shot.src} alt={f.shot.alt} /> : f.id === "versions" ? (
                <div className="surface p-6">
                  <p className="text-sm text-ink-mute">{sv.summary}</p>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">{sv.rows.map((r) => <li key={r.mc} className="flex items-center justify-between rounded-xl border border-line bg-night-900/60 px-4 py-3"><span className="text-sm">Minecraft {r.mc} <span className="text-ink-faint">· {r.loader}</span></span><CompatBadge status={r.status} /></li>)}</ul>
                  <div className="mt-4 flex flex-wrap gap-2">{sv.platforms.map((p) => <Badge key={p.os} tone={p.status === "available" ? "ok" : "neutral"} dot>{p.os}: {p.status}</Badge>)}</div>
                </div>
              ) : (
                <div className="surface grid gap-3 p-6 sm:grid-cols-2">
                  {f.bullets.map((b, n) => <div key={b} className="rounded-xl border border-line bg-night-900/60 p-4"><p className="text-2xs font-semibold uppercase tracking-[0.14em] text-aurora-cyan/80">0{n + 1}</p><p className="mt-2 text-sm leading-6 text-ink-soft">{b}</p></div>)}
                </div>
              )}
            </Reveal>
          </section>
        ))}
      </div>

      <section id="catalog" className="container-page scroll-mt-32" aria-labelledby="catalog-h">
        <SectionHeading eyebrow="Module catalog" title={<span id="catalog-h">Every module in the client</span>}>
          Straight from the client's module registry: {counts.total} modules, {counts.withCode} with in-game code (experimental until verified in game) and {counts.planned} planned.
        </SectionHeading>
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map((g) => (
            <Reveal key={g.category} className="surface p-5">
              <h3 className="flex items-center justify-between text-[15px] font-semibold">{g.category}<span className="text-xs font-normal text-ink-faint">{g.modules.length}</span></h3>
              <ul className="mt-3 divide-y divide-line">
                {g.modules.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0"><p className="text-[13.5px] text-ink">{m.name}</p>{m.note && <p className="mt-0.5 text-xs leading-5 text-ink-faint">{m.note}</p>}</div>
                    <AvailabilityBadge level={m.state} />
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
