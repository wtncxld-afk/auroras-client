import Link from "next/link";
import { requireOwnerPage } from "@/lib/auth/guard";
import { auditPage } from "@/lib/owner/data";
import { PageHeader } from "@/components/owner/Shell";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/components/ui/format";

export const metadata = { title: "Audit log" };
const sevTone = { info: "neutral", notice: "blue", warning: "warn", critical: "bad" } as const;
const FILTERS = [["", "Everything"], ["release.", "Releases"], ["asset.", "Files"], ["module.", "Modules"], ["auth.", "Sign-ins"], ["security.", "Security"], ["owner.", "Owner account"], ["settings.", "Settings"], ["manifest.", "Manifest"], ["ci_token.", "CI tokens"]];
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; severity?: string; page?: string }> }) {
  await requireOwnerPage();
  const sp = await searchParams;
  const page = Math.max(0, Math.min(10000, parseInt(sp.page ?? "0", 10) || 0));
  const q = (sp.q ?? "").slice(0, 40).replace(/[^a-z_.]/g, "");
  const { rows, more } = await auditPage({ page, q: q || undefined, severity: sp.severity });
  const href = (o: Record<string, string | number | undefined>) => { const p = new URLSearchParams(Object.entries({ q, severity: sp.severity, page: undefined, ...o }).filter(([, v]) => v !== undefined && v !== "" && String(v) !== "0").map(([k, v]) => [k, String(v)])); return `/owner/audit${p.size ? "?" + p : ""}`; };
  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in, release action, upload and settings change, newest first. Records are append-only; IP addresses are stored only as keyed hashes." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([k, l]) => <Link key={k} href={href({ q: k })} className={"rounded-full border px-3 py-1 text-xs transition " + (q === k ? "border-aurora-cyan/40 bg-aurora-cyan/10 text-aurora-ice" : "border-line text-ink-mute hover:text-ink")}>{l}</Link>)}
        <span className="mx-1 w-px bg-line" aria-hidden />
        {["", "notice", "warning", "critical"].map((s) => <Link key={s} href={href({ severity: s })} className={"rounded-full border px-3 py-1 text-xs transition " + ((sp.severity ?? "") === s ? "border-aurora-cyan/40 bg-aurora-cyan/10 text-aurora-ice" : "border-line text-ink-mute hover:text-ink")}>{s ? s[0].toUpperCase() + s.slice(1) : "Any severity"}</Link>)}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-night-850/70 shadow-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.1em] text-ink-faint"><th className="px-5 py-3 font-medium">When (local)</th><th className="px-5 py-3 font-medium">Action</th><th className="px-5 py-3 font-medium">Actor</th><th className="px-5 py-3 font-medium">Details</th><th className="px-5 py-3 font-medium">Severity</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-ink-faint">No matching events.</td></tr>}
            {rows.map((e) => (
              <tr key={e.id} className="border-b border-line align-top last:border-0">
                <td className="whitespace-nowrap px-5 py-2.5 text-ink-mute">{formatDateTime(e.at)}</td>
                <td className="px-5 py-2.5 font-mono text-[12.5px]">{e.action}</td>
                <td className="px-5 py-2.5 text-ink-mute">{e.actor}</td>
                <td className="max-w-[360px] px-5 py-2.5"><code className="block truncate text-[11.5px] text-ink-faint" title={JSON.stringify(e.detail)}>{e.targetType ? `${e.targetType}${e.targetId ? ":" + e.targetId.slice(0, 8) : ""} ` : ""}{JSON.stringify(e.detail) === "{}" ? "" : JSON.stringify(e.detail)}</code></td>
                <td className="px-5 py-2.5"><Badge tone={sevTone[e.severity]}>{e.severity}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        {page > 0 ? <Link href={href({ page: page - 1 })} className="text-aurora-cyan hover:underline">← Newer</Link> : <span />}
        {more ? <Link href={href({ page: page + 1 })} className="text-aurora-cyan hover:underline">Older →</Link> : <span />}
      </div>
    </>
  );
}
