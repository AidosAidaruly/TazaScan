# Admin Deployment

The admin panel is a Vite React app. It can be hosted as static files.

## Required Environment

```text
VITE_API_BASE_URL=https://api.example.com
```

Do not put backend secrets in Vite variables. They are bundled into browser code.

## Compatible Hosting Options

- Vercel
- Netlify
- Cloudflare Pages
- Static hosting from a VPS or object storage

Free tiers may have bandwidth/build limits.

## Deploy

```bash
cd apps/admin
npm install
npm run build
```

Upload the `dist` folder to the chosen static host.
