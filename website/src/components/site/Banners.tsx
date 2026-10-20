import { Info, Megaphone, Wrench, CheckCircle2 } from "lucide-react";
import { Markdown } from "../ui/Markdown";
import type { PubAnnouncement } from "@/lib/public-data";
import type { SettingValue } from "@/lib/settings-schema";

const STYLE: Record<string, { cls: string; Icon: typeof Info }> = {
  info: { cls: "border-aurora-blue/25 bg-aurora-blue/[0.07] text-[#cfdcff]", Icon: Megaphone },
  success: { cls: "border-ok/25 bg-ok/[0.07] text-[#c9f2dd]", Icon: CheckCircle2 },
  warning: { cls: "border-warn/30 bg-warn/[0.08] text-[#fbe6bb]", Icon: Info },
  maintenance: { cls: "border-warn/30 bg-warn/[0.08] text-[#fbe6bb]", Icon: Wrench },
};
export function Banners({ maintenance, announcements }: { maintenance: SettingValue<"maintenance">; announcements: PubAnnouncement[] }) {
  const items = [...(maintenance.enabled && maintenance.message ? [{ id: "maintenance", title: "Maintenance", bodyMd: maintenance.message, level: "maintenance" }] : []), ...announcements];
  if (!items.length) return null;
  return (
    <div className="border-b border-white/[0.05]">
      {items.map((a) => { const s = STYLE[a.level] ?? STYLE.info; return (
        <div key={a.id} role={a.level === "maintenance" || a.level === "warning" ? "alert" : "status"} className={"border-b last:border-b-0 " + s.cls}>
          <div className="container-page flex items-start gap-3 py-2.5 text-[13.5px]">
            <s.Icon size={16} className="mt-0.5 shrink-0 opacity-80" aria-hidden />
            <div className="min-w-0"><strong className="font-semibold">{a.title}</strong>{a.bodyMd && <Markdown className="!text-[13.5px] !leading-6 [&_p]:!my-0 [&_p]:inline">{" — " + a.bodyMd}</Markdown>}</div>
          </div>
        </div>
      ); })}
    </div>
  );
}
