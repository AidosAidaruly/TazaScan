# TazaScan Production Readiness

Status labels:

- READY: safe enough for the stated release stage.
- NEEDS_CONFIGURATION: no code change required, but production settings or operational setup are required.
- NEEDS_CODE_CHANGE: repository change is needed before the stage.
- BLOCKER: do not proceed to that stage until fixed.
- OPTIONAL: useful improvement, not required for the stage.

## Overall Assessment

Current repository state is close to a closed beta, but not ready for a public launch without operational setup.

- Closed beta readiness: about 70%.
- Public beta readiness: about 55%.
- Store release readiness: about 45%.

Main closed-beta blockers are production HTTPS configuration, hosted PostgreSQL with migrations and backups, persistent upload storage (a persistent disk at `UPLOAD_ROOT`), correct proxy settings (`TRUST_PROXY_HOPS`, body size), and a production mobile build with the HTTPS API URL.

## Runtime And Backend

| Area | Status | Notes |
| --- | --- | --- |
| Express startup | READY | `server.ts` creates the app and listens on `env.PORT`. |
| Host binding | READY | No host is passed to `listen`, so Node accepts host-platform binding behavior and works on typical managed hosts. |
| Production port | READY | `PORT` is parsed from environment and defaults to `4000` for local development. |
| Graceful shutdown | READY | `SIGINT` and `SIGTERM` close the HTTP server and disconnect Prisma. |
| Health checks | NEEDS_CONFIGURATION | `/health` and `/health/ready` exist. `/health/ready` is a basic process readiness check and does not currently verify database connectivity. |
| Request body limits | READY | JSON body limit is `1mb`; each image is limited to 5 MB. The largest valid request (a submission with 4 images and form fields) is about 20.5 MB, so a reverse proxy needs `client_max_body_size 25m` (see `docs/deployment-backend.md`). |
| Local path assumptions | NEEDS_CONFIGURATION | Uploads are stored on the local filesystem under `UPLOAD_ROOT`. Production startup refuses local storage unless `ALLOW_LOCAL_PRODUCTION_STORAGE=true`; set it only with `UPLOAD_ROOT` on a persistent disk. Ephemeral filesystems lose all images and evidence on redeploy. |
| Working directory | NEEDS_CONFIGURATION | Start from `backend/api` (`npm start` does). `.env`, a relative `UPLOAD_ROOT`, and the tracked Tesseract data (`eng.traineddata`, `rus.traineddata`) are resolved against the working directory; elsewhere tesseract.js downloads language data from the network on first OCR use. |
| Rate-limit storage | READY (single instance) | Rate limits use in-memory stores: correct for one backend instance, reset on restart. Several instances need a shared store such as Redis. |

The backend can run on a typical managed Node host if environment variables are set, migrations are deployed, and image storage persistence is handled.

## Environment Variables

| Variable | Required? | Secret? | Used by | Development value | Production requirement |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | No | No | Backend runtime | `development` | `production` |
| `PORT` | No | No | Backend HTTP server | `4000` | Host-provided port or explicit port |
| `TRUST_PROXY_HOPS` | Behind a proxy | No | Client IP for rate limits | `0` | `0` direct, `1` one reverse proxy/platform load balancer, `2` CDN + reverse proxy. Wrong values break or allow spoofing of rate limits |
| `DATABASE_URL` | Yes | Yes | Prisma/PostgreSQL | Local PostgreSQL URL | Managed PostgreSQL URL |
| `CORS_ORIGIN` | Production yes | No | Express CORS | Local admin origins | Exact Admin web origins, comma-separated |
| `JWT_SECRET` | Yes (except tests) | Yes | Admin JWT signing (HS256) | Local random secret, 32+ chars | Long random secret (32+ chars), no default; placeholders rejected |
| `JWT_ACCESS_TOKEN_TTL` | No | No | Admin JWT | `15m` | Short explicit TTL, for example `15m` |
| `ADMIN_EMAIL` | Production yes | Sensitive | Seeded admin account | Local email | Real admin email, not printed in logs |
| `ADMIN_PASSWORD` | Production yes | Yes | Seeded admin account | Local password | Unique password, 12+ characters; the seed rejects missing, blank and documented placeholder values. Rotate if exposed |
| `STORAGE_DRIVER` | No | No | Upload storage | `local` | `local` (the only implemented driver; `s3` is reserved and refused) |
| `UPLOAD_ROOT` | No | No | Upload storage | `uploads` (relative to the working directory) | Absolute path on a persistent disk |
| `ALLOW_LOCAL_PRODUCTION_STORAGE` | Production yes (with `local`) | No | Production storage guard | `false` | `true` only when `UPLOAD_ROOT` is on a persistent disk; production startup fails otherwise |
| `VITE_API_BASE_URL` | Admin yes | No | Admin frontend | `http://localhost:4000` | Production HTTPS API URL |
| `API_BASE_URL` | Mobile release yes | No | Flutter app | Localhost or emulator URL | Production HTTPS API URL |
| `TAZASCAN_PRODUCTION` | Mobile release yes | No | Flutter production guard | false | `true` for release builds |
| `TAZASCAN_DEMO_HTTP` | No | No | Flutter local-demo opt-in | false | Never in production; only for intentional local-network demo release builds |

