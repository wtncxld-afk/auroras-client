import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { upsertAnnouncement } from "@/lib/content";
import { announcementInput } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const POST = ownerRoute(async (req, { session, ipHash }) => json({ announcement: await upsertAnnouncement(null, await readJson(req, announcementInput), { name: "owner:" + session.username, ipHash }) }, 201));
