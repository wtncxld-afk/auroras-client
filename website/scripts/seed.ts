// Fills an empty database with the site's starting content: settings, documentation, the Auroras client mod module
// and the real GitHub release history (src/data/github-releases.json). Never overwrites what the owner has changed.
// Usage: npm run db:seed     (add --no-releases to skip importing the GitHub releases)
import { eq } from "drizzle-orm";
import { getDb, schema, closeDb } from "@/db";
import { DOCS, PRIVACY_MD, TERMS_MD, CLIENT_MOD } from "@/data/seed-content";
import { importSnapshot, type Snapshot } from "@/lib/importer";
import { SETTINGS, type SettingKey } from "@/lib/settings-schema";
import { modVersions } from "@/lib/product";
import { latestManifest, regenerateManifest } from "@/lib/releases";
import snapshot from "@/data/github-releases.json";

async function main() {
  const db = getDb();
  const defaults: Partial<Record<SettingKey, unknown>> = {
    supportedVersions: {
      ...SETTINGS.supportedVersions.parse({}),
      rows: modVersions().map((v) => ({ mc: v.mc, loader: v.loader, status: "experimental", note: "Built in CI, not yet verified in game" })),
      platforms: [{ os: "Windows", status: "available", note: "64-bit installer" }, { os: "Linux", status: "planned", note: "" }, { os: "macOS", status: "planned", note: "" }],
    },
    legal: { privacyMd: PRIVACY_MD, termsMd: TERMS_MD },
  };
  for (const key of Object.keys(SETTINGS) as SettingKey[]) {
    const value = (SETTINGS[key] as { parse: (v: unknown) => unknown }).parse(defaults[key] ?? {});
    await db.insert(schema.siteSettings).values({ key, value }).onConflictDoNothing();
  }
  for (const d of DOCS) await db.insert(schema.docPages).values({ ...d, published: true }).onConflictDoNothing();
  const [m] = await db.select().from(schema.modules).where(eq(schema.modules.slug, CLIENT_MOD.slug));
  if (!m) await db.insert(schema.modules).values({ ...CLIENT_MOD, status: "published" });
  if (!process.argv.includes("--no-releases")) console.log("Imported", await importSnapshot(snapshot as Snapshot), "release record(s) from GitHub data.");
  // Make sure /updates/manifest.json exists (signed if a key is configured) even before the first release.
  if (!(await latestManifest())) await db.transaction((tx) => regenerateManifest(tx, "initial seed"));
  console.log("Seed complete.");
}
main().then(closeDb).catch(async (e) => { console.error("Seed failed:", e.message); await closeDb(); process.exit(1); });
