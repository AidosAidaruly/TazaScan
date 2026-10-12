# Backend Deployment

Local PostgreSQL and `localhost` are for development only. Production requires hosted PostgreSQL, hosted backend runtime, HTTPS, persistent uploads, and strict environment variables.

## Required Environment

```text
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://admin.example.com,https://app.example.com
JWT_SECRET=<at least 32 random characters, e.g. output of: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))">
JWT_ACCESS_TOKEN_TTL=15m
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=strong-password
TRUST_PROXY_HOPS=1
```

### Reverse proxy and rate limits

Login, OCR, and submission rate limits are keyed by client IP. Behind a reverse proxy or platform load balancer, set `TRUST_PROXY_HOPS` to the exact number of proxies between the client and the API (usually `1` on Render, Railway, Fly.io, or a single nginx). Express then reads the client IP from the right-most trusted `X-Forwarded-For` entries and ignores anything a client adds further left.

- `0` (default): `X-Forwarded-For` is ignored. Correct for local development and direct exposure; behind a proxy, all users would share one rate-limit bucket.
- Too high: clients could spoof their IP via `X-Forwarded-For`. Never use `true`.
- Check the `trustProxyHops` value in the startup log after deploying.

## Compatible Hosting Options

- Render, Railway, Fly.io, or similar Node.js hosts.
- VPS with Node.js process manager.
- Container hosting if Docker is added later.

Free tiers may sleep, throttle, or limit persistent storage. Do not rely on ephemeral disk for product images in production.

## Production Notes

- Run Prisma migrations before serving traffic.
- Use HTTPS only.
- Store secrets in provider environment settings.
- Move uploads to object storage when traffic grows.
- Keep `/health` and `/health/ready` available for monitoring.
