# Auroras Client website

The public site, download platform and private owner dashboard for Auroras Client.

- **Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, Framer Motion, PostgreSQL via Drizzle ORM.
- **Storage:** local disk or any S3-compatible bucket (Cloudflare R2, AWS S3, Backblaze B2, MinIO).
- **Release records:** one record per release drives the homepage, the download page, the changelog and the launcher's signed update manifest at `/updates/manifest.json`.

Nothing in this folder is connected to a hosted service yet. Every external service is configured through environment variables, and `.env.example` contains placeholders only.

## Pages

| Area | Routes |
| --- | --- |
| Public | `/`, `/features`, `/download`, `/modules` (search, filters, sort), `/modules/<slug>`, `/changelog`, `/docs`, `/docs/<slug>`, `/community`, `/privacy`, `/terms` |
| Launcher updates | `/updates/manifest.json`, `/updates/manifest.json.sig`, `/updates/public-key.pem` |
| Downloads | `/api/download/<assetId>`: published files only. Anything else, including drafts and guessed ids, gets the same 404. |
| Owner | `/owner/login`, `/owner` (overview), releases, modules, site content, announcements, documentation, audit log, security |
| CI | `/api/ci/releases…` (Bearer CI token, scoped) |

## Local development

```bash
cd website
npm ci
cp .env.example .env.local        # then fill in DATABASE_URL, AUTH_SECRET, DATA_ENCRYPTION_KEY
npm run keys:generate             # prints an Ed25519 key pair; put the private key in UPDATE_SIGNING_KEY
npm run db:migrate
npm run db:seed                   # settings, docs, the client-mod module, and the real v0.1.x GitHub releases
npm run owner:create -- --username yourname   # prompts for a password, prints the TOTP secret and recovery codes
npm run dev                       # http://localhost:3000, dashboard at /owner
```

The seed imports the real GitHub releases from `src/data/github-releases.json`. Those files stay on github.com, and download links redirect there. Their checksums come from each release's `SHA256SUMS.txt`, and the dashboard labels them "imported". To refresh the snapshot, run `npm run import:github -- --refresh`.

After the launcher's `visuals/registry.json`, `compat.json` or `adapters.json` change, run `npm run sync:product-data`. A unit test fails while the copies differ.

## Tests

| Command | What it runs |
| --- | --- |
| `npm test` | Unit tests: RFC TOTP vectors, semver parity with `updater.js`, manifest building and verification with the launcher's own `updater.js`, upload detection and limits, env validation, a static check that every owner and CI route and page is guarded, and product-data sync. |
| `npm run build && npm run test:bundle` | Scans `.next/static` for secrets, secret env names, database URLs, key material and server-only modules. |
| `TEST_DATABASE_URL=… npm run test:api` | Starts `next start` against a database it wipes. Checks authn/authz, CSRF, sessions, rate limiting, CI scopes, invalid uploads, server-side SHA-256, draft privacy, publish/unpublish/withdraw/rollback consistency across every public surface and the signed manifest, audit records, Markdown XSS, security headers and the CI release script. |
| `TEST_DATABASE_URL=… npm run test:e2e` | Playwright end to end: sign in with TOTP, create a draft, upload, publish, then check the public site. Set `PLAYWRIGHT_PATH` if Playwright is not installed globally. |
| `TEST_DATABASE_URL=… SHOTS_DIR=… npm run screenshots` | Captures every public page (desktop and mobile) and every owner page. |

## Production setup (what the owner has to do)

1. **Database.** Create a PostgreSQL 14+ database with TLS (Neon, Supabase, RDS, Fly Postgres and so on). Set `DATABASE_URL`, then run `npm run db:migrate` and `npm run db:seed` once.
2. **Storage.** Create a private bucket. Cloudflare R2 is cheap for downloads. Set `STORAGE_DRIVER=s3` and the `S3_*` variables. The bucket must not be public: the site hands out short-lived signed URLs (`DOWNLOAD_URL_TTL_SECONDS`) only for published files. A single server with a persistent disk can use `STORAGE_DRIVER=local` with `STORAGE_LOCAL_DIR` on that disk instead.
3. **Secrets.** Set `AUTH_SECRET`, `DATA_ENCRYPTION_KEY` and `UPDATE_SIGNING_KEY` in the host's secret store. Never put them in git.
   - The signing key's **public** half must match the key the launcher trusts.
   - If you sign manifests for existing launchers, reuse the key pair from `scripts/gen-update-keys.js` (the private key in `update-private-key.pem`, which is never committed). Paste its contents into `UPDATE_SIGNING_KEY`.
4. **Hosting.** Any Node 22 host works: Vercel, Fly.io, Railway, Render, or a VPS with the included `Dockerfile`.
   - Set `APP_ENV=production` and `SITE_URL=https://your-domain`.
   - Run a single instance, or accept up to 60 s of staleness between instances: page data is cached per instance and invalidated on the instance that made the change. Optional Cloudflare purge (`CLOUDFLARE_*`) clears a CDN in front.
   - Set `TRUST_PROXY_HEADERS=true` only behind a proxy that overwrites `X-Forwarded-For`.
