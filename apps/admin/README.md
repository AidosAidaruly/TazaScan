# TazaScan Admin

Secure browser admin panel for managing TazaScan products.

## Environment

Create `.env` from `.env.example`:

```text
VITE_API_BASE_URL=http://localhost:4000
```

Do not put backend secrets in frontend environment variables. Vite variables are bundled into the browser.

## Run

Start the backend first:

```bash
cd backend/api
npm run dev
```

Start the admin panel:

```bash
cd apps/admin
npm install
npm run dev
```

Then open the Vite URL shown in the terminal.

## Authentication

The admin panel logs in through:

```text
POST /auth/login
```

It verifies the session through:

```text
GET /auth/me
```

Protected requests send:

```text
Authorization: Bearer ACCESS_TOKEN
```

The access token is kept in memory and mirrored to `sessionStorage` for page refreshes. Passwords are never stored.

## Product Management

The admin panel uses:

```text
GET /products
GET /products/:id
POST /products
PUT /products/:id
DELETE /products/:id
```

Unknown nutrition values are submitted as `null`, not `0`.
