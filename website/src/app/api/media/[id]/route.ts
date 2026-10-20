import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { serveMedia } from "@/lib/media";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Module icons and previews. Only images of published modules are public; types were checked from the bytes on upload.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(404, "not_found", "Not found.");
  const [row] = await getDb().select({ m: schema.moduleMedia }).from(schema.moduleMedia).innerJoin(schema.modules, eq(schema.modules.id, schema.moduleMedia.moduleId))
    .where(and(eq(schema.moduleMedia.id, id), eq(schema.modules.status, "published"))).limit(1);
  if (!row) return fail(404, "not_found", "Not found.");
  return serveMedia(row.m);
}
