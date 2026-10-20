import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronDown, FileCheck2, KeyRound, Monitor } from "lucide-react";
import { AuroraBackdrop } from "@/components/site/AuroraBackdrop";
import { DownloadButton } from "@/components/site/DownloadButton";
import { ReleaseFiles } from "@/components/site/ReleaseFiles";
import { Reveal } from "@/components/site/Reveal";
import { Markdown } from "@/components/ui/Markdown";
import { ChannelBadge } from "@/components/ui/Badge";
import { formatBytes, formatDate, PLATFORM_LABEL } from "@/components/ui/format";
import { getLatestLauncher, getLauncherReleases, getModules, getSetting, type PubRelease } from "@/lib/public-data";

export const metadata: Metadata = { title: "Download", description: "Download the Auroras Client launcher for Windows, with file sizes, release dates and SHA-256 checksums for every build." };

function Changes({ r }: { r: PubRelease }) {
  const groups = [["Added", r.changes.added], ["Improved", r.changes.improved], ["Fixed", r.changes.fixed], ["Breaking changes", r.changes.breaking]] as const;
  const any = groups.some(([, xs]) => xs.length);
  if (!any) return r.notesMd ? <Markdown className="!text-sm">{r.notesMd}</Markdown> : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.filter(([, xs]) => xs.length).map(([label, xs]) => (
        <div key={label}><p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-faint">{label}</p><ul className="mt-2 space-y-1.5 text-sm text-ink-soft">{xs.map((x) => <li key={x} className="flex gap-2"><span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-aurora-cyan/80" />{x}</li>)}</ul></div>
      ))}
    </div>
  );
}

