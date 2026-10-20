import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { createRelease } from "@/lib/releases";
import { releaseCreate } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const GET = ownerRoute(async () => json({ releases: await getDb().select().from(schema.releases).orderBy(desc(schema.releases.createdAt)) }));
export const POST = ownerRoute(async (req, { session, ipHash }) => {
  const r = await createRelease(await readJson(req, releaseCreate), { name: "owner:" + session.username, ipHash });
  return json({ release: r }, 201);
});
