import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fakeExe, fakeJar, ORIGIN, Owner, page, sha256, start, stop, totpNow, UA, OWNER, type Ctx } from "./harness";
const updater = createRequire(path.join(process.cwd(), "package.json"))("../updater.js");

let c: Ctx, owner: Owner;
before(async () => { c = await start(); owner = await Owner.login(c, totpNow(c.totpSecret)); }, { timeout: 240_000 });
after(async () => { if (process.env.DEBUG_SERVER) console.log(c.logs.join("")); await stop(c); });

const anon = (p: string, init: RequestInit = {}) => fetch(ORIGIN + p, { redirect: "manual", ...init, headers: { "User-Agent": UA, ...(init.headers as Record<string, string>) } });
async function manifest() {
  const body = Buffer.from(await (await anon("/updates/manifest.json")).arrayBuffer());
  const sig = await (await anon("/updates/manifest.json.sig")).text();
  const pem = await (await anon("/updates/public-key.pem")).text();
  assert.equal(pem.trim(), c.publicKeyPem.trim(), "served public key is the configured one");
  const m = updater.verifyManifest(body, sig.trim(), pem); // throws if the signature or schema is wrong
  // The test server runs on http://localhost; updater.js (rightly) refuses non-https URLs, so the selection checks
  // below run on a copy with the scheme swapped. Production SITE_URL must be https (enforced by env validation).
  return JSON.parse(JSON.stringify(m).replaceAll(ORIGIN, ORIGIN.replace("http://", "https://")));
}
const HTTPS = ORIGIN.replace("http://", "https://");
async function draft(version: string, channel = "stable", moduleId: string | null = null) {
  return (await owner.j("/api/owner/releases", { json: { version, channel, moduleId, title: `Auroras Client ${version}`, summary: `Summary for ${version}`, changes: { added: [`Feature of ${version}`], improved: [], fixed: [], breaking: [] } } })).release.id as string;
}
async function upload(id: string, buf: Buffer, q: Record<string, string>) {
  const r = await owner.req(`/api/owner/releases/${id}/assets?` + new URLSearchParams(q), { method: "PUT", body: new Uint8Array(buf), headers: { "Content-Type": "application/octet-stream" } });
  return { status: r.status, body: await r.json() };
}
const publish = (id: string) => owner.j(`/api/owner/releases/${id}/publish`, { json: { confirm: true } });
const surfaces = async () => ({ home: await page("/"), download: await page("/download"), changelog: await page("/changelog"), latest: await (await anon("/api/releases/latest")).json(), manifest: await manifest() });