export default async function DownloadPage() {
  const [latest, all, dl, mods] = await Promise.all([getLatestLauncher(), getLauncherReleases(), getSetting("downloads"), getModules()]);
  const rel = latest.stable;
  const installer = rel?.assets.find((a) => a.platform === "windows" && a.kind === "installer") ?? null;
  const platforms = rel ? [...new Set(rel.assets.map((a) => a.platform))] : [];
  const previews = [latest.beta, latest.experimental].filter((r): r is PubRelease => !!r && (!rel || r.version !== rel.version));
  const previous = all.filter((r) => r.status === "published" && r.id !== rel?.id && !previews.some((p) => p.id === r.id) && r.assets.length);
  const clientMod = mods.find((m) => m.isClientMod) ?? null;

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-white/[0.05]">
        <AuroraBackdrop intensity={0.8} />
        <div className="container-page relative grid gap-10 pb-16 pt-16 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <Reveal>
            <p className="eyebrow">Download</p>
            <h1 className="mt-3 text-[36px] font-semibold leading-[1.08] sm:text-[48px]">Get Auroras Client</h1>
            <p className="mt-4 max-w-xl text-[16px] leading-7 text-ink-mute">{dl.intro}</p>
            {rel && installer ? (
              <div className="mt-8">
                <DownloadButton assetId={installer.id} meta={`${installer.filename} · ${formatBytes(installer.size)}`}>Download for Windows</DownloadButton>
                <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-mute">Version {rel.version} <ChannelBadge channel={rel.channel} /> <span aria-hidden>·</span> Published {formatDate(rel.publishedAt)}</p>
              </div>
            ) : <p className="mt-8 rounded-xl border border-line bg-night-900/70 p-4 text-sm text-ink-mute">No stable launcher release is published right now. Please check back soon.</p>}
          </Reveal>
          {rel && (
            <Reveal delay={0.05} className="surface p-6">
              <div className="flex items-center gap-3"><Monitor size={18} className="text-aurora-cyan" aria-hidden /><h2 className="text-[15px] font-semibold">Available for</h2></div>
              <ul className="mt-4 space-y-2">
                {platforms.map((p) => { const files = rel.assets.filter((a) => a.platform === p); return (
                  <li key={p} className="flex items-center justify-between rounded-xl border border-line bg-night-900/60 px-4 py-3 text-sm"><span>{PLATFORM_LABEL[p] ?? p}</span><span className="text-ink-faint">{files.map((f) => `${f.arch} ${f.kind === "installer" ? "installer" : f.kind}`).join(", ")}</span></li>
                ); })}
              </ul>
              {!platforms.includes("linux") && !platforms.includes("macos") && <p className="mt-4 text-xs leading-5 text-ink-faint">Linux and macOS builds don&apos;t exist yet, so none are offered.</p>}
              <div className="mt-5 border-t border-line pt-4 text-xs leading-5 text-ink-faint">Requires Windows 10 or 11 (64-bit) and a Minecraft: Java Edition account to play.</div>
            </Reveal>
          )}
        </div>
      </section>

      <div className="container-page space-y-16 py-16">
        {rel && (
          <section aria-labelledby="latest-h">
            <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="latest-h" className="text-xl font-semibold">Files in {rel.version}</h2><Link href={`/changelog#v${rel.version}`} className="inline-flex items-center gap-1 text-sm text-aurora-cyan hover:underline">Full release notes <ArrowRight size={14} /></Link></div>
            <div className="mt-5"><ReleaseFiles assets={rel.assets} /></div>
            <div className="mt-6 surface p-6"><Changes r={rel} /></div>
          </section>
        )}

        {previews.length > 0 && (
          <section aria-labelledby="preview-h">
            <h2 id="preview-h" className="text-xl font-semibold">Beta and experimental builds</h2>
            <p className="mt-2 text-sm text-ink-mute">Earlier builds for testing. They may be unstable; your stable installation isn&apos;t changed unless you install one.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {previews.map((r) => (
                <div key={r.id} className="surface p-5"><div className="flex items-center gap-2"><h3 className="font-semibold">Version {r.version}</h3><ChannelBadge channel={r.channel} /></div><p className="mt-1 text-xs text-ink-faint">Published {formatDate(r.publishedAt)}</p><div className="mt-4"><ReleaseFiles assets={r.assets} compact /></div></div>
              ))}
            </div>
          </section>
        )}

        {clientMod?.latest && (
          <section aria-labelledby="mod-h" className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 id="mod-h" className="font-semibold">Auroras client mod {clientMod.latest.version}</h2><p className="mt-1 text-sm text-ink-mute">The launcher installs it for you. Separate jars for {clientMod.latest.assets.map((a) => a.mcVersion).filter(Boolean).join(", ")} (Fabric) are on the module page.</p></div>
            <Link href={`/modules/${clientMod.slug}`} className="inline-flex items-center gap-1 text-sm text-aurora-cyan hover:underline">Mod downloads <ArrowRight size={14} /></Link>
          </section>
        )}

        <section id="verify" aria-labelledby="verify-h" className="grid scroll-mt-24 gap-4 md:grid-cols-2">
          <div className="surface p-6">
            <div className="flex items-center gap-3"><FileCheck2 size={18} className="text-aurora-cyan" aria-hidden /><h2 id="verify-h" className="font-semibold">Verify your download</h2></div>
            <p className="mt-3 text-sm leading-6 text-ink-mute">In PowerShell, in your Downloads folder, compare the result with the SHA-256 listed for the file:</p>
            <pre className="mt-3 whitespace-pre-wrap break-all rounded-xl border border-line bg-night-900 p-3 font-mono text-[12.5px] text-ink-soft">Get-FileHash .\{installer?.filename ?? "AurorasClientSetup-<version>.exe"} -Algorithm SHA256</pre>
          </div>
          <div className="surface p-6">
            <div className="flex items-center gap-3"><KeyRound size={18} className="text-aurora-cyan" aria-hidden /><h2 className="font-semibold">Signatures</h2></div>
            <p className="mt-3 text-sm leading-6 text-ink-mute">{dl.signingNote}</p>
            <p className="mt-3 text-sm"><a className="text-aurora-cyan hover:underline" href="/updates/manifest.json">Update manifest</a> <span className="text-ink-faint">·</span> <a className="text-aurora-cyan hover:underline" href="/updates/manifest.json.sig">signature</a> <span className="text-ink-faint">·</span> <a className="text-aurora-cyan hover:underline" href="/updates/public-key.pem">public key</a></p>
          </div>
        </section>

        <section id="previous" aria-labelledby="prev-h" className="scroll-mt-24">
          <h2 id="prev-h" className="text-xl font-semibold">Previous releases</h2>
          {previous.length === 0 ? <p className="mt-3 text-sm text-ink-mute">No earlier releases are available for download.</p> : (
            <ul className="mt-5 space-y-3">
              {previous.map((r) => (
                <li key={r.id}>
                  <details className="group surface overflow-hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                      <span className="flex flex-wrap items-center gap-3"><span className="font-medium">Version {r.version}</span><ChannelBadge channel={r.channel} /><span className="text-xs text-ink-faint">{formatDate(r.publishedAt)}</span></span>
                      <span className="flex items-center gap-3 text-xs text-ink-faint">{r.assets.length} file{r.assets.length === 1 ? "" : "s"}<ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden /></span>
                    </summary>
                    <div className="space-y-5 border-t border-line px-5 py-5"><Changes r={r} /><ReleaseFiles assets={r.assets} /></div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-xs text-ink-faint">Withdrawn releases aren&apos;t downloadable; the <Link href="/changelog" className="text-aurora-cyan hover:underline">changelog</Link> says why.</p>
        </section>
      </div>
    </>
  );
}
