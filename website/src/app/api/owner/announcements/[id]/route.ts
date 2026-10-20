import { ownerRoute } from "@/lib/auth/guard";
import { json, readJson } from "@/lib/http";
import { deleteAnnouncement, upsertAnnouncement } from "@/lib/content";
import { announcementInput } from "@/lib/validation";
import { uuidParam } from "@/lib/owner/params";

export const dynamic = "force-dynamic";
type P = { id: string };
export const PUT = ownerRoute<P>(async (req, { params, session, ipHash }) => json({ announcement: await upsertAnnouncement(uuidParam(params.id), await readJson(req, announcementInput), { name: "owner:" + session.username, ipHash }) }));
export const DELETE = ownerRoute<P>(async (_req, { params, session, ipHash }) => { await deleteAnnouncement(uuidParam(params.id), { name: "owner:" + session.username, ipHash }); return json({ ok: true }); });
