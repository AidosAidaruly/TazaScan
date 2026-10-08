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

Main closed-beta blockers are production HTTPS configuration, hosted PostgreSQL with migrations, persistent upload storage, and a verified production mobile API URL.

## Runtime And Backend

| Area | Status | Notes |
| --- | --- | --- |
| Express startup | READY | `server.ts` creates the app and listens on `env.PORT`. |
| Host binding | READY | No host is passed to `listen`, so Node accepts host-platform binding behavior and works on typical managed hosts. |
| Production port | READY | `PORT` is parsed from environment and defaults to `4000` for local development. |
| Graceful shutdown | READY | `SIGINT` and `SIGTERM` close the HTTP server and disconnect Prisma. |
| Health checks | NEEDS_CONFIGURATION | `/health` and `/health/ready` exist. `/health/ready` is a basic process readiness check and does not currently verify database connectivity. |
| Request body limits | READY | JSON body limit is `1mb`; image upload limit is `5MB`. |
| Local path assumptions | BLOCKER | Product and submission uploads are stored under local `uploads/...`. This is not safe on ephemeral managed filesystems. |

The backend can run on a typical managed Node host if environment variables are set, migrations are deployed, and image storage persistence is handled.

## Environment Variables

| Variable | Required? | Secret? | Used by | Development value | Production requirement |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | No | No | Backend runtime | `development` | `production` |
| `PORT` | No | No | Backend HTTP server | `4000` | Host-provided port or explicit port |
| `DATABASE_URL` | Yes | Yes | Prisma/PostgreSQL | Local PostgreSQL URL | Managed PostgreSQL URL |
| `CORS_ORIGIN` | Production yes | No | Express CORS | Local admin origins | Exact Admin web origins, comma-separated |
| `JWT_SECRET` | Yes (except tests) | Yes | Admin JWT signing (HS256) | Local random secret, 32+ chars | Long random secret (32+ chars), no default; placeholders rejected |
| `JWT_ACCESS_TOKEN_TTL` | No | No | Admin JWT | `15m` | Short explicit TTL, for example `15m` |
| `ADMIN_EMAIL` | Production yes | Sensitive | Seeded admin account | Local email | Real admin email, not printed in logs |
| `ADMIN_PASSWORD` | Production yes | Yes | Seeded admin account | Local password | Strong one-time seed password, rotate if exposed |
| `PUBLIC_UPLOADS_BASE_URL` | Production yes | No | Product image URLs | Local API uploads URL | HTTPS base URL for durable upload serving |
| `VITE_API_BASE_URL` | Admin yes | No | Admin frontend | `http://localhost:4000` | Production HTTPS API URL |
| `API_BASE_URL` | Mobile release yes | No | Flutter app | Localhost or emulator URL | Production HTTPS API URL |
| `TAZASCAN_PRODUCTION` | Mobile release yes | No | Flutter production guard | false | `true` for release builds |

Production secret fallback check: backend refuses production startup without `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`, `CORS_ORIGIN`, and `PUBLIC_UPLOADS_BASE_URL`. That is READY.

JWT secret check: outside `NODE_ENV=test` the backend refuses to start (any environment) when `JWT_SECRET` is missing, shorter than 32 characters, a known placeholder/example value, or obviously non-random. There is no fallback secret; tests use a fixed test-only secret that is rejected elsewhere.

## PostgreSQL

| Area | Status | Notes |
| --- | --- | --- |
| Prisma provider | READY | PostgreSQL is configured through `DATABASE_URL`. |
| Migrations | READY | Product, auth, submissions, scoring, ingredients, and canonical family migrations are present. |
| Production migration command | READY | Use `npm run prisma:migrate:deploy`; this was added for production deploys. |
| Seed behavior | NEEDS_CONFIGURATION | Seed creates or updates an admin from env. Run intentionally, not automatically on every deploy unless desired. |
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
| Development CORS | READY | Empty `CORS_ORIGIN` allows convenient local development. |
| Production CORS | READY | Production startup requires non-empty `CORS_ORIGIN`. |
| Flutter native networking | READY | Native apps usually send no browser `Origin`; current CORS allows no-origin requests. |
| Admin web networking | NEEDS_CONFIGURATION | Add the exact Admin origin to `CORS_ORIGIN`. |
| HTTPS | NEEDS_CONFIGURATION | TLS should be terminated by hosting platform or reverse proxy, not custom Express TLS. |
| Trusted proxy | NEEDS_CODE_CHANGE | If deployed behind a proxy/load balancer, configure Express `trust proxy` intentionally so IP-based rate limits work correctly. |

