import { z } from "zod";
import { isVersion } from "./semver";

// Server-side schemas for every owner and CI input. Text is length-limited; Markdown is stored as text and rendered
// without raw HTML (components/Markdown.tsx), so nothing stored here can run as script on the public site.
const line = (max = 300) => z.string().trim().max(max);
const md = (max = 20000) => z.string().max(max);
export const httpsUrl = z.string().trim().max(500).url().refine((u) => u.startsWith("https://"), "Must be an https:// link");
const optUrl = z.union([httpsUrl, z.literal("").transform(() => null), z.null()]).optional();
export const version = z.string().trim().max(64).refine(isVersion, "Use a version like 1.2.3 or 1.2.3-beta.1");
export const channel = z.enum(["stable", "beta", "experimental"]);
export const mcVersion = z.string().trim().regex(/^\d+\.\d+(\.\d+)?$/, "Use a Minecraft release such as 1.21.11 or 26.1");
export const loader = z.enum(["fabric", "quilt", "neoforge", "forge", "vanilla"]);
const items = z.array(line(400).min(1)).max(60);
export const changes = z.object({ added: items.default([]), improved: items.default([]), fixed: items.default([]), breaking: items.default([]) });

export const releaseCreate = z.object({
  moduleId: z.string().uuid().nullable().default(null),
  version, channel: channel.default("stable"),
  title: line(120).default(""), summary: line(600).default(""), notesMd: md().default(""),
  changes: changes.default({ added: [], improved: [], fixed: [], breaking: [] }),
  compatNotes: md(4000).default(""),
  minUpdaterVersion: z.union([version, z.literal("").transform(() => null), z.null()]).default(null),
  retained: z.boolean().default(true),
});
export const releaseUpdate = releaseCreate.omit({ moduleId: true }).partial();
export const compatList = z.object({ items: z.array(z.object({ mcVersion, loader, status: z.enum(["tested", "partial", "experimental", "unsupported"]), notes: line(400).default("") })).max(80) });
export const depList = z.object({ items: z.array(z.object({ name: line(120).min(1), moduleId: z.string().uuid().nullable().default(null), versionRange: line(60).default(""), required: z.boolean().default(true), url: optUrl })).max(40) });
export const withdrawInput = z.object({ reason: line(400).min(4, "Say why, so the public changelog can show it") });
export const rollbackInput = z.object({ targetId: z.string().uuid(), withdrawCurrent: z.boolean().default(false), reason: line(400).default("") });
export const confirmInput = z.object({ confirm: z.literal(true) });

export const assetQuery = z.object({
  filename: z.string().trim().min(1).max(128),
  kind: z.enum(["installer", "portable", "package", "disk_image", "archive", "mod_jar", "module_package"]),
  platform: z.enum(["windows", "linux", "macos", "any"]),
  arch: z.enum(["x64", "arm64", "universal", "any"]).default("x64"),
  mc: mcVersion.optional(), loader: loader.optional(),
});

export const moduleInput = z.object({
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "Lowercase letters, digits and dashes"),
  name: line(80).min(2), summary: line(300).default(""), descriptionMd: md().default(""),
  category: z.enum(["hud", "visuals", "skies", "emotes", "cosmetics", "utilities", "experimental"]),
  features: z.array(line(200).min(1)).max(40).default([]),
  installMd: md(8000).default(""), requirementsMd: md(8000).default(""), knownIssuesMd: md(8000).default(""),
  author: line(80).default("Auroras Client"), docsUrl: optUrl, sourceUrl: optUrl,
  status: z.enum(["draft", "published", "hidden", "disabled"]).default("draft"),
  isClientMod: z.boolean().default(false), sort: z.number().int().min(-1000).max(1000).default(0),
});
export const moduleUpdate = moduleInput.partial();

export const announcementInput = z.object({
  title: line(140).min(2), bodyMd: md(4000).default(""), level: z.enum(["info", "success", "warning", "maintenance"]).default("info"),
  active: z.boolean().default(false), releaseId: z.string().uuid().nullable().default(null),
  startsAt: z.string().datetime().nullable().default(null), endsAt: z.string().datetime().nullable().default(null),
});
export const docInput = z.object({
  slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,62}$/), title: line(120).min(2), section: line(60).default("Guides"),
  summary: line(300).default(""), bodyMd: md(60000).default(""), sort: z.number().int().min(-1000).max(1000).default(0), published: z.boolean().default(false),
});
export const loginInput = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(256), code: z.string().trim().max(32).default("") });
export const ciReleaseInput = releaseCreate.extend({ moduleSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/).nullable().default(null) }).omit({ moduleId: true });