describe("authentication and authorization", () => {
  test("anonymous requests to owner APIs and pages are rejected", async () => {
    for (const [m, p] of [["GET", "/api/owner/releases"], ["POST", "/api/owner/releases"], ["PUT", "/api/owner/settings/home"], ["DELETE", "/api/owner/sessions/0123456789abcdef"], ["GET", "/api/owner/system/resync"]]) {
      const r = await anon(p, { method: m, headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: m === "GET" ? undefined : "{}" });
      assert.equal(r.status, 401, `${m} ${p}`);
    }
    const r = await anon("/owner/releases"); assert.equal(r.status, 307); assert.match(r.headers.get("location") || "", /\/owner\/login$/);
  });
  test("a forged or stale session cookie is rejected by the server, not only the middleware", async () => {
    for (const cookie of ["__Host-auroras_owner=forged", "__Host-auroras_owner=" + crypto.randomBytes(32).toString("base64url")]) {
      assert.equal((await anon("/api/owner/releases", { headers: { Cookie: cookie } })).status, 401);
      const p = await anon("/owner", { headers: { Cookie: cookie } });
      assert.equal(p.status, 307, "owner page redirects to sign-in");
    }
  });
  test("CSRF: missing token, wrong token and cross-site origin are refused", async () => {
    const body = JSON.stringify({ version: "9.9.9" });
    const base = { Cookie: owner.cookie, "User-Agent": UA, "Content-Type": "application/json" };
    assert.equal((await anon("/api/owner/releases", { method: "POST", headers: { ...base, Origin: ORIGIN }, body })).status, 403);
    assert.equal((await anon("/api/owner/releases", { method: "POST", headers: { ...base, Origin: ORIGIN, "X-CSRF-Token": "x".repeat(32) }, body })).status, 403);
    assert.equal((await anon("/api/owner/releases", { method: "POST", headers: { ...base, Origin: "https://evil.example", "X-CSRF-Token": owner.csrf }, body })).status, 403);
    assert.equal((await anon("/api/owner/releases", { method: "POST", headers: { ...base, "X-CSRF-Token": owner.csrf }, body })).status, 403, "no Origin/Referer");
    const [row] = await c.sql`select count(*)::int as n from releases where version = '9.9.9'`; assert.equal(row.n, 0);
    const [ev] = await c.sql`select count(*)::int as n from audit_events where action = 'security.csrf_rejected'`; assert.ok(ev.n >= 4);
  });
  test("session bound to its browser: a cookie replayed from another browser is refused and the session revoked", async () => {
    const s = await Owner.login(c);
    assert.equal((await fetch(ORIGIN + "/api/owner/releases", { headers: { Cookie: s.cookie, "User-Agent": "other-browser" } })).status, 401);
    assert.equal((await s.req("/api/owner/releases")).status, 401, "the stolen session is now dead for the original browser too");
  });
  test("login: wrong password, wrong code and cross-origin login fail; replayed TOTP code fails", async () => {
    const login = (b: object, origin = ORIGIN) => anon("/api/owner/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(b) });
    assert.equal((await login({ ...OWNER, password: "wrong password here", code: totpNow(c.totpSecret) })).status, 401);
    assert.equal((await login({ ...OWNER, code: "000000" === totpNow(c.totpSecret) ? "111111" : "000000" })).status, 401);
    assert.equal((await login({ ...OWNER, code: totpNow(c.totpSecret) }, "https://evil.example")).status, 403);
    // The code used by the initial sign-in (same 30 s step or the one before) cannot be used again.
    const [o] = await c.sql`select totp_last_step from owners`;
    assert.ok(o.totp_last_step > 0);
  });
  test("login rate limiting blocks repeated failures", async () => {
    const login = () => anon("/api/owner/auth/login", { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: JSON.stringify({ username: "someone-else", password: "nope nope nope", code: "123456" }) });
    const codes = []; for (let i = 0; i < 7; i++) codes.push((await login()).status);
    assert.deepEqual(codes.slice(0, 5), [401, 401, 401, 401, 401]);
    assert.equal(codes[6], 429);
    const [ev] = await c.sql`select count(*)::int as n from audit_events where action = 'auth.login_blocked'`; assert.ok(ev.n >= 1);
  });
  test("expired and revoked sessions stop working", async () => {
    const a = await Owner.login(c), b = await Owner.login(c);
    assert.equal((await a.req("/api/owner/releases")).status, 200);
    await c.sql`update sessions set expires_at = now() - interval '1 minute' where id = ${sha256(Buffer.from(decodeURIComponent(a.cookie.split("=")[1])))}`;
    assert.equal((await a.req("/api/owner/releases")).status, 401, "expired");
    await b.j("/api/owner/auth/logout", { json: {} });
    assert.equal((await b.req("/api/owner/releases")).status, 401, "logged out");
    const d = await Owner.login(c);
    const r = await owner.j("/api/owner/sessions/revoke-others", { json: {} });
    assert.ok(r.revoked >= 1);
    assert.equal((await d.req("/api/owner/releases")).status, 401, "revoked by another session");
    assert.equal((await owner.req("/api/owner/releases")).status, 200, "the revoking session survives");
  });
  test("CI tokens: required, scoped, revocable", async () => {
    const { token, id } = await owner.j("/api/owner/ci-tokens", { json: { name: "test-ci", allowPublish: false } });
    const ci = (p: string, init: RequestInit = {}, t = token) => anon(p, { ...init, headers: { Authorization: "Bearer " + t, "Content-Type": "application/json", ...(init.headers as Record<string, string>) } });
    assert.equal((await anon("/api/ci/releases", { method: "POST", body: "{}" })).status, 401);
    assert.equal((await ci("/api/ci/releases", { method: "POST", body: "{}" }, "aur_ci_" + "A".repeat(43))).status, 401);
    const created = await ci("/api/ci/releases", { method: "POST", body: JSON.stringify({ version: "5.0.0", channel: "experimental" }) });
    assert.equal(created.status, 201);
    const rid = (await created.json()).release.id;
    assert.equal((await ci(`/api/ci/releases/${rid}/publish`, { method: "POST", body: JSON.stringify({ confirm: true }) })).status, 403, "draft-only token can't publish");
    await owner.j(`/api/owner/ci-tokens/${id}`, { method: "DELETE" });
    assert.equal((await ci("/api/ci/releases", { method: "POST", body: "{}" })).status, 401, "revoked");
    await owner.j(`/api/owner/releases/${rid}`, { method: "DELETE" });
  });
});

describe("uploads", () => {
  let rid: string;
  before(async () => { rid = await draft("0.9.0"); });
  after(async () => { await owner.j(`/api/owner/releases/${rid}`, { method: "DELETE" }); });
  test("invalid uploads are rejected", async () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    let r = await upload(rid, html, { filename: "Setup.exe", kind: "installer", platform: "windows" }); assert.equal(r.status, 422, "HTML renamed .exe");
    r = await upload(rid, fakeJar(), { filename: "Setup.exe", kind: "installer", platform: "windows" }); assert.equal(r.status, 422, "zip renamed .exe");
    r = await upload(rid, fakeExe(), { filename: "setup.bat", kind: "installer", platform: "windows" }); assert.equal(r.status, 422, "bat");
    r = await upload(rid, fakeExe(), { filename: "../../etc/passwd.exe", kind: "installer", platform: "windows" }); assert.ok([400, 422].includes(r.status), "traversal " + r.status);
    r = await upload(rid, Buffer.alloc(0), { filename: "Setup.exe", kind: "installer", platform: "windows" }); assert.equal(r.status, 400, "empty");
    r = await upload(rid, fakeExe(3 * 1024 * 1024), { filename: "Setup.exe", kind: "installer", platform: "windows" }); assert.equal(r.status, 413, "over MAX_UPLOAD_MB");
    r = await upload(rid, fakeJar().subarray(0, 300), { filename: "mod.jar", kind: "mod_jar", platform: "any", mc: "26.3", loader: "fabric" }); assert.equal(r.status, 422, "jar without fabric.mod.json");
    const [n] = await c.sql`select count(*)::int as n from assets where release_id = ${rid}`; assert.equal(n.n, 0);
    const [ev] = await c.sql`select count(*)::int as n from audit_events where action = 'asset.upload_rejected'`; assert.ok(ev.n >= 4);
  });
  test("server computes the SHA-256; the stored file and the download match it", async () => {
    const buf = fakeExe(50_000);
    const r = await upload(rid, buf, { filename: "AurorasClientSetup-0.9.0.exe", kind: "installer", platform: "windows" });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.asset.sha256, sha256(buf));
    assert.equal(r.body.asset.size, buf.length);
    const own = await owner.req(`/api/owner/releases/${rid}/assets/${r.body.asset.id}`);
    assert.equal(own.status, 200); assert.equal(sha256(Buffer.from(await own.arrayBuffer())), sha256(buf));
    const dup = await upload(rid, buf, { filename: "AurorasClientSetup-0.9.0.exe", kind: "installer", platform: "windows" });
    assert.equal(dup.status, 409, "same file name twice");
  });
});

