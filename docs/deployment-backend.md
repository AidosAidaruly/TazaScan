# Backend Deployment

Local PostgreSQL and `localhost` are for development only. Production requires hosted PostgreSQL, hosted backend runtime, HTTPS, persistent uploads, and strict environment variables.

## Required Environment

```text
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://admin.example.com,https://app.example.com
JWT_SECRET=long-random-secret
JWT_ACCESS_TOKEN_TTL=15m
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=strong-password
PUBLIC_UPLOADS_BASE_URL=https://api.example.com/uploads
```

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