No production mobile or admin build should use `http://`, `localhost`, LAN IPs, or emulator URLs.

## Flutter Production Configuration

| Area | Status | Notes |
| --- | --- | --- |
| API base URL | NEEDS_CODE_CHANGE | If `API_BASE_URL` is omitted, Flutter falls back to local dev URLs. This is fine for debug but risky for release. |
| Android INTERNET | READY | Present. |
| Android camera | READY | Present with `required=false`. |
| Cleartext traffic | READY | Main/release manifest disables cleartext traffic; debug overrides it for development. |
| App package id | NEEDS_CONFIGURATION | Current `applicationId` is `kz.project.project`; decide final ID before store release. |
| Release signing | BLOCKER | Release build falls back to debug signing if `key.properties` is missing. This must not be used for store release. |
| iOS permissions | NEEDS_CONFIGURATION | Camera/photo permission strings exist but are English; review for final Russian/Kazakh store wording. |
| Debug logs | READY | Network debug logs are guarded by Flutter debug mode. |

Recommended small future guard: fail release startup/build when `TAZASCAN_PRODUCTION=true` and `API_BASE_URL` is missing, non-HTTPS, localhost, emulator, or LAN.

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
| MIME allowlist | READY | JPEG, PNG, WebP, HEIC/HEIF, AVIF, and safe binary fallback are decoded by `sharp`. |
| Content validation | READY | Images must decode successfully before use. |
| Normalization | READY | Images are rotated, resized, and converted to JPEG. |
| Upload rate limits | READY | OCR and submissions have rate limits. |
| Temporary files | READY | Upload normalization uses memory and controlled output paths. |

This is safe enough for beta, assuming persistent storage is solved.

## OCR Production Behavior

| Area | Status | Notes |
| --- | --- | --- |
| OCR engine | READY | Tesseract.js is used locally in the API process. |
| Timeout | READY | OCR has a 20 second timeout. |
| Rate limit | READY | 20 OCR/photo requests per 15 minutes per detected client. |
| CPU/RAM | NEEDS_CONFIGURATION | Host must have enough RAM/CPU for OCR. Start small, monitor latency and memory. |
| Queue/worker | OPTIONAL | Not required for closed beta. Add a worker queue if OCR traffic grows. |

Synchronous OCR is acceptable for a small beta with rate limits and monitoring.

## Logging And Monitoring

| Area | Status | Notes |
| --- | --- | --- |
| Startup logs | READY | Startup emits structured JSON with service and port. |
| Request logs | READY | Method, URL, status, and duration are logged. |
| Error logs | READY | Unexpected errors are logged server-side; production hides stack details from clients. |
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
| Seeded admin password | NEEDS_CONFIGURATION | Comes from env. Do not reuse development credentials. |
| Flutter dev URL fallback | NEEDS_CODE_CHANGE | Add a production guard before store release. |
| Android debug signing fallback | BLOCKER | Must not be used for store release. |
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

- Durable object/blob storage.
- Public or signed HTTPS URLs usable by Flutter.
- Delete support for submission/photo removal.

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
- [ ] Confirm `/health` works on the public HTTPS API.
- [ ] Configure `CORS_ORIGIN` for the Admin origin used in beta.
- [ ] Solve durable image storage, or explicitly deploy on a host with persistent disk and backups.
- [ ] Configure mobile build with `--dart-define=API_BASE_URL=https://...`.
- [ ] Smoke-test barcode search, text search, photo search, OCR submission, Admin approval, and image display.
- [ ] Enable PostgreSQL backups.
- [ ] Confirm logs do not expose secrets.

## Before Public Beta

- [ ] Move uploads to object/blob storage through a storage adapter.
- [ ] Add or configure Express trusted proxy behavior for the selected host.
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
- [ ] Configure Android release signing with a real upload keystore.
- [ ] Remove debug-signing fallback for release builds or enforce CI/store build checks.
- [ ] Add Flutter production URL guard for `TAZASCAN_PRODUCTION=true`.
- [ ] Build release APK/AAB with production HTTPS API.
- [ ] Verify iOS bundle identifier, signing, and camera/photo permission wording.
- [ ] Complete Russian/Kazakh legal copy review.
- [ ] Verify all user-facing scoring and medical disclaimers in app stores.
- [ ] Verify privacy nutrition labels/store data safety forms.
- [ ] Run final backend, admin, and Flutter release checks.