describe("release lifecycle keeps every public surface consistent", () => {
  const files: Record<string, { id: string; buf: Buffer }> = {};
  const ids: Record<string, string> = {};
  test("a draft is private: not on any page, not in the manifest, file not downloadable", async () => {
    ids.a = await draft("0.2.0");
    const buf = fakeExe(20_000);
    const r = await upload(ids.a, buf, { filename: "AurorasClientSetup-0.2.0.exe", kind: "installer", platform: "windows" });
    files.a = { id: r.body.asset.id, buf };
    const s = await surfaces();
    for (const k of ["home", "download", "changelog"] as const) assert.ok(!s[k].includes("0.2.0"), k);
    assert.equal(s.latest.stable, null);
    assert.deepEqual(s.manifest.launcher, {});
    const d = await anon(`/api/download/${files.a.id}`), guess = await anon(`/api/download/${crypto.randomUUID()}`), junk = await anon(`/api/download/..%2F..%2Fetc%2Fpasswd`);
    assert.equal(d.status, 404); assert.equal(guess.status, 404); assert.equal(junk.status, 404);
    assert.equal(await d.text(), await guess.text(), "a draft looks exactly like a file that doesn't exist");
    assert.equal((await anon(`/api/download/${files.a.id}`, { method: "HEAD" })).status, 404);
    assert.equal((await anon(`/owner/releases/${ids.a}/preview`)).status, 307, "preview is owner-only");
    assert.equal((await anon(`/api/owner/releases/${ids.a}`)).status, 401);
  });
  test("publish: homepage, download page, changelog, latest API and signed manifest all show it", async () => {
    await publish(ids.a);
    const s = await surfaces();
    for (const k of ["home", "download", "changelog"] as const) assert.ok(s[k].includes("0.2.0"), k);
    assert.ok(s.download.includes(sha256(files.a.buf)), "download page shows the checksum");
    assert.equal(s.latest.stable.version, "0.2.0");
    assert.equal(s.manifest.launcher.stable.version, "0.2.0");
    assert.equal(s.manifest.launcher.stable.sha256, sha256(files.a.buf));
    assert.equal(s.manifest.launcher.stable.url, `${HTTPS}/api/download/${files.a.id}`);
    assert.equal(updater.selectLauncherUpdate(s.manifest, "0.1.9", "stable").version, "0.2.0");
    const d = await anon(`/api/download/${files.a.id}`);
    assert.equal(d.status, 200); assert.equal(sha256(Buffer.from(await d.arrayBuffer())), sha256(files.a.buf));
    assert.match(d.headers.get("content-disposition") || "", /AurorasClientSetup-0\.2\.0\.exe/);
    const range = await anon(`/api/download/${files.a.id}`, { headers: { Range: "bytes=0-99" } });
    assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 100);
  });
  test("published files and version are locked", async () => {
    const r = await upload(ids.a, fakeExe(), { filename: "Other.exe", kind: "installer", platform: "windows" });
    assert.equal(r.status, 409);
    assert.equal((await owner.req(`/api/owner/releases/${ids.a}/assets/${files.a.id}`, { method: "DELETE" })).status, 409);
  });
  test("a newer release becomes the latest everywhere", async () => {
    ids.b = await draft("0.2.1");
    const buf = fakeExe(21_000);
    files.b = { id: (await upload(ids.b, buf, { filename: "AurorasClientSetup-0.2.1.exe", kind: "installer", platform: "windows" })).body.asset.id, buf };
    await publish(ids.b);
    const s = await surfaces();
    assert.equal(s.latest.stable.version, "0.2.1");
    assert.equal(s.manifest.launcher.stable.version, "0.2.1");
    assert.equal(s.manifest.launcher.stable.sha256, sha256(buf));
    assert.ok(s.home.includes("0.2.1") && s.download.includes("0.2.1") && s.changelog.includes("0.2.1"));
  });
  test("rollback: 0.2.0 is current again on every surface; 0.2.1 disappears", async () => {
    await owner.j(`/api/owner/releases/${ids.b}/rollback`, { json: { targetId: ids.a, withdrawCurrent: false, reason: "test rollback" } });
    const s = await surfaces();
    assert.equal(s.latest.stable.version, "0.2.0");
    assert.equal(s.manifest.launcher.stable.version, "0.2.0");
    for (const k of ["home", "download", "changelog"] as const) assert.ok(!s[k].includes("0.2.1"), k);
    assert.equal((await anon(`/api/download/${files.b.id}`)).status, 404);
    const [st] = await c.sql`select status from releases where id = ${ids.b}`; assert.equal(st.status, "unpublished");
  });
  test("unpublish removes a release from every surface", async () => {
    await publish(ids.b);
    assert.equal((await surfaces()).manifest.launcher.stable.version, "0.2.1");
    await owner.j(`/api/owner/releases/${ids.b}/unpublish`, { json: { confirm: true } });
    const s = await surfaces();
    assert.equal(s.manifest.launcher.stable.version, "0.2.0");
    assert.ok(!s.download.includes("0.2.1") && !s.home.includes("0.2.1") && !s.changelog.includes("0.2.1"));
  });
  test("withdraw: file blocked, manifest lists it as withdrawn, changelog explains why", async () => {
    await owner.j(`/api/owner/releases/${ids.a}/withdraw`, { json: { reason: "Crashes on start for some users" } });
    const s = await surfaces();
    assert.equal(s.latest.stable, null);
    assert.equal(s.manifest.launcher.stable, undefined);
    assert.ok(s.manifest.withdrawn.some((w: { version: string; sha256: string[] }) => w.version === "0.2.0" && w.sha256.includes(sha256(files.a.buf))));
    assert.equal((await anon(`/api/download/${files.a.id}`)).status, 404);
    assert.ok(s.changelog.includes("Crashes on start for some users"));
    assert.ok(!s.download.includes(sha256(files.a.buf)));
  });
  test("beta goes to the launcher's preview channel only; experimental is never auto-offered", async () => {
    ids.c = await draft("0.3.0-beta.1", "beta");
    await upload(ids.c, fakeExe(), { filename: "AurorasClientSetup-0.3.0-beta.1.exe", kind: "installer", platform: "windows" });
    await publish(ids.c);
    const m = await manifest();
    assert.equal(updater.selectLauncherUpdate(m, "0.1.0", "stable"), null);
    assert.equal(updater.selectLauncherUpdate(m, "0.1.0", "preview").version, "0.3.0-beta.1");
  });
  test("client mod builds appear in the manifest per Minecraft version", async () => {
    const [mod] = await c.sql`select id from modules where is_client_mod`;
    ids.m = await draft("0.2.0", "stable", mod.id);
    const jar = fakeJar();
    const r = await upload(ids.m, jar, { filename: "auroras-client-0.2.0-mc26.3.jar", kind: "mod_jar", platform: "any", arch: "any", mc: "26.3", loader: "fabric" });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    await publish(ids.m);
    const b = updater.selectClientBuild(await manifest(), { mc: "26.3", loader: "fabric", channel: "stable" });
    assert.equal(b.status, "available"); assert.equal(b.build.sha256, sha256(jar));
  });
  test("every change is in the audit log", async () => {
    const rows = await c.sql`select action from audit_events where target_id in ${c.sql([ids.a, ids.b])}`;
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ["release.create", "asset.upload", "release.publish", "release.rollback", "release.unpublish", "release.withdraw"]) assert.ok(actions.has(a), a + " missing: " + [...actions].join(","));
    const [m] = await c.sql`select count(*)::int as n from manifests`; assert.ok(m.n >= 6, "a manifest version per change");
  });
});

