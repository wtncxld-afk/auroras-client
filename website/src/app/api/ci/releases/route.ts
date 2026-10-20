import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ciRoute } from "@/lib/auth/guard";
import { ApiError, json, readJson } from "@/lib/http";
import { createRelease } from "@/lib/releases";
import { ciReleaseInput } from "@/lib/validation";

export const dynamic = "force-dynamic";
// CI creates DRAFT releases only. Drafts are private until the owner (or a token with releases:publish) publishes them.
export const POST = ciRoute("releases:draft", async (req, { token, ipHash }) => {
  const { moduleSlug, ...rest } = await readJson(req, ciReleaseInput);
  let moduleId: string | null = null;
  if (moduleSlug) { const [m] = await getDb().select().from(schema.modules).where(eq(schema.modules.slug, moduleSlug)); if (!m) throw new ApiError(400, "invalid_input", "Unknown module " + moduleSlug); moduleId = m.id; }
  const r = await createRelease({ ...rest, moduleId }, { name: "ci:" + token.name, ipHash }, "ci");
  return json({ release: { id: r.id, version: r.version, status: r.status } }, 201);
});
