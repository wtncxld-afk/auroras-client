import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { createModule } from "@/lib/content";
import { moduleInput } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const GET = ownerRoute(async () => json({ modules: await getDb().select().from(schema.modules).orderBy(asc(schema.modules.sort)) }));
export const POST = ownerRoute(async (req, { session, ipHash }) => json({ module: await createModule(await readJson(req, moduleInput), { name: "owner:" + session.username, ipHash }) }, 201));
