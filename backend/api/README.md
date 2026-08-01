# Project API

Backend API for Project.

## Environment

Copy `.env.example` to `.env` and set real local values:

```text
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/project?schema=public"
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

The future admin panel should store the access token in memory when possible and send it with protected requests:

```text
Authorization: Bearer ACCESS_TOKEN
```

Do not place tokens in URLs. Do not log tokens. Refresh tokens are intentionally not implemented yet.

## Nutrition Scoring

Scoring lives under `src/scoring`:

```text
contracts/  ScoreEngine interface
engines/    NutriScoreEngine and future TazaScoreEngine
rules/      point tables and grade helpers
utils/      validation and consistency checks
types/      ScoreInput and ScoreResult DTO types
```

`ProductService` depends on the `ScoreEngine` interface, not on a concrete scoring class. Today the app wires `NutriScoreEngine`; later we can replace it with `TazaScoreEngine` without changing controllers, routes, or repositories.

The current engine is a Nutri-Score nutritional foundation. It uses per-100 g/ml nutrition facts where available: energy, sugars, saturated fat, salt, protein, and fiber. The official Nutri-Score also considers encouraged food groups and, for updated beverage rules, sweeteners. Those fields are not fully modeled yet, so this version is intentionally marked as `nutri-score-foundation-2025-01`.

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