Production secret fallback check: backend refuses production startup without `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`, and `CORS_ORIGIN`. Image URLs are relative (`/uploads/products/...`, `/product-submissions/uploads/...`) and clients resolve them against their API base URL, so no public uploads URL is configured. That is READY.

JWT secret check: outside `NODE_ENV=test` the backend refuses to start (any environment) when `JWT_SECRET` is missing, shorter than 32 characters, a known placeholder/example value, or obviously non-random. There is no fallback secret; tests use a fixed test-only secret that is rejected elsewhere.

## PostgreSQL

| Area | Status | Notes |
| --- | --- | --- |
| Prisma provider | READY | PostgreSQL is configured through `DATABASE_URL`. |
| Migrations | READY | Product, auth, submissions, scoring, ingredients, and canonical family migrations are present. |
| Production migration command | READY | Use `npm run prisma:migrate:deploy`; this was added for production deploys. |
| Seed behavior | NEEDS_CONFIGURATION | Seed creates the admin from env only if that email has no account; an existing account (password, role, active status) is never modified. Run intentionally, not automatically on every deploy unless desired. |
| Barcode lookup | READY | Barcode is unique and indexed. |
| Product search | NEEDS_CONFIGURATION | Current `contains` search is acceptable for MVP volume. PostgreSQL trigram/full-text indexes may be needed as data grows. |
| Backups | BLOCKER | A production database must have provider-managed or documented automated backups before real users. |

Initial MVP storage need is low for product records, but uploaded images can grow faster than rows.

## Images And Uploads

| Area | Status | Notes |
| --- | --- | --- |
| Product image upload validation | READY | `multer` memory storage, 5 MB limit, image decode/normalization through `sharp`. |
| Submission image upload validation | READY | Max 4 images, 5 MB each, normalized to JPEG. |
| Filename/path safety | READY | Stored filenames use generated UUIDs; admin file serving validates filenames. |
| Product image persistence | NEEDS_CONFIGURATION | Uploads now go through a storage abstraction. The implemented provider is local filesystem storage and must use persistent disk in production. |
| Submission image persistence | NEEDS_CONFIGURATION | Submission photos use the same storage abstraction. Persistent disk or object storage is required. |
| Recommended storage | NEEDS_CODE_CHANGE | Add an object/blob provider implementation before relying on ephemeral managed hosts. Keep local adapter for development and persistent-disk deployments. |

Smallest production-safe architecture:

```text
API upload endpoint
  -> image normalization
  -> FileStorage
  -> LocalFileStorage today
  -> future object/blob provider
  -> DB stores compatible imageUrl
  -> Flutter renders URL
```

Do not silently overwrite manually verified images during external imports.

See `docs/image-storage.md` for the current abstraction and future object storage path.

## CORS, Networking, And HTTPS

| Area | Status | Notes |
| --- | --- | --- |
| Development CORS | READY | Exact-origin allowlist. Empty `CORS_ORIGIN` allows only the local Admin origins (`localhost`/`127.0.0.1` on 5173 and 4173), never every origin. |
| Production CORS | READY | Production startup requires at least one exact origin in `CORS_ORIGIN`; `*`, paths and malformed entries are rejected. Other browser origins get a 403 without CORS headers. |
| Flutter native networking | READY | Native apps usually send no browser `Origin`; current CORS allows no-origin requests. |
| Admin web networking | NEEDS_CONFIGURATION | Add the exact Admin origin to `CORS_ORIGIN`. |
| HTTPS | NEEDS_CONFIGURATION | TLS should be terminated by hosting platform or reverse proxy, not custom Express TLS. |
| Trusted proxy | NEEDS_CONFIGURATION | Implemented via `TRUST_PROXY_HOPS` (an exact hop count, never `true`). Set `0` direct, `1` behind one reverse proxy, `2` for CDN + reverse proxy; verify `trustProxyHops` in the startup log. |
| Proxy body size | NEEDS_CONFIGURATION | Set the proxy's request body limit to at least `25m` (nginx default `1m` rejects valid uploads). |

