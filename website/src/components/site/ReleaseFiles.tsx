import { ShieldCheck } from "lucide-react";
import type { PubAsset } from "@/lib/public-data";
import { formatBytes, KIND_LABEL, PLATFORM_LABEL } from "../ui/format";
import { CopyButton } from "./CopyButton";
import { DownloadButton } from "./DownloadButton";

/** File table with size, platform and the full SHA-256 for every file of a release. */
export function ReleaseFiles({ assets, compact }: { assets: PubAsset[]; compact?: boolean }) {
  if (!assets.length) return <p className="text-sm text-ink-faint">No downloadable files for this release.</p>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-night-900/60">
      {assets.map((a) => (
        <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] text-ink">{a.filename}</p>
            <p className="mt-1 text-xs text-ink-mute">
              {PLATFORM_LABEL[a.platform] ?? a.platform}{a.platform !== "any" ? ` · ${a.arch}` : ""} · {KIND_LABEL[a.kind] ?? a.kind}{a.mcVersion ? ` · Minecraft ${a.mcVersion}` : ""}{a.loader ? ` · ${a.loader[0].toUpperCase() + a.loader.slice(1)}` : ""} · {formatBytes(a.size)}
            </p>
            {!compact && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-faint"><ShieldCheck size={13} aria-hidden />SHA-256{a.checksumSource === "imported" ? " (from the release's SHA256SUMS.txt)" : ""}</span>
                <code className="mono-hash">{a.sha256}</code>
                <CopyButton value={a.sha256} label="Copy" />
              </div>
            )}
          </div>
          <DownloadButton assetId={a.id} variant="subtle" size="sm">Download</DownloadButton>
        </li>
      ))}
    </ul>
  );
}
