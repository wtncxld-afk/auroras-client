import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { createCiToken } from "@/lib/content";

export const dynamic = "force-dynamic";
export const GET = ownerRoute(async () => json({ tokens: (await getDb().select().from(schema.ciTokens).orderBy(desc(schema.ciTokens.createdAt))).map(({ tokenHash: _h, ...t }) => t) }));
const input = z.object({ name: z.string().trim().min(2).max(60), allowPublish: z.boolean().default(false) });
export const POST = ownerRoute(async (req, { session, ipHash }) => {
  const b = await readJson(req, input);
  const { token, row } = await createCiToken(b.name, b.allowPublish ? ["releases:draft", "releases:publish"] : ["releases:draft"], { name: "owner:" + session.username, ipHash });
  // The token is shown once and never stored in readable form.
  return json({ token, id: row.id, scopes: row.scopes }, 201);
});
