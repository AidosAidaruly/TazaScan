# TazaScan API

Backend API for TazaScan.

## Environment

Copy `.env.example` to `.env` and set real local values:

```text
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/tazascan?schema=public"
JWT_SECRET="use-a-long-random-secret"
JWT_ACCESS_TOKEN_TTL="15m"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="use-a-strong-password"
```

In production, startup fails if `JWT_SECRET`, `ADMIN_EMAIL`, or `ADMIN_PASSWORD` are missing.

## Database

Generate Prisma client:

```bash
npm run prisma:generate
```

Run migrations:

```bash
npm run prisma:migrate
```

Seed the database:

```bash
npm run prisma:seed
```

The seed script creates or updates the admin account from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Authentication

Login:

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"use-a-strong-password\"}"
```

Current user:

```bash
curl http://localhost:4000/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Use the returned `accessToken` for protected admin requests.

## Protected Product Mutations

Public:

```text
GET /products
GET /products/:id
GET /products/barcode/:barcode
```

Admin only:

```text
POST /products
PUT /products/:id
DELETE /products/:id
```

Create product:

```bash
curl -X POST http://localhost:4000/products \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"barcode\":\"5449000000996\",\"name\":\"Coca-Cola Original Taste\",\"category\":\"Soft Drinks\",\"ingredients\":[\"Carbonated water\",\"Sugar\"],\"nutritionFacts\":{\"servingType\":\"per100ml\",\"energyKcal\":42,\"protein\":0,\"carbohydrates\":10.6,\"sugars\":10.6,\"fat\":0,\"saturatedFat\":0,\"fiber\":0,\"salt\":0}}"
```

Update product:

```bash
curl -X PUT http://localhost:4000/products/PRODUCT_ID \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Updated product name\"}"
```

Delete product:

```bash
curl -X DELETE http://localhost:4000/products/PRODUCT_ID \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## Admin Panel Notes

The existing Admin in `apps/admin` stores its access token in memory and `sessionStorage` and sends it with protected requests, including submission lists/details:

```text
Authorization: Bearer ACCESS_TOKEN
```

Do not place tokens in URLs. Do not log tokens. Refresh tokens are intentionally not implemented yet.

## Nutrition Scoring

Scoring lives under `src/scoring`:

```text
contracts/  ScoreEngine interface
engines/    NutriScoreEngine, OfficialNutriScoreEngine and TazaScoreEngine
rules/      point tables and grade helpers
utils/      validation and consistency checks
types/      ScoreInput and ScoreResult DTO types
```

`ProductService` uses the injected `NutriScoreEngine` to persist legacy compatibility fields on writes. Consumer DTOs and score previews separately calculate TazaScore v1.1 through `TazaScoreEngine` and `OfficialNutriScoreEngine`. TazaScore is already wired into the mobile product view; see `docs/taza-score-methodology.md`.

The legacy engine is marked `nutri-score-foundation-2025-01`. The current schema also models official category, fruit/vegetable/legume percentage and sweetener status for the official engine; individual products may still lack these inputs. Do not confuse legacy persisted scores with the consumer TazaScore.

Every calculation stores:

```text
calculatedScore
calculatedGrade
scoreStatus
scoreAlgorithm
scoreVersion
scoreCalculatedAt
scoreDetails
```

Manual override fields are kept separately and never delete calculated values:

```text
manualScoreOverride
manualOverrideReason
manualOverrideAt
```

Known limitations:

- Missing nutrition stays `null`; it is never converted to fake zero.
- If required nutrition is missing, `scoreStatus` becomes `insufficient_data`.
- Contradictions such as negative values, sugars greater than carbohydrates, saturated fat greater than fat, or sugar ingredients with 0 g sugars produce `requires_review`.
- This score is informational only and is not medical advice.

## Product Submissions

Users can submit products for moderation without registration:

```text
POST /product-submissions
```

The endpoint accepts `multipart/form-data` with optional product fields and package photos:

```text
frontImage
ingredientsImage
nutritionImage
barcodeImage
```

At least one identifying signal is required: barcode, product name, or front package image.

Admin-only moderation endpoints:

```text
GET /product-submissions
GET /product-submissions/:id
PUT /product-submissions/:id/status
POST /product-submissions/:id/approve
```

Lifecycle:

```text
pending -> approved
pending -> rejected
pending -> needs_correction
```

Approval creates a real `Product`, calculates nutrition score, links `createdProductId`, and marks the submission approved inside one database transaction. If product creation fails, the submission is not partially approved.

Local MVP image storage:

- files are saved under `uploads/submissions`
- filenames are generated UUIDs
- original filenames are never trusted
- only `jpeg`, `png`, and `webp` images are accepted
- executable files are rejected by MIME/type validation
- submission image URLs are served through admin-authenticated `/product-submissions/uploads/...` routes
- approved public product images should use `/uploads/products/...` or object storage URLs

Production should move uploads to object storage such as S3, Cloudflare R2, or Supabase Storage. At that point, keep the database fields as public object URLs or signed object references and add image metadata stripping/resizing in the upload pipeline.

Moderation security:

- public submissions are rate-limited
- user data is unverified until admin approval
- admins must validate product data before approval
- duplicate barcode approval returns `409`
- no user name, email, or phone is collected for this MVP
