"use client";
// Owner dashboard API client. Every state-changing request carries the session's CSRF token (from the page's meta
// tag) and is same-origin; the server rejects anything else.
export type ApiResult<T = Record<string, unknown>> = { ok: true; data: T } | { ok: false; status: number; message: string; details?: unknown };
const csrf = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";
export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; json?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const r = await fetch(path, { method: opts.method ?? (opts.json !== undefined ? "POST" : "GET"), headers: { ...(opts.json !== undefined ? { "Content-Type": "application/json" } : {}), "X-CSRF-Token": csrf() }, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined, credentials: "same-origin", cache: "no-store" });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { window.location.href = "/owner/login"; return { ok: false, status: 401, message: "Your session ended. Sign in again." }; }
    if (!r.ok) return { ok: false, status: r.status, message: data?.error?.message ?? `Request failed (${r.status})`, details: data?.error };
    return { ok: true, data: data as T };
  } catch { return { ok: false, status: 0, message: "Couldn't reach the server. Check your connection." }; }
}
/** Uploads a file with progress, as a raw PUT body (the server streams it to disk and hashes it). */
export function uploadFile(path: string, file: File, onProgress: (pct: number) => void): Promise<ApiResult> {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open("PUT", path); x.setRequestHeader("X-CSRF-Token", csrf()); x.setRequestHeader("Content-Type", "application/octet-stream");
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => { let d: { error?: { message?: string } } = {}; try { d = JSON.parse(x.responseText); } catch {} resolve(x.status >= 200 && x.status < 300 ? { ok: true, data: d as Record<string, unknown> } : { ok: false, status: x.status, message: d?.error?.message ?? `Upload failed (${x.status})`, details: d?.error }); };
    x.onerror = () => resolve({ ok: false, status: 0, message: "The upload was interrupted. Check your connection and try again." });
    x.send(file);
  });
}
