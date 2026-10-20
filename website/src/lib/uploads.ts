import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/*
 * Upload validation. Every rule runs on the server against the bytes actually received:
 * size limit while streaming (the upload is cut off as soon as it's too big), file name allow-list,
 * extension allowed for the asset kind, and the file's real format from its magic bytes (a renamed file fails).
 * The SHA-256 is computed from the same stream, so the stored checksum is of exactly the stored bytes.
 */
export type AssetKind = "installer" | "portable" | "package" | "disk_image" | "archive" | "mod_jar" | "module_package";
export type Format = "pe" | "msi" | "zip" | "appimage" | "deb" | "rpm" | "dmg" | "gzip" | "png" | "jpeg" | "webp";
type Rule = { ext: string; format: Format; contentType: string };
const R = (ext: string, format: Format, contentType: string): Rule => ({ ext, format, contentType });
export const KIND_RULES: Record<AssetKind, Rule[]> = {
  installer: [R(".exe", "pe", "application/vnd.microsoft.portable-executable"), R(".msi", "msi", "application/x-msi")],
  portable: [R(".exe", "pe", "application/vnd.microsoft.portable-executable"), R(".zip", "zip", "application/zip")],
  package: [R(".appimage", "appimage", "application/vnd.appimage"), R(".deb", "deb", "application/vnd.debian.binary-package"), R(".rpm", "rpm", "application/x-rpm")],
  disk_image: [R(".dmg", "dmg", "application/x-apple-diskimage")],
  archive: [R(".zip", "zip", "application/zip"), R(".tar.gz", "gzip", "application/gzip")],
  mod_jar: [R(".jar", "zip", "application/java-archive")],
  module_package: [R(".jar", "zip", "application/java-archive"), R(".zip", "zip", "application/zip")],
};
export const IMAGE_RULES: Rule[] = [R(".png", "png", "image/png"), R(".jpg", "jpeg", "image/jpeg"), R(".jpeg", "jpeg", "image/jpeg"), R(".webp", "webp", "image/webp")];
export const FILENAME_RE = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/;

export function detectFormat(head: Buffer, tail: Buffer): Format | null {
  const at = (off: number, bytes: number[] | string) => { const b = typeof bytes === "string" ? Buffer.from(bytes, "latin1") : Buffer.from(bytes); return head.length >= off + b.length && head.subarray(off, off + b.length).equals(b); };
  if (at(0, "MZ") && head.length >= 64) { const pe = head.readUInt32LE(0x3c); if (pe + 4 <= head.length && head.subarray(pe, pe + 4).equals(Buffer.from("PE\0\0", "latin1"))) return "pe"; return null; }
  if (at(0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "msi";
  if (at(0, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  if (at(0, [0x7f, 0x45, 0x4c, 0x46]) && at(8, [0x41, 0x49, 0x02])) return "appimage";
  if (at(0, "!<arch>\ndebian-binary")) return "deb";
  if (at(0, [0xed, 0xab, 0xee, 0xdb])) return "rpm";
  if (at(0, [0x1f, 0x8b])) return "gzip";
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (at(0, [0xff, 0xd8, 0xff])) return "jpeg";
  if (at(0, "RIFF") && at(8, "WEBP")) return "webp";
  if (tail.length >= 512 && tail.subarray(tail.length - 512, tail.length - 508).equals(Buffer.from("koly"))) return "dmg";
  return null;
}

export type Received = { tmpPath: string; size: number; sha256: string; head: Buffer; tail: Buffer };
export class UploadError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }

/** Streams a request body to a private temp file, hashing as it goes and stopping at maxBytes. */
export async function receive(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Received> {
  if (!body) throw new UploadError(400, "empty", "The upload is empty.");
  const dir = path.join(os.tmpdir(), "auroras-uploads");
  await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
  const tmpPath = path.join(dir, crypto.randomUUID() + ".part");
  const out = fs.createWriteStream(tmpPath, { mode: 0o600 });
  const hash = crypto.createHash("sha256");
  let writeError: Error | null = null;
  out.on("error", (e) => { writeError = e; }); // surfaced below; never left as an unhandled stream error
  let size = 0; const headParts: Buffer[] = []; let headLen = 0; let tail = Buffer.alloc(0);
  try {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      size += chunk.length;
      if (size > maxBytes) { await reader.cancel().catch(() => {}); throw new UploadError(413, "too_large", `The file is larger than the ${Math.round(maxBytes / 1048576)} MB limit.`); }
      hash.update(chunk);
      if (headLen < 8192) { headParts.push(chunk.subarray(0, 8192 - headLen)); headLen += Math.min(chunk.length, 8192 - headLen); }
      tail = Buffer.concat([tail, chunk]); if (tail.length > 65536) tail = tail.subarray(tail.length - 65536);
      if (writeError) throw writeError;
      if (!out.write(chunk)) await new Promise<void>((r) => { out.once("drain", r); out.once("error", () => r()); });
    }
    await new Promise<void>((res, rej) => out.end((e?: Error | null) => (e ? rej(e) : res())));
  } catch (e) { out.destroy(); await fsp.rm(tmpPath, { force: true }); throw e; }
  if (size === 0) { await fsp.rm(tmpPath, { force: true }); throw new UploadError(400, "empty", "The upload is empty."); }
  return { tmpPath, size, sha256: hash.digest("hex"), head: Buffer.concat(headParts), tail };
}

export type Check = { name: string; ok: boolean; detail?: string };
/** Validates a received file against a rule set. Returns the matched rule and the checks for the dashboard. */
export function validateFile(filename: string, r: Pick<Received, "head" | "tail" | "size">, rules: Rule[], opts: { requireFabricMod?: boolean } = {}) {
  const checks: Check[] = [];
  const nameOk = FILENAME_RE.test(filename) && !filename.includes("..");
  checks.push({ name: "File name", ok: nameOk, detail: nameOk ? filename : "Letters, digits, . _ + - only; no paths" });
  const lower = filename.toLowerCase();
  const rule = rules.find((x) => lower.endsWith(x.ext)) ?? null;
  checks.push({ name: "File type allowed", ok: !!rule, detail: rule ? rule.ext : "Allowed: " + rules.map((x) => x.ext).join(", ") });
  const fmt = detectFormat(r.head, r.tail);
  const fmtOk = !!rule && fmt === rule.format;
  checks.push({ name: "Contents match the type", ok: fmtOk, detail: fmt ? "Detected " + fmt : "Unrecognised file format" });
  if (opts.requireFabricMod && rule?.format === "zip") {
    const has = r.tail.includes(Buffer.from("fabric.mod.json"));
    checks.push({ name: "Fabric mod metadata", ok: has, detail: has ? "fabric.mod.json found" : "No fabric.mod.json in the jar" });
  }
  checks.push({ name: "Size", ok: r.size > 0, detail: r.size + " bytes" });
  return { ok: checks.every((c) => c.ok), rule, checks };
}
export const discard = (p: string) => fsp.rm(p, { force: true });