No production mobile or admin build should use `http://`, `localhost`, LAN IPs, or emulator URLs.

## Flutter Production Configuration

| Area | Status | Notes |
| --- | --- | --- |
| API base URL | READY | Debug/profile builds may use local URLs (falling back to `10.0.2.2`/`localhost`). Production builds (`TAZASCAN_PRODUCTION=true`, or any release build without the `TAZASCAN_DEMO_HTTP=true` local-demo opt-in) require an explicit HTTPS `API_BASE_URL` whose host is not localhost, loopback, `::1`, an emulator alias (`10.0.2.2`, `10.0.3.2`) or link-local; otherwise the app stops on the splash screen with a clear message. Private LAN addresses stay allowed for internal deployments. |
| Android INTERNET | READY | Present. |
| Android camera | READY | Present with `required=false`. |
| Cleartext traffic | READY | Main/release manifest disables cleartext traffic unless the release build explicitly passes `TAZASCAN_DEMO_HTTP=true` (local demo only); debug overrides it for development. |
| App package id | NEEDS_CONFIGURATION | Current `applicationId` is `kz.project.project`; decide final ID before store release. |
| Release signing | NEEDS_CONFIGURATION | Release builds always use the release key; there is no debug-key fallback. A release build fails clearly unless the private `android/key.properties` and keystore exist on the build machine (see `docs/android-release.md`). |
| iOS permissions | NEEDS_CONFIGURATION | Camera/photo permission strings exist but are English; review for final Russian/Kazakh store wording. |
| Debug logs | READY | Network debug logs are guarded by Flutter debug mode. |

The guard runs at app startup (`ApiConfig.baseUrlProblem`); launch every release build once before distributing it. A build-time check is not implemented.

## Admin Strategy

| Area | Status | Notes |
| --- | --- | --- |
| Local Admin for early beta | READY | Owner can run Admin locally against the production HTTPS API if CORS allows the local origin. |
| Hosted Admin | NEEDS_CONFIGURATION | Later static hosting only needs `VITE_API_BASE_URL=https://api...`. |
| Admin secrets in frontend | READY | Vite only exposes API base URL; no backend secrets are expected in Admin build. |
| Token storage | READY | Admin access token is stored in memory plus `sessionStorage`, not long-lived `localStorage`. |

For early beta, local Admin is acceptable. For public operations, deploy Admin behind HTTPS and restrict operational access.

## Authentication And Admin Security

| Area | Status | Notes |
| --- | --- | --- |
| Password hashing | READY | bcrypt is used with 12 salt rounds. |
| JWT signing | READY | `JWT_SECRET` required outside tests (32+ chars, no placeholders); signing and verification pinned to HS256. |
| JWT expiration | READY | Default is `15m`; configurable. |
| Admin route protection | READY | Product and submission admin routes require `authenticate` plus admin role. |
| Login rate limit | READY | 10 attempts per 15 minutes. |
| Default admin credentials | NEEDS_CONFIGURATION | Seed only from env; use a strong one-time password and rotate after first login if needed. |
| Session revocation/refresh | OPTIONAL | Current JWT-only flow is acceptable for owner-only beta, but stronger session management is useful later. |

## Upload Security

| Area | Status | Notes |
| --- | --- | --- |
| File size limits | READY | 5 MB per image. |
| MIME allowlist | READY | Only JPEG, PNG and WebP are accepted, detected from the file bytes (the client MIME type is a coarse pre-filter; `application/octet-stream` is allowed for Flutter uploads). Other formats, including HEIC/HEIF and AVIF, are rejected with 415. |
| Content validation | READY | Images must decode successfully before use. |
| Normalization | READY | Images are rotated, resized, and converted to JPEG. |
| Upload rate limits | READY | Per client IP and 15 minutes: submissions 8, photo search 20, nutrition OCR 10, ingredients OCR 10 (separate counters). |
| Temporary files | READY | Upload normalization uses memory and controlled output paths. |

This is safe enough for beta, assuming persistent storage is solved.

## OCR Production Behavior

