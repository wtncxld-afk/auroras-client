import { z } from "zod";
import { httpsUrl } from "./validation";

// Owner-editable site content. Every key has a schema and a default; stored values are validated on write and
// re-validated on read (a bad stored value falls back to the default instead of breaking the page).
const t = (max: number) => z.string().trim().max(max);
const link = z.union([httpsUrl, z.literal("")]).default("");

export const SETTINGS = {
  home: z.object({
    eyebrow: t(60).default("Minecraft Java Edition client"),
    headline: t(90).default("Minecraft, refined."),
    subheadline: t(300).default("Auroras Client is a Windows launcher and Fabric client mod: animated skies, a HUD you lay out yourself, emotes, Totem Studio and clean instance management, in one calm interface."),
    previewCaption: t(200).default("The Auroras launcher on Windows, captured from its own interface."),
  }),
  community: z.object({
    discordUrl: link, githubUrl: link.default("https://github.com/wtncxld-afk/auroras-client"),
    issuesUrl: link.default("https://github.com/wtncxld-afk/auroras-client/issues"),
    featuredServer: t(80).default("vexvanilla.net"), featuredServerName: t(60).default("VexVanilla"),
    supportEmail: z.union([z.string().trim().email().max(120), z.literal("")]).default(""),
  }),
  maintenance: z.object({ enabled: z.boolean().default(false), message: t(300).default("") }),
  downloads: z.object({
    intro: t(400).default("Every file is listed with its size, publication date and SHA-256 checksum. Only builds that exist are shown."),
    signingNote: t(400).default("The Windows installer is not Authenticode code-signed yet, so Windows SmartScreen may ask you to confirm. Check its SHA-256 on this page before running it. Launcher updates are verified with an Ed25519-signed manifest."),
  }),
  supportedVersions: z.object({
    summary: t(300).default("The launcher runs every Minecraft Java release from 1.21 onward. The Auroras client mod is built for these Fabric versions:"),
    rows: z.array(z.object({ mc: t(20), loader: t(20), status: z.enum(["tested", "partial", "experimental", "unsupported"]), note: t(200).default("") })).max(40).default([]),
    platforms: z.array(z.object({ os: t(30), status: z.enum(["available", "planned"]), note: t(160).default("") })).max(6).default([]),
  }),
  featureCopy: z.record(z.string().regex(/^[a-z-]{2,40}$/), z.object({ title: t(80), body: t(500) })).default({}),
  legal: z.object({ privacyMd: z.string().max(20000).default(""), termsMd: z.string().max(20000).default("") }),
} as const;
export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]>;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];
export function parseSetting<K extends SettingKey>(key: K, raw: unknown): SettingValue<K> {
  const s = SETTINGS[key] as z.ZodTypeAny;
  const r = s.safeParse(raw ?? {});
  return (r.success ? r.data : s.parse({})) as SettingValue<K>;
}
