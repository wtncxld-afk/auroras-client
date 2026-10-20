import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Liveness for the host's health checks. Says only up/down; details are in the owner dashboard.
export async function GET() {
  try { await getDb().execute(sql`select 1`); return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
