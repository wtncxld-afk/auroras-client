import { Badge } from "../ui/Badge";
import type { Availability } from "@/lib/product";
const MAP: Record<Availability, { tone: "ok" | "warn" | "neutral"; label: string }> = { available: { tone: "ok", label: "Available" }, experimental: { tone: "warn", label: "Experimental" }, planned: { tone: "neutral", label: "Planned" } };
export function AvailabilityBadge({ level, where }: { level: Availability; where?: string }) {
  const m = MAP[level];
  return <Badge tone={m.tone} dot>{where ? `${where}: ${m.label.toLowerCase()}` : m.label}</Badge>;
}
