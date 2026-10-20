import "server-only";
import { getDb, schema, type Tx } from "@/db";

export type AuditInput = {
  actor: string; action: string; targetType?: string; targetId?: string; ipHash?: string;
  severity?: "info" | "notice" | "warning" | "critical"; detail?: Record<string, unknown>;
};
// Never logged, whatever a caller passes in detail.
const SECRET_KEYS = /pass(word)?|token|secret|code|cookie|authorization|totp|key/i;
function scrub(d: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) out[k] = SECRET_KEYS.test(k) ? "[redacted]" : typeof v === "string" ? v.slice(0, 500) : v;
  return out;
}
export async function audit(e: AuditInput, tx?: Tx) {
  const db = tx ?? getDb();
  await db.insert(schema.auditEvents).values({ actor: e.actor, action: e.action, targetType: e.targetType, targetId: e.targetId, ipHash: e.ipHash, severity: e.severity ?? "info", detail: scrub(e.detail) });
}
