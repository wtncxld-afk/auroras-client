import { z } from "zod";
import { ownerRoute } from "@/lib/auth/guard";
import { ApiError, json, readJson } from "@/lib/http";
import { readSettingForOwner, saveSetting } from "@/lib/content";
import { SETTING_KEYS, type SettingKey } from "@/lib/settings-schema";

export const dynamic = "force-dynamic";
const key = (k: string): SettingKey => { if (!(SETTING_KEYS as string[]).includes(k)) throw new ApiError(404, "not_found", "Unknown setting."); return k as SettingKey; };
export const GET = ownerRoute<{ key: string }>(async (_req, { params }) => json({ value: await readSettingForOwner(key(params.key)) }));
export const PUT = ownerRoute<{ key: string }>(async (req, { params, session, ipHash }) => {
  const { value } = await readJson(req, z.object({ value: z.unknown() }));
  return json({ value: await saveSetting(key(params.key), value, { name: "owner:" + session.username, ipHash }) });
});
