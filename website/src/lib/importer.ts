import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { audit } from "./audit";
import { regenerateManifest } from "./releases";
import { isVersion } from "./semver";

/*
 * Imports the project's real GitHub releases (src/data/github-releases.json) as published release records whose files
 * stay on GitHub ("external" assets on an allow-listed host). Checksums come from each release's SHA256SUMS.txt and are
 * labelled as imported. Idempotent: versions that already exist are skipped.
 */
export type Snapshot = { repo: string; releases: { version: string; publishedAt: string; body: string; htmlUrl: string; assets: { name: string; size: number; sha256: string; url: string }[]; commits: string[] }[] };

const SKIP = /^(CI|README|Mod README|WIP|Merge|GUI previewer: replace)/i;
export function classify(commits: string[]) {
  const c = { added: [] as string[], improved: [] as string[], fixed: [] as string[], breaking: [] as string[] };
  for (const s of commits) {
    if (!s || SKIP.test(s)) continue;
    const t = s.replace(/\s+/g, " ").trim();
    if (/^fix(es|ed)?\b/i.test(t) || /:\s*fix\b/i.test(t)) c.fixed.push(t);
    else if (/\b(add|adds|added|new|import)\b/i.test(t) && !/\bfix\b/i.test(t)) c.added.push(t);
    else c.improved.push(t);
  }
  return c;
}
export async function importSnapshot(snap: Snapshot, actor = "system:import") {
  const db = getDb(); let created = 0;
  const [mod] = await db.select().from(schema.modules).where(eq(schema.modules.isClientMod, true)).limit(1);
  await db.transaction(async (tx) => {
    for (const r of snap.releases) {
      if (!isVersion(r.version)) continue;
      const at = new Date(r.publishedAt), changes = classify(r.commits);
      const installer = r.assets.find((a) => /^AurorasClientSetup-.*\.exe$/i.test(a.name));
      const jars = r.assets.filter((a) => /^auroras-client-fabric-([\d.]+)\.jar$/.test(a.name));
      const notesMd = r.body.trim() + `\n\nOriginal release: [GitHub](${r.htmlUrl}).`;
      const common = { channel: "stable" as const, status: "published" as const, publishedAt: at, firstPublishedAt: at, source: "github-import", changes, notesMd, createdAt: at, updatedAt: at };
      const exists = await tx.select({ id: schema.releases.id }).from(schema.releases).where(and(isNull(schema.releases.moduleId), eq(schema.releases.version, r.version)));
      if (!exists.length && installer) {
        const [rel] = await tx.insert(schema.releases).values({ ...common, version: r.version, title: `Auroras Client ${r.version}`, summary: jars.length ? `Windows launcher, with the Auroras mod built for Minecraft ${jars.map((j) => j.name.match(/fabric-([\d.]+)\.jar/)![1]).join(", ")}.` : "Windows launcher. The Auroras mod didn't build in this release." }).returning();
        await tx.insert(schema.assets).values({ releaseId: rel.id, kind: "installer", platform: "windows", arch: "x64", filename: installer.name, size: installer.size, sha256: installer.sha256, contentType: "application/vnd.microsoft.portable-executable", storage: "external", externalUrl: installer.url, checksumSource: "imported", signatureInfo: "Not Authenticode code-signed", validation: { checks: [{ name: "Imported from GitHub release", ok: true, detail: r.htmlUrl }, { name: "SHA-256 from SHA256SUMS.txt", ok: true }] } });
        await audit({ actor, action: "release.import", targetType: "release", targetId: rel.id, detail: { version: r.version, source: r.htmlUrl } }, tx);
        created++;
      }
      if (mod && jars.length) {
        const mexists = await tx.select({ id: schema.releases.id }).from(schema.releases).where(and(eq(schema.releases.moduleId, mod.id), eq(schema.releases.version, r.version)));
        if (mexists.length) continue;
        const mcs = jars.map((j) => j.name.match(/fabric-([\d.]+)\.jar/)![1]);
        const [mr] = await tx.insert(schema.releases).values({ ...common, moduleId: mod.id, version: r.version, title: `Auroras client mod ${r.version}`, summary: `Fabric builds for Minecraft ${mcs.join(", ")}, released with launcher ${r.version}.`, compatNotes: "Built by CI for each version. Not yet verified in a real game." }).returning();
        await tx.insert(schema.assets).values(jars.map((j, i) => ({ releaseId: mr.id, kind: "mod_jar" as const, platform: "any" as const, arch: "any", filename: j.name, size: j.size, sha256: j.sha256, contentType: "application/java-archive", storage: "external" as const, externalUrl: j.url, checksumSource: "imported" as const, mcVersion: mcs[i], loader: "fabric", validation: { checks: [{ name: "Imported from GitHub release", ok: true, detail: r.htmlUrl }, { name: "SHA-256 from SHA256SUMS.txt", ok: true }] } })));
        await tx.insert(schema.compatibility).values(mcs.map((mc) => ({ releaseId: mr.id, mcVersion: mc, loader: "fabric", status: "experimental" as const, notes: "Builds in CI; not yet verified in game" })));
        await tx.insert(schema.dependencies).values([
          { releaseId: mr.id, name: "Fabric Loader", versionRange: "", required: true, url: "https://fabricmc.net/use/installer/" },
          { releaseId: mr.id, name: "Fabric API", versionRange: "same Minecraft version", required: true, url: "https://modrinth.com/mod/fabric-api" },
        ]);
        await audit({ actor, action: "release.import", targetType: "release", targetId: mr.id, detail: { version: r.version, module: mod.slug } }, tx);
        created++;
      }
    }
    await regenerateManifest(tx, "imported GitHub releases");
  });
  return created;
}