| Area | Status | Notes |
| --- | --- | --- |
| OCR engine | READY | Tesseract.js is used locally in the API process. |
| Timeout | READY | One shared OCR worker per process with a queue of 4: a job waits at most 10 seconds for the worker (then 503 "busy") and recognition is limited to 20 seconds (then 504). |
| Rate limit | READY | Per client IP and 15 minutes: photo search 20, nutrition OCR 10, ingredients OCR 10, each with its own counter and message. |
| Language data | NEEDS_CONFIGURATION | `eng.traineddata` and `rus.traineddata` are tracked in `backend/api`; start the backend from that directory so OCR does not download them on first use. |
| CPU/RAM | NEEDS_CONFIGURATION | Host must have enough RAM/CPU for OCR. Start small, monitor latency and memory. |
| Queue/worker | OPTIONAL | Not required for closed beta. Add a worker queue if OCR traffic grows. |

Synchronous OCR is acceptable for a small beta with rate limits and monitoring.

## Logging And Monitoring

| Area | Status | Notes |
| --- | --- | --- |
| Startup logs | READY | Startup emits structured JSON with service, port, `trustProxyHops` and `storageDriver`. |
| Request logs | READY | Method, URL, status, and duration are logged. |
| Error logs | READY | Unexpected errors are logged server-side as structured `unhandled_error` lines (no request bodies, headers or query strings); every environment returns a generic 500 without details. |
| Secret leakage | READY | Current request logs do not include headers, passwords, or tokens. |
| Monitoring | NEEDS_CONFIGURATION | Add host-level logs, uptime checks, and error/crash alerting before public beta. |

## Open Food Facts

| Area | Status | Notes |
| --- | --- | --- |
| Consumer runtime dependency | READY | Normal product search uses local DB, not OFF on every request. |
| Import source | READY | Importers use the official Open Food Facts API. |
| User-Agent | NEEDS_CONFIGURATION | Importers send a User-Agent, but production contact should be replaced with a real project contact. |
| External data verification | READY | OFF imports are marked as community/external, not verified. |
| Attribution | NEEDS_CONFIGURATION | Add final visible/documented Open Food Facts attribution before public release. |

## Legal And Privacy

| Area | Status | Notes |
| --- | --- | --- |
| Privacy Policy | NEEDS_CONFIGURATION | Draft exists in docs and app, but needs final legal review. |
| Terms of Use | NEEDS_CONFIGURATION | Draft exists in docs and app, but needs final legal review. |
| TazaScore disclaimer | READY | UI/docs describe informational scoring and avoid medical claims. |
| Upload explanation | NEEDS_CONFIGURATION | Draft explains uploaded submissions/photos; confirm wording before public release. |
| Data deletion | NEEDS_CONFIGURATION | Draft process exists; add a real contact channel before public release. |
| Russian/Kazakh localization | NEEDS_CONFIGURATION | Consumer localization exists; final legal text should be reviewed in both languages. |

This is not legal advice.

## Halal Check

| Area | Status | Notes |
| --- | --- | --- |
| Methodology | READY | `halal-check-v1.2` is documented separately from TazaScore. |
| Ingredient screening | READY | V1 uses explicit conservative ingredient rules and does not infer halal from missing risks. |
| Certification evidence | NEEDS_CONFIGURATION | Admin can enter, verify, expire, and clear product-specific certification records; trusted issuer policy still needs operational review. |
| Religious/legal review | NEEDS_CONFIGURATION | Final consumer wording should be reviewed before public release. |

See `docs/halal-check-methodology.md`.

### Admin Certification Workflow

Admin flow:

```text
find product
-> inspect ingredient screening
-> inspect certification evidence
-> enter certification data
-> explicitly verify
-> backend recalculates derived Halal Check result
```

Certification applies only to the current product record. It is not inherited by canonical family members, does not affect TazaScore, and does not overwrite ingredients. A certification conflict requires manual investigation.

## Performance

| Area | Status | Notes |
| --- | --- | --- |
| Barcode lookup | READY | Unique lookup is efficient. |
| Product list pagination | READY | Paginated endpoint exists. |
| Text search | NEEDS_CONFIGURATION | Current search is fine for small MVP data. Larger datasets need better indexing/search. |
| Image processing | READY | Sharp normalization is bounded by upload limits. |
| OCR | NEEDS_CONFIGURATION | Primary expected CPU bottleneck. Monitor before expanding beta. |
| Admin CRUD | READY | Low volume operational workflow. |

## Production Build Safety

