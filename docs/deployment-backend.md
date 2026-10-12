# Backend Deployment

Local PostgreSQL and `localhost` are for development only. Production requires hosted PostgreSQL, a hosted backend runtime, HTTPS, persistent uploads, and strict environment variables.

## Required Environment

Store these in the host's secret/environment settings. Never commit real values.

```text
NODE_ENV=production
PORT=4000                              # or the port the host provides
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://admin.example.com  # exact Admin origin(s), comma-separated; no "*"
JWT_SECRET=<at least 32 random characters, e.g. output of: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))">
JWT_ACCESS_TOKEN_TTL=15m
ADMIN_EMAIL=<real admin email>
# Placeholder rejected by the seed: replace with a unique 12+ character secret before deployment.
ADMIN_PASSWORD=change-this-admin-password
TRUST_PROXY_HOPS=1                     # see "Reverse proxy and rate limits"
STORAGE_DRIVER=local
ALLOW_LOCAL_PRODUCTION_STORAGE=true    # only when UPLOAD_ROOT is on a persistent disk
UPLOAD_ROOT=/var/lib/tazascan/uploads  # absolute path on the persistent disk
```

Startup refuses to run in production when `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL` or `CORS_ORIGIN` is missing, when `JWT_SECRET` is short or a known placeholder, when `CORS_ORIGIN` contains `*` or anything but exact origins, or when `STORAGE_DRIVER=local` is used without `ALLOW_LOCAL_PRODUCTION_STORAGE=true`. `STORAGE_DRIVER=s3` is reserved and not implemented.

The seed (`npm run prisma:seed`) refuses missing, blank, short (<12) or documented placeholder `ADMIN_PASSWORD` values. It only creates the admin if no account with `ADMIN_EMAIL` exists; it never changes an existing account's password, role or active status.

Mobile apps send no browser `Origin`, so `CORS_ORIGIN` only needs the Admin web origin(s). Image URLs are relative (`/uploads/products/...`, `/product-submissions/uploads/...`); clients resolve them against their API base URL, so no public uploads URL is configured.

## Working Directory

Start the backend from `backend/api` (`npm start` and `npm run dev` do this automatically). With a process manager (systemd, PM2) set the working directory explicitly, e.g. `WorkingDirectory=/srv/tazascan/backend/api`.

Three things are resolved relative to the working directory:

- `dotenv` loads `.env` from it (hosts that inject environment variables do not need the file).
- `UPLOAD_ROOT`, when relative (default `uploads`), is resolved against it. Use an absolute path in production.
- Tesseract OCR language data: `eng.traineddata` and `rus.traineddata` are tracked in `backend/api`, and tesseract.js loads them from the working directory. Started anywhere else, tesseract.js downloads the language data from the jsdelivr CDN on first OCR use (needs outbound HTTPS, makes the first OCR request slow, fails offline) and writes the files into that directory.

## Reverse Proxy

### Reverse proxy and rate limits

Login, OCR, and submission rate limits are keyed by client IP (`request.ip`). Set `TRUST_PROXY_HOPS` to the exact number of proxies between the client and the API. Express then reads the client IP from the right-most trusted `X-Forwarded-For` entries and ignores anything a client adds further left.

| Deployment | `TRUST_PROXY_HOPS` |
| --- | --- |
| Local development or direct exposure (no proxy) | `0` (default) |
| One reverse proxy or platform load balancer (single nginx, Render, Railway, Fly.io) | `1` |
| CDN in front of a reverse proxy (e.g. Cloudflare + nginx) | `2` |

- Too low: behind a proxy, all users share one rate-limit bucket (one busy user blocks everyone).
- Too high: clients can spoof their IP via `X-Forwarded-For` and bypass rate limits. Never use `true`.
- Check the `trustProxyHops` value in the `startup` log line after deploying.

### Request body size

The largest valid request is a product submission: up to 4 images of 5 MB each plus up to 30 small form fields, about 20.5 MB in total. Photo search, OCR and Admin image uploads carry one image (≤ 5 MB); JSON bodies are limited to 1 MB.

nginx's default `client_max_body_size` is `1m`, which would reject valid uploads with its own HTML 413 before Express sees them. Recommended nginx settings:

```nginx
client_max_body_size 25m;
proxy_read_timeout 60s;   # OCR: up to 10 s queue wait + 20 s recognition
proxy_set_header Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

## Uploads Storage

The only implemented storage driver is the local filesystem (`STORAGE_DRIVER=local`): product images under `<UPLOAD_ROOT>/products` and submission evidence under `<UPLOAD_ROOT>/submissions`. Both directories are created automatically at startup.

- Production must mount a persistent disk at `UPLOAD_ROOT` and set `ALLOW_LOCAL_PRODUCTION_STORAGE=true`.
- On an ephemeral filesystem (most free container tiers), every redeploy or restart deletes all product images and submission evidence while the database still references them: product images break and Admin shows evidence as unavailable.
- Back up the upload disk together with PostgreSQL.
- `backend/api/uploads/` is git-ignored; never commit runtime uploads.

## Rate Limits

All rate limits (login 10/15 min, submissions 8/15 min, photo search 20/15 min, nutrition OCR 10/15 min, ingredients OCR 10/15 min, per client IP) use express-rate-limit's in-memory store. This is suitable for **one backend instance**: counters reset on restart. With several instances each keeps its own counters (effective limits multiply), so a shared store such as Redis is needed before scaling out. The OCR worker pool is also per instance.

## Deploy Commands

```bash
cd backend/api
npm ci                                  # full install: Prisma CLI and TypeScript are devDependencies
npm run prisma:generate
npm run build
npm run prisma:migrate:deploy
npm run prisma:seed                     # creates the admin only if missing
npm start                               # node dist/server.js, from backend/api
```

Do not use `npm ci --omit=dev` on the build machine: generate, build and migrate need the dev dependencies.

## Production Smoke Test

- [ ] `GET https://<api>/health` returns `{"status":"ok",...}`.
- [ ] `GET https://<api>/health/ready` returns `{"status":"ready",...}` (process readiness only; it does not check the database).
- [ ] The `startup` log line shows the expected `trustProxyHops` and `storageDriver`.
- [ ] Upload a photo of about 4 MB through the proxy (photo search or a submission) and confirm it is not rejected with an nginx 413.
- [ ] Run the first OCR request after startup and confirm it completes in time (no CDN download, see Working Directory).
- [ ] Upload a product image, restart/redeploy the backend, and confirm the image and submission evidence are still served.
- [ ] Log in to Admin from the configured `CORS_ORIGIN`, open a submission, view its evidence, and approve/reject a test submission.

## Compatible Hosting Options

- VPS with a Node.js process manager and a persistent disk.
- Render, Railway, Fly.io, or similar Node.js hosts **with a persistent volume** mounted at `UPLOAD_ROOT`.
- Container hosting if Docker is added later (mount `UPLOAD_ROOT` as a volume).

Free tiers may sleep, throttle, or lack persistent storage. Do not rely on ephemeral disk for uploads.

## Production Notes

- Run Prisma migrations before serving traffic.
- Use HTTPS only; terminate TLS at the platform or reverse proxy.
- Store secrets in provider environment settings.
- Object storage is not implemented yet; it is needed before using hosts without persistent disks or running several instances.
- Keep `/health` and `/health/ready` available for monitoring.
