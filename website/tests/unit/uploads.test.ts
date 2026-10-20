import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { detectFormat, IMAGE_RULES, KIND_RULES, receive, UploadError, validateFile } from "../../src/lib/uploads";

const pe = () => { const b = Buffer.alloc(256); b.write("MZ", 0, "latin1"); b.writeUInt32LE(0x80, 0x3c); b.write("PE\0\0", 0x80, "latin1"); return b; };
const zip = (extra = "") => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(60), Buffer.from(extra)]);
const file = (buf: Buffer) => ({ head: buf.subarray(0, 4096), tail: buf.subarray(Math.max(0, buf.length - 65536)), size: buf.length });

test("magic bytes are detected", () => {
  assert.equal(detectFormat(pe(), pe()), "pe");
  assert.equal(detectFormat(zip(), zip()), "zip");
  assert.equal(detectFormat(Buffer.from("MZ not really an exe".padEnd(100)), Buffer.alloc(0)), null);
  assert.equal(detectFormat(Buffer.from("<html><script>alert(1)</script>"), Buffer.alloc(0)), null);
  assert.equal(detectFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]), Buffer.alloc(0)), "png");
});
test("installer must be a real PE named .exe", () => {
  assert.ok(validateFile("AurorasClientSetup-0.2.0.exe", file(pe()), KIND_RULES.installer).ok);
  assert.ok(!validateFile("AurorasClientSetup-0.2.0.exe", file(zip()), KIND_RULES.installer).ok, "zip renamed .exe");
  assert.ok(!validateFile("setup.bat", file(pe()), KIND_RULES.installer).ok, "wrong extension");
  assert.ok(!validateFile("../evil.exe", file(pe()), KIND_RULES.installer).ok, "path traversal");
  assert.ok(!validateFile("a b.exe", file(pe()), KIND_RULES.installer).ok, "spaces");
  assert.ok(!validateFile("x.exe", { ...file(pe()), size: 0 }, KIND_RULES.installer).ok, "empty");
});
test("mod jars need fabric.mod.json", () => {
  assert.ok(validateFile("auroras.jar", file(zip("....fabric.mod.json....")), KIND_RULES.mod_jar, { requireFabricMod: true }).ok);
  assert.ok(!validateFile("auroras.jar", file(zip("nothing")), KIND_RULES.mod_jar, { requireFabricMod: true }).ok);
});
test("images: SVG and HTML are refused", () => {
  assert.ok(!validateFile("icon.svg", file(Buffer.from("<svg onload=alert(1)>")), IMAGE_RULES).ok);
  assert.ok(!validateFile("icon.png", file(Buffer.from("<html>")), IMAGE_RULES).ok);
});
const stream = (buf: Buffer, chunk = 1000) => new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < buf.length; i += chunk) c.enqueue(new Uint8Array(buf.subarray(i, i + chunk))); c.close(); } });
test("receive() computes SHA-256 server-side while streaming and enforces the size cap", async () => {
  const buf = crypto.randomBytes(300_000);
  const r = await receive(stream(buf), 1_000_000);
  assert.equal(r.sha256, crypto.createHash("sha256").update(buf).digest("hex"));
  assert.equal(r.size, buf.length);
  assert.deepEqual(fs.readFileSync(r.tmpPath), buf);
  fs.rmSync(r.tmpPath);
  await assert.rejects(receive(stream(buf), 100_000), (e: unknown) => e instanceof UploadError && e.status === 413);
});
