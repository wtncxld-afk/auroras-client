import Link from "next/link";
import { ArrowRight, Github, Server, ShieldCheck, MessageCircle } from "lucide-react";
import { AuroraBackdrop } from "@/components/site/AuroraBackdrop";
import { HeroPreview } from "@/components/site/HeroPreview";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/Section";
import { ShotTabs } from "@/components/site/ShotTabs";
import { FeatureIcon } from "@/components/site/icons";
import { DownloadButton } from "@/components/site/DownloadButton";
import { AvailabilityBadge } from "@/components/site/AvailabilityBadge";
import { Badge, ChannelBadge, CompatBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatBytes, formatDate, shortHash } from "@/components/ui/format";
import { getLatestLauncher, getSetting } from "@/lib/public-data";
import { FEATURES } from "@/lib/product";

export default async function Home() {
  const [home, latest, sv, community, featureCopy] = await Promise.all([getSetting("home"), getLatestLauncher(), getSetting("supportedVersions"), getSetting("community"), getSetting("featureCopy")]);
  const rel = latest.stable;
  const installer = rel?.assets.find((a) => a.platform === "windows" && a.kind === "installer") ?? null;
  const feat = FEATURES.slice(0, 6).map((f) => ({ ...f, ...(featureCopy[f.id] ? { title: featureCopy[f.id].title, body: featureCopy[f.id].body } : {}) }));
  const changes = rel ? [...rel.changes.added, ...rel.changes.improved, ...rel.changes.fixed].slice(0, 5) : [];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <AuroraBackdrop />
        <div className="container-page relative pb-10 pt-16 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-[12.5px] text-ink-soft backdrop-blur">
                {rel ? (<><Badge tone="cyan">v{rel.version}</Badge><span>{home.eyebrow}</span></>) : <span className="px-2">{home.eyebrow}</span>}
              </div>
            </Reveal>
            <Reveal delay={0.05}><h1 className="mt-6 text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-[64px] lg:text-[72px]"><span className="text-gradient">{home.headline}</span></h1></Reveal>
            <Reveal delay={0.1}><p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-ink-soft">{home.subheadline}</p></Reveal>
            <Reveal delay={0.15}>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:items-start">
                {installer && rel ? (
                  <DownloadButton center assetId={installer.id} meta={`v${rel.version} · Windows ${installer.arch} · ${formatBytes(installer.size)}`}>Download Auroras Client</DownloadButton>
                ) : (
                  <div className="flex flex-col items-center gap-2"><ButtonLink href="/download" size="lg">Download Auroras Client</ButtonLink><span className="text-xs text-ink-faint">No stable release is published yet</span></div>
                )}
                <ButtonLink href="/features" variant="secondary" size="lg">Explore features <ArrowRight size={16} /></ButtonLink>
              </div>
            </Reveal>
          </div>
          <div className="mx-auto mt-16 max-w-5xl"><HeroPreview caption={home.previewCaption} /></div>
        </div>
      </section>

      {/* Feature showcase */}
      <section className="container-page mt-20 sm:mt-28" aria-labelledby="features-h">
        <SectionHeading eyebrow="What's inside" title={<span id="features-h">Everything you need, nothing you don't</span>}>
          A launcher that stays out of the way, and a client mod built around visuals you control.
        </SectionHeading>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {feat.map((f, i) => (
            <Reveal key={f.id} delay={(i % 3) * 0.05}>
              <Link href={`/features#${f.id}`} className="surface surface-hover group flex h-full flex-col p-6">
                <FeatureIcon name={f.icon} />
                <h3 className="mt-5 text-[16px] font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-mute">{f.body}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-5">{f.status.slice(0, 2).map((s) => <AvailabilityBadge key={s.where} level={s.level} where={s.where} />)}</div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Product captures */}
      <section className="container-page mt-24 sm:mt-32" aria-labelledby="inside-h">
        <SectionHeading eyebrow="The launcher" title={<span id="inside-h">Designed like the rest of your setup</span>}>
          Real captures of the Auroras launcher interface. No mock-ups.
        </SectionHeading>
        <div className="mx-auto mt-10 max-w-5xl">
          <ShotTabs shots={[
            { id: "modules", label: "Modules", src: "/product/launcher-modules.webp", alt: "The Modules page listing client modules with categories, settings and toggles.", text: "Turn client features on and off per instance, with one visual quality preset for everything." },
            { id: "hud", label: "HUD editor", src: "/product/launcher-hud.webp", alt: "The HUD editor with several HUD elements placed on a preview screen.", text: "Drag, snap and style every HUD element, previewed at real screen sizes and GUI scales." },
            { id: "skies", label: "Skies", src: "/product/launcher-cosmetics.webp", alt: "Visual Studio previewing the Aurora sky theme.", text: "Preview animated sky themes with the same maths the game uses." },
            { id: "totem", label: "Totem Studio", src: "/product/launcher-totem.webp", alt: "Totem Studio with pixel editor and 3D preview.", text: "Paint a custom totem and export it as a resource pack." },
            { id: "emotes", label: "Emotes", src: "/product/launcher-emotes.webp", alt: "The Emotes page with a 3D preview and the emote wheel.", text: "Play, create and arrange emotes for the in-game wheel. Only you see them." },
          ]} />
        </div>
      </section>

      {/* Versions + latest release */}
      <section className="container-page mt-24 grid gap-5 sm:mt-32 lg:grid-cols-[1fr_1.15fr]" aria-label="Compatibility and latest release">
        <Reveal className="surface p-6 sm:p-8">
          <p className="eyebrow">Compatibility</p>
          <h2 className="mt-3 text-2xl font-semibold">Supported versions</h2>
          <p className="mt-3 text-sm leading-6 text-ink-mute">{sv.summary}</p>
          <ul className="mt-6 divide-y divide-line rounded-xl border border-line">
            {sv.rows.map((r) => (
              <li key={r.mc + r.loader} className="flex items-center justify-between gap-3 px-4 py-3">
                <div><p className="text-sm font-medium text-ink">Minecraft {r.mc}</p><p className="text-xs text-ink-faint"><span className="capitalize">{r.loader}</span>{r.note ? ` · ${r.note}` : ""}</p></div>
                <CompatBadge status={r.status} />
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">{sv.platforms.map((p) => <Badge key={p.os} tone={p.status === "available" ? "ok" : "neutral"} dot>{p.os}: {p.status}</Badge>)}</div>
          <Link href="/docs/compatibility" className="mt-6 inline-flex items-center gap-1.5 text-sm text-aurora-cyan hover:underline">Compatibility details <ArrowRight size={14} /></Link>
        </Reveal>
        <Reveal delay={0.05} className="surface relative overflow-hidden p-6 sm:p-8">
          <div aria-hidden className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-aurora-blue/20 blur-3xl" />
          <p className="eyebrow">Latest release</p>
          {rel ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold">Auroras Client {rel.version}</h2><ChannelBadge channel={rel.channel} /></div>
              <p className="mt-2 text-sm text-ink-mute">Published {formatDate(rel.publishedAt)}{rel.summary ? ` · ${rel.summary}` : ""}</p>
              {changes.length > 0 && <ul className="mt-5 space-y-2 text-sm text-ink-soft">{changes.map((c) => <li key={c} className="flex gap-2.5"><span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-aurora-cyan" />{c}</li>)}</ul>}
              {installer && (
                <div className="mt-6 rounded-xl border border-line bg-night-900/70 p-4">
                  <p className="font-mono text-[13px] text-ink">{installer.filename}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-mute"><span>{formatBytes(installer.size)}</span><span aria-hidden>·</span><span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> SHA-256 {shortHash(installer.sha256)}</span></p>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3"><ButtonLink href="/download" size="md">All downloads</ButtonLink><ButtonLink href={`/changelog#v${rel.version}`} variant="secondary" size="md">Release notes</ButtonLink></div>
            </>
          ) : (
            <p className="mt-4 text-sm text-ink-mute">No stable release has been published yet. Check the <Link className="text-aurora-cyan" href="/changelog">changelog</Link> for previews.</p>
          )}
        </Reveal>
      </section>

      {/* Community */}
      <section className="container-page mt-24 sm:mt-32">
        <Reveal className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-night-900">
          <AuroraBackdrop horizon={false} intensity={0.7} />
          <div className="relative grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="eyebrow">Community</p>
              <h2 className="mt-3 text-[28px] font-semibold leading-tight sm:text-[34px]">Play together, report what breaks</h2>
              <p className="mt-4 max-w-lg text-[15px] leading-7 text-ink-mute">{community.featuredServerName} is featured in the launcher with live status and one-click Join. Bugs and ideas go to the issue tracker.</p>
            </div>
            <ul className="grid gap-3">
              <li className="surface flex items-center gap-4 p-4"><Server size={18} className="text-aurora-cyan" aria-hidden /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{community.featuredServerName}</p><p className="font-mono text-xs text-ink-mute">{community.featuredServer}</p></div><Link href="/community" className="text-sm text-aurora-cyan hover:underline">Details</Link></li>
              {community.githubUrl && <li className="surface flex items-center gap-4 p-4"><Github size={18} className="text-aurora-cyan" aria-hidden /><p className="flex-1 text-sm font-medium">Source and issue tracker</p><a href={community.issuesUrl || community.githubUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-aurora-cyan hover:underline">GitHub</a></li>}
              {community.discordUrl && <li className="surface flex items-center gap-4 p-4"><MessageCircle size={18} className="text-aurora-cyan" aria-hidden /><p className="flex-1 text-sm font-medium">Discord</p><a href={community.discordUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-aurora-cyan hover:underline">Join</a></li>}
            </ul>
          </div>
        </Reveal>
      </section>
    </>
  );
}