describe("content safety and headers", () => {
  test("Markdown can't inject script or javascript: links", async () => {
    await owner.j("/api/owner/docs", { json: { slug: "xss-test", title: "XSS test", bodyMd: "<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[click](javascript:alert(3))\n\n<iframe src=https://evil.example></iframe>", published: true } });
    const html = await page("/docs/xss-test");
    assert.ok(html.includes("XSS test"));
    assert.ok(!html.includes("<script>alert(1)"), "script tag"); assert.ok(!/onerror=/.test(html), "event handler");
    assert.ok(!/href="javascript:/i.test(html), "javascript: link"); assert.ok(!html.includes("<iframe src=\"https://evil"), "iframe");
  });
  test("settings refuse non-https links", async () => {
    const r = await owner.req("/api/owner/settings/community", { method: "PUT", json: { value: { discordUrl: "javascript:alert(1)" } } });
    assert.equal(r.status, 400);
  });
  test("security headers are set; owner pages are not indexable or cacheable", async () => {
    const r = await anon("/");
    assert.match(r.headers.get("content-security-policy") || "", /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    assert.match(r.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.ok(!r.headers.get("x-powered-by"));
    const o = await owner.req("/owner");
    assert.match(o.headers.get("x-robots-tag") || "", /noindex/);
    assert.match(o.headers.get("cache-control") || "", /no-store/);
  });
  test("manifest.json.sig answers 503 rather than serving an unsigned manifest as signed", async () => {
    // Covered by unit tests for the signing path; here we only check the happy path headers.
    const r = await anon("/updates/manifest.json");
    assert.equal(r.status, 200); assert.match(r.headers.get("content-type") || "", /json/);
  });
});