5. **DNS.** Point your domain (for example `aurorasclient.example`) at the host with an A/AAAA or CNAME record. Use HTTPS only; HSTS is sent.
6. **Owner.** Run `npm run owner:create -- --username <name>` on the server, add the TOTP secret to an authenticator app and store the recovery codes offline. There is no sign-up page: the owner is provisioned from the CLI.
7. **Launcher.** In the launcher, set the update manifest URL (Settings → Updates) to `https://your-domain/updates/manifest.json`. The launcher fetches `manifest.json.sig` next to it and verifies it with its built-in public key.
8. **CI (optional).**
   - Create a CI token on the dashboard's Security page and store it with the site URL as the GitHub secrets `AURORAS_SITE_CI_TOKEN` and `AURORAS_SITE_URL`.
   - Create the environments `website-drafts` and `website-production`, and add yourself as a required reviewer on `website-production`.
   - `.github/workflows/website-release.yml` then uploads each new GitHub release as private drafts and publishes them only after your approval.
9. **Email (not built).** There is no email provider. Security alerts (failed and blocked sign-ins, CSRF rejections, MFA resets) are recorded in the audit log and shown on the overview page.

## Security model

- **Owner account.** A single owner with an argon2id password (minimum 14 characters) and mandatory TOTP in production. TOTP codes cannot be replayed. There are 10 single-use recovery codes, and the TOTP secret is AES-256-GCM encrypted at rest.
- **Sessions.** Server-side rows hold a hash of the cookie token. The cookie is `__Host-`, HttpOnly, Secure and SameSite=Strict.
  - Sessions expire after `SESSION_TTL_HOURS` in total, or after `SESSION_IDLE_MINUTES` without use.
  - A session is bound to the browser that created it. A cookie replayed from another browser is refused and the session revoked.
  - Sessions can be revoked from the dashboard or the CLI, and changing the password revokes all of them.
- **Authorization.** Deny by default. Every owner route uses `ownerRoute()`, every owner page calls `requireOwnerPage()` and every CI route uses `ciRoute(scope)`. A unit test fails if a route or page skips its guard. The middleware also turns away anonymous requests, but only as an early filter.
- **CSRF.** Every state-changing owner request must come from the site's Origin and carry the session's CSRF token.
- **Rate limits.** Sign-in is limited to 5 failures per username or 20 per IP in 15 minutes. These limits live in the database, so they hold across instances. IPs are stored only as keyed hashes.
- **Uploads.**
  - Bodies are streamed to disk with a size cap, and the server computes the SHA-256.
  - The file type comes from the content's magic bytes (PE, MSI, ZIP/JAR, AppImage, deb, rpm, dmg, gzip) and must match the extension.
  - A mod jar must contain `fabric.mod.json`.
  - Image uploads accept PNG, JPEG or WebP only, never SVG.
  - Files of a published release are immutable.
- **Content.** Markdown is rendered without raw HTML, and `javascript:` links are dropped.
- **Headers.** Every response gets a per-request nonce CSP, HSTS, `X-Frame-Options: DENY`, nosniff, a strict Referrer-Policy, Permissions-Policy and COOP/CORP.
- **Audit.** Every sign-in, release action, upload, settings change and token change is written to `audit_events`. Secret-looking fields are scrubbed first.

## Releases and the update manifest

Every release change runs in one transaction under an advisory lock: publish, unpublish, withdraw, rollback, and edits to a live release. Each change writes a new manifest version, which is signed when a key is configured, plus an audit event. Caches are then invalidated (Next.js tags, plus the optional Cloudflare purge and webhook). If a follow-up step fails, the dashboard says so, and **Retry sync** on the overview reruns it.

The manifest keeps the launcher's existing format, so current launchers read it unchanged:

```json
{ "schema": 1, "product": "auroras-client", "generatedAt": "…",
  "launcher": { "stable": { "version": "0.1.9", "url": "https://…/api/download/<id>", "sha256": "…", "notes": "…", … },
                "preview": { … }, "beta": { … }, "experimental": { … } },
  "client": [ { "version": "…", "mc": "26.3", "loader": "fabric", "channel": "stable", "url": "…", "sha256": "…" } ],
  "withdrawn": [ { "product": "launcher", "version": "…", "sha256": ["…"] } ] }
```

- **Channels.** Beta releases feed the launcher's `preview` channel. Experimental releases are listed only under `experimental`, which current launchers never select. A channel with nothing published is left out.
- **Signature.** A detached Ed25519 signature over the exact bytes, served base64 at `/updates/manifest.json.sig`. This is the same scheme as `scripts/sign-manifest.js` and `updater.verifyManifest`.

## Backups and restore

- **Database.** Back it up with `pg_dump --format=custom "$DATABASE_URL" > auroras-$(date +%F).dump`, or use your provider's point-in-time recovery. Restore with `pg_restore --clean --if-exists -d "$DATABASE_URL" file.dump`, then run `npm run db:migrate`.
- **Files.** Enable bucket versioning, or copy the bucket on a schedule. For local storage, back up `STORAGE_LOCAL_DIR`.
- **Manifest.** Every manifest version is stored in the `manifests` table, so a restore also restores the exact signed bytes. After a restore, press **Retry sync** in the dashboard to refresh caches.

## Logging and monitoring

- `/api/health` returns up or down for uptime checks.
- Server errors are logged to stdout as one line each, without request bodies or secrets.
- The overview shows health for the database, storage, signing key, CDN purge and webhook.

## Recovery

If you lose the authenticator, sign in with a recovery code. If you lose both, run `npm run owner:reset-mfa` on the server; it re-enrolls TOTP, issues new recovery codes and signs out every session. Other recovery commands:

- `npm run owner:reset-password` sets a new password.
- `npm run owner:revoke-sessions` signs out everywhere.
