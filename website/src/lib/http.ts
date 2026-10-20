import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { env } from "./env";
import { keyedHash } from "./crypto";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) { super(message); }
}
const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
export const fail = (status: number, code: string, message: string, extra?: Record<string, unknown>) => json({ error: { code, message, ...extra } }, status);

/** Turns any thrown error into a JSON response without leaking stack traces or internals. */
export function toResponse(e: unknown) {
  if (e instanceof ApiError) return fail(e.status, e.code, e.message, e.extra);
  if (e instanceof ZodError) return fail(400, "invalid_input", "Some fields are invalid.", { fields: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
  const raw = e as { code?: string; constraint_name?: string; cause?: unknown };
  // Drizzle wraps driver errors (DrizzleQueryError); the PostgreSQL error code is on .cause.
  const pg = (raw && !raw.code && raw.cause ? raw.cause : raw) as { code?: string; constraint_name?: string };
  if (pg && pg.code === "23505") return fail(409, "conflict", "That already exists (" + (pg.constraint_name ?? "unique value") + ").");
  if (pg && pg.code === "23514") return fail(400, "invalid_input", "A value breaks a database rule (" + (pg.constraint_name ?? "check") + ").");
  if (pg && pg.code === "23503") return fail(409, "in_use", "It is still referenced by something else.");
  console.error("[auroras] unhandled error:", e instanceof Error ? e.message : e);
  return fail(500, "server_error", "Something went wrong on the server. Nothing was changed if this was a save.");
}

const MAX_JSON = 256 * 1024;
export async function readJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().startsWith("application/json")) throw new ApiError(415, "unsupported_media_type", "Send JSON.");
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_JSON) throw new ApiError(413, "too_large", "Request body is too large.");
  const text = await req.text();
  if (text.length > MAX_JSON) throw new ApiError(413, "too_large", "Request body is too large.");
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new ApiError(400, "invalid_json", "The request body isn't valid JSON."); }
  return schema.parse(data);
}

/** The client's IP, only from proxy headers when TRUST_PROXY_HEADERS is on (otherwise they could be forged). */
export function clientIp(req: Request): string {
  if (!env().TRUST_PROXY_HEADERS) return "unknown";
  const xff = req.headers.get("x-forwarded-for");
  return (req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || (xff ? xff.split(",")[0] : "") || "unknown").trim().slice(0, 64);
}
export const ipHash = (req: Request) => keyedHash("ip", clientIp(req));

/** True when Origin (or, failing that, Referer) is this site. Browsers always send Origin on POST/PUT/PATCH/DELETE. */
export function sameOrigin(req: Request): boolean {
  const site = env().siteOrigin, o = req.headers.get("origin");
  if (o) return o === site;
  const r = req.headers.get("referer");
  if (r) { try { return new URL(r).origin === site; } catch { return false; } }
  return false;
}