| Area | Status | Notes |
| --- | --- | --- |
| Backend production env guard | READY | Required production envs are enforced at startup. |
| Backend stack traces to clients | READY | Unexpected error details are hidden in production. |
| Test endpoints | READY | No public test route found. |
| Seeded admin password | NEEDS_CONFIGURATION | Comes from env; the seed rejects placeholders and never resets an existing admin. Do not reuse development credentials. |
| Flutter dev URL fallback | READY | Production/release builds refuse local, loopback, emulator and non-HTTPS API URLs at startup (unless `TAZASCAN_DEMO_HTTP=true`); launch each release build once before distributing it. |
| Android debug signing fallback | READY | Removed: release builds require the real release key and fail clearly without it. |
| Admin localhost fallback | READY | Development fallback only; deployed Admin must set `VITE_API_BASE_URL`. |

## Recommended MVP Architecture

```text
Flutter Android app
        |
      HTTPS
        |
Node/Express API
        |
Managed PostgreSQL

Object/blob storage
   ^
   |
API image uploads

Admin:
local laptop for closed beta
later static HTTPS hosting
```

Required backend host capabilities:

- Node.js runtime.
- Environment variables.
- HTTPS through platform or reverse proxy.
- Outbound network for controlled OFF imports if run on the host.
- Enough RAM/CPU for Sharp and Tesseract OCR.
- Persistent logs.

Required database capabilities:

- Managed PostgreSQL.
- Migration deploy support.
- Automated backups.
- Restore procedure.

Required storage capabilities:

- Today: a persistent disk mounted at `UPLOAD_ROOT` (local storage driver), backed up with the database.
- Later (not implemented yet): durable object/blob storage, needed for hosts without persistent disks or for several backend instances.
- Delete support for submission/photo removal (implemented for local storage).

## Cost Tier Expectation

| Component | Tier |
| --- | --- |
| Backend host | Can start free or likely low-cost |
| PostgreSQL | Can start free for beta, paid eventually for backups/reliability |
| Object storage | Likely low-cost, required eventually |
| Admin static hosting | Can start free |
| Monitoring | Can start free, paid eventually |
| App stores/signing | Requires paid service/account eventually |

## Before Closed Beta

- [ ] Choose backend host with HTTPS and enough RAM for OCR.
- [ ] Create hosted PostgreSQL.
- [ ] Set backend production env variables.
- [ ] Run `npm run prisma:migrate:deploy`.
- [ ] Seed or create the admin account from production env.
- [ ] Set `TRUST_PROXY_HOPS` for the host (`1` behind one proxy) and the proxy body limit (`client_max_body_size 25m`).
- [ ] Mount a persistent disk at `UPLOAD_ROOT` and set `ALLOW_LOCAL_PRODUCTION_STORAGE=true`.
- [ ] Start the backend from `backend/api`.
- [ ] Run the production smoke test in `docs/deployment-backend.md` (`/health`, `/health/ready`, startup `trustProxyHops`, upload through the proxy, first OCR request, images survive a restart).
- [ ] Configure `CORS_ORIGIN` for the Admin origin used in beta.
- [ ] Solve durable image storage, or explicitly deploy on a host with persistent disk and backups.
- [ ] Configure mobile build with `--dart-define=API_BASE_URL=https://...`.
- [ ] Smoke-test barcode search, text search, photo search, OCR submission, Admin approval, and image display.
- [ ] Enable PostgreSQL backups.
- [ ] Confirm logs do not expose secrets.

## Before Public Beta

- [ ] Move uploads to object/blob storage through a storage adapter (needed for ephemeral hosts or several instances).
- [ ] Before running several backend instances, move rate limits to a shared store such as Redis.
- [ ] Add uptime/error monitoring and alerting.
- [ ] Replace OFF importer User-Agent contact with a real project contact.
- [ ] Add visible/documented Open Food Facts attribution.
- [ ] Finalize Privacy Policy, Terms, data deletion contact, and TazaScore disclaimer.
- [ ] Load-test OCR and image normalization enough for expected beta traffic.
- [ ] Review text search performance with real product count.
- [ ] Create a restore drill for PostgreSQL backups.
- [ ] Decide whether Admin remains local or is hosted.

## Before Store Release

- [ ] Decide final Android `applicationId`.
- [ ] Create the private upload keystore and `android/key.properties` on the build machine or CI secret store (never in git).
- [ ] Build release APK/AAB with `TAZASCAN_PRODUCTION=true` and the production HTTPS `API_BASE_URL`, then launch it once to confirm the API URL guard passes.
- [ ] Verify iOS bundle identifier, signing, and camera/photo permission wording.
- [ ] Complete Russian/Kazakh legal copy review.
- [ ] Verify all user-facing scoring and medical disclaimers in app stores.
- [ ] Verify privacy nutrition labels/store data safety forms.
- [ ] Run final backend, admin, and Flutter release checks.
