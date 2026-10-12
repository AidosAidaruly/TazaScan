# TazaScan

TazaScan is a food-product information application designed for consumers in Kazakhstan. It combines barcode scanning, text and photo-assisted search, nutrition and ingredient presentation, product submissions, and an explainable food-profile score in one mobile workflow. A separate web administration panel supports product curation, score previews, images, moderation, and halal certification evidence.

TazaScore is an informational food-profile score. It is not a medical diagnosis, an official Nutri-Score value, or a percentage of how "healthy" a product is.

## Project Status

TazaScan is a functional MVP and beta candidate under active development. The repository currently contains:

- a Flutter consumer application with Russian and Kazakh localization;
- a React administration panel;
- a Node.js/Express REST API backed by PostgreSQL and Prisma;
- tested legacy, standards-based Nutri-Score, TazaScore, and Halal Check calculation paths;
- controlled Open Food Facts import and data-quality tooling.

The core local workflows are implemented and automated tests pass in the latest completed repository audit. TazaScore v1.1, partial-data safeguards, Open Food Facts ingestion, OCR, and Halal Check are still beta features that require broader real-product and real-device validation. The project is not yet production-ready: hosting, durable object storage, monitoring, backup operations, store signing, and full end-to-end testing remain open.

## Core Features

### Consumer Mobile App

- Barcode scanning with product lookup and an unknown-barcode fallback.
- Debounced product search by name, brand, or barcode.
- OCR-assisted photo search against products already stored in the TazaScan database.
- Product details with nutrition, ingredients, TazaScore, confidence, data coverage, safeguards, and separate Nutri-Score information when available.
- Conservative Halal Check presentation that separates ingredient screening from verified certification evidence.
- Local favorites and scan history stored on the device.
- Unknown-product submission with front, ingredient, nutrition, and barcode images.
- OCR assistance for submitted nutrition and ingredient labels.
- Russian and Kazakh consumer UI.
- Responsive layouts for mobile and Windows development.

Photo search is an OCR-based convenience feature, not a general visual-recognition system. Favorites and history are currently local to each device rather than synchronized to a user account.

### Admin Panel

- Email/password login and protected routes.
- Role-protected product create, read, update, and delete operations.
- Product search and paginated listing.
- Nutrition, ingredient, provenance, and official Nutri-Score input editing.
- Read-only Official Nutri-Score and TazaScore previews from current form values.
- Partial-data TazaScore diagnostics, including confidence, coverage, missing critical fields, and applied safeguards.
- Product image upload and removal.
- Product-specific halal certification evidence management.
- Submission review, correction, rejection, and approval screens.

The panel is suitable for controlled, owner-operated beta data work. Its submission list/detail authentication path still needs an end-to-end correction and verification before moderation is treated as release-ready.

## How TazaScan Works

```text
scan, barcode lookup, or search
              |
              v
        Express REST API
              |
              v
      PostgreSQL product record
              |
              +--> nutrition and ingredient presentation
              +--> TazaScore calculation
              +--> Nutri-Score calculation when complete inputs exist
              +--> confidence, coverage, and safeguard metadata
              +--> Halal Check ingredient screening and certification state
              |
              v
       Flutter product result
```

Consumer lookup uses the local TazaScan database; it does not query Open Food Facts at runtime. TazaScore is calculated deterministically from stored product data when enough evidence exists. If some values are missing, the engine preserves them as unknown, calculates from the supported subset only when the minimum evidence threshold is met, and reports lower confidence and missing-data safeguards. If evidence is insufficient, the score is unavailable rather than replaced with a false zero.

When a barcode is unknown, the mobile app can open the submission flow. Submitted photos and OCR suggestions remain subject to admin review; OCR output is not treated as verified product data automatically.

## TazaScore

TazaScore v1.1 is TazaScan's versioned, deterministic 0-100 food-profile score. It is a consumer presentation layer built from nutrition evidence and a conservative ingredient component. It must be interpreted together with its confidence and data-coverage metadata.

### Components

| Component | Maximum | Current role |
| --- | ---: | --- |
| Nutritional quality | 90 | Dominant component, based on the separate Nutri-Score V2-2023 implementation when complete data is available, or a weighted partial-data path when it is not. |
| Ingredients/additives | 10 | Conservative component. An E-number or unknown additive alone does not create a penalty. |
| Data confidence | 0 | Metadata only; it never adds score points. |

Official Nutri-Score A-E remains a separate indicator. The repository's `OfficialNutriScoreEngine` targets the revised 2023 methodology, but the implementation is not presented as officially certified. Legacy persisted score fields also remain in the data model for compatibility; they are not the same as TazaScore.

### Partial Data

- Unknown nutrition values remain `null`; they are never silently converted to zero.
- Explicit `0` and explicit `false` remain valid known values.
- Complete official inputs use a grade-aware nutrition mapping.
- Partial inputs are normalized only across supported known components after a minimum evidence check.
- `nutritionCoverage` reports how much weighted nutrition evidence was available.
- Confidence is reported as `high`, `medium`, or `low` and is not part of the numeric score.
- Coverage and missing-critical-nutrient caps reduce the risk of an incomplete product appearing unrealistically strong.
- The result records used fields, missing fields, pre-safeguard score, score cap, safeguards, reasons, and methodology version.

### Methodological Limits

TazaScore has been exercised against synthetic and real-product validation sets, but it has not undergone independent scientific or clinical validation. Processing level/NOVA is not scored in v1.1, additive assessment is intentionally neutral without structured evidence, and external product records may omit important nutrition or ingredient fields. The score must therefore remain informational and transparent about uncertainty.

See [TazaScore v1.1 methodology](docs/taza-score-methodology.md), [Nutri-Score methodology foundation](docs/nutri-score-methodology.md), and the [validation report](docs/taza-score-validation-report.md).

## Architecture

```text
Flutter mobile app --------------------+
                                       |
React/Vite admin app ------------------+--> Express REST API
                                                |
                                      controllers / services
                                                |
                                           repositories
                                                |
                                           Prisma ORM
                                                |
                                           PostgreSQL

Controlled Open Food Facts import scripts --> ProductService --> PostgreSQL
Local image storage adapter <--------------- upload and OCR services
```

The backend separates HTTP routing, validation, controllers, services, repositories, scoring engines, importers, storage adapters, and data-quality evaluators. The mobile application separates core configuration/localization from feature-specific presentation, domain, and data layers. The admin application organizes authentication, products, and submissions as independent features over a shared API client.

TazaScore is computed by the backend and returned in product DTOs; it is not persisted over the legacy `calculatedScore` and `calculatedGrade` fields. Official Nutri-Score and Halal Check remain separate calculations.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Mobile | Flutter, Dart, Material, `http`, `mobile_scanner`, `image_picker`, `shared_preferences` |
| Admin | React 19, TypeScript, Vite, React Router |
| Backend | Node.js, TypeScript, Express 5 |
| Database | PostgreSQL |
| ORM and migrations | Prisma 7 |
| Validation | Zod |
| Authentication | bcrypt password hashing, JWT access tokens, role middleware |
| Images | Multer uploads, Sharp decoding/normalization, storage-provider abstraction |
| OCR | Tesseract.js |
| Backend tests | Vitest, Supertest |
| Frontend tests | Flutter Test, Vitest, React Testing Library |
| External product data | Official Open Food Facts API through controlled import scripts |

## Repository Structure

```text
apps/
  mobile/               Flutter consumer application
  admin/                React/Vite administration panel
backend/
  api/
    prisma/             PostgreSQL schema, migrations, and seed
    src/                API, services, repositories, scoring, importers, tests
docs/                   Methodology, validation, deployment, legal, and audit docs
README.md               Project overview and local setup
```

Generated clients, dependency directories, uploads, and build outputs are intentionally excluded from this overview.

## Database and Data Model

The main PostgreSQL model is `Product`, identified by a unique barcode. It contains product identity, source/provenance, data status, image URL, nullable nutrition values per 100 g or 100 ml, original and localized ingredient text, official Nutri-Score inputs, legacy score metadata, and verification timestamps.

Related models support:

- canonical product families for explicit duplicate/recipe grouping;
- product submissions and moderation state;
- product-specific halal certification evidence;
- users and roles for administration.

Nutrition values are nullable because labels and external sources are often incomplete. Unknown values are intentionally different from measured zero values. Canonical family links are created only through controlled review; similar names do not automatically prove identical recipes.

## Open Food Facts Integration

Open Food Facts is used as a controlled external data source for validation batches and repair scripts, not as a live consumer-search dependency.

The import flow:

1. fetches a requested barcode from the official Open Food Facts API;
2. maps only values present in the response;
3. preserves missing values as `null`;
4. marks imported records as community/external data with `source = "Open Food Facts"`;
5. derives an official scoring category only from compatible real category tags;
6. prefers suitable front-pack images and may reject an unsuitable community image;
7. skips an existing barcode instead of overwriting a verified/manual product;
8. runs normal TazaScan service/scoring behavior rather than importing an external score as TazaScore.

OFF nutrition, category, ingredient, translation, and image data are not automatically considered verified. Import and repair scripts are deliberately batch-oriented; there is no cron job or full-database synchronization.

## Data Quality and Safety

The project uses several explicit safeguards:

- Zod validation at API boundaries and typed DTOs between layers.
- Strict `null != 0` and unknown-boolean semantics.
- TazaScore minimum-evidence checks, coverage reporting, confidence metadata, and missing-critical-field caps.
- Separate provenance and verification status for manual, community, seed, and external records.
- Duplicate and canonical-family audit tooling rather than automatic recipe merging.
- Ingredient-language/source metadata and deterministic known-label mappings with original-text fallback.
- Conservative Halal Check rules that do not equate clean ingredient screening with certified halal status.
- Image decoding, size limits, normalization, and primary-image suitability checks for external/community images.
- No automatic replacement of verified/manual images or product data by OFF imports.

These controls reduce silent data corruption, but they do not replace human moderation or verification against physical packaging.

## API

The REST API currently provides:

- health and database-readiness checks;
- paginated product listing and text/barcode filters;
- product lookup by ID or barcode;
- product details with score and Halal Check results;
- OCR-assisted photo search;
- anonymous product submission and OCR-assistance endpoints;
- authenticated admin product CRUD, image handling, score previews, and halal certification management;
- authenticated submission review and approval endpoints;
- login and current-user endpoints.

There is currently no generated OpenAPI/Swagger specification.

## Authentication and Security

Admin passwords are hashed with bcrypt and login issues expiring JWT access tokens. Protected API routes use authentication and role authorization middleware. The API also uses Helmet, configured CORS, JSON size limits, upload validation, and dedicated rate limits for login, OCR, and public submissions.

Production startup rejects missing critical environment configuration. Further hardening is still required before public deployment, including HTTPS hosting, trusted-proxy configuration for the selected platform, durable secret management, token/session revocation strategy, monitoring, backups, and a full authorization-focused end-to-end review. Never commit `.env` files or real credentials.

## Testing

The latest completed project verification records:

| Area | Result |
| --- | --- |
| Backend | 29 test files, 275 tests passed; typecheck, lint, build, Prisma validation, and migration status passed |
| Admin | 8 test files, 45 tests passed; lint and build passed |
| Flutter | 128 tests passed; `flutter analyze` and debug APK build passed |

For this README update, the backend suite was run again and passed all 275 tests. The current machine did not have Admin dependencies installed, so its suite was not re-run. Flutter tooling stalled without output in the current Windows session; the table therefore reports the latest completed verification documented in [the MVP gap audit](docs/mvp-gap-audit.md), not a new run.

The repository does not claim a test-coverage percentage. Important remaining gaps are real-device camera/scanner/OCR testing, hosted API/database/storage integration, and a complete production-like end-to-end test of submission moderation.

## Running the Project Locally

### Prerequisites

- Git.
- A current Node.js/npm version compatible with the lockfiles.
- PostgreSQL.
- Flutter SDK and platform tooling.
- Android Studio/emulator or a physical Android device for camera and barcode testing.

### 1. Backend

```powershell
cd backend/api
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The API starts on `http://localhost:4000` by default. Verify it with:

```text
http://localhost:4000/health
http://localhost:4000/health/ready
```

The backend `.env.example` documents the supported configuration. At minimum, local development needs a valid PostgreSQL connection:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/tazascan?schema=public"
JWT_SECRET="<output of: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))">"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="replace-with-a-strong-local-password"
```

`JWT_SECRET` is required in every environment except tests (which use a fixed test-only secret). It must be at least 32 characters, must not be a placeholder or example value, and the API refuses to start otherwise.

Optional/local-storage settings such as `PORT`, `CORS_ORIGIN`, `STORAGE_DRIVER`, and `UPLOAD_ROOT` are also documented in that file. Do not reuse development values in production.

### 2. Admin Panel

In a second terminal:

```powershell
cd apps/admin
npm install
Copy-Item .env.example .env
npm run dev
```

`VITE_API_BASE_URL` defaults to `http://localhost:4000` in the example configuration. Open the URL printed by Vite, normally `http://localhost:5173`.

### 3. Flutter App

In a third terminal:

```powershell
cd apps/mobile
flutter pub get
flutter run -d windows --dart-define=API_BASE_URL=http://localhost:4000
```

For the Android emulator:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000
```

For a physical device, use the development machine's reachable LAN address and ensure the firewall allows the API port:

```powershell
flutter run --dart-define=API_BASE_URL=http://YOUR_LAN_IP:4000
```

Camera and barcode behavior should be tested on Android hardware or an emulator with camera support. Windows is useful for text search and file-based image workflows.

### Verification Commands

Backend:

```powershell
cd backend/api
npm test
npm run typecheck
npm run lint
npm run build
npx prisma migrate status
```

Admin:

```powershell
cd apps/admin
npm test
npm run lint
npm run build
```

Flutter:

```powershell
cd apps/mobile
flutter analyze
flutter test
flutter build apk --debug
```

## Demo Flow

For a stable university review, prefer the text-search path and keep barcode scanning as a device-dependent extension:

1. Start PostgreSQL and the backend; confirm `/health/ready`.
2. Start the Flutter app and search for an existing product by name or barcode.
3. Open Product Details and show nutrition, ingredients, TazaScore, confidence/coverage, Nutri-Score availability, and Halal Check separation.
4. Demonstrate favorites and history.
5. Open the Admin panel, sign in, locate the same product, and inspect its source and scoring inputs.
6. Change an unsaved nutrition input and use the Official Nutri-Score/TazaScore preview without persisting the preview result.
7. Optionally demonstrate a product image or certification edit using a safe test product.

For live fallback, use an existing seeded/local product and text search. Scanner, camera, OCR, and submission moderation depend on device support and should be smoke-tested on the exact demo hardware beforehand.

## Current Limitations

- The curated Kazakhstan-focused dataset is still small, and many community/OFF records are incomplete or low-confidence.
- TazaScore v1.1 is project-specific and not independently validated; it does not score processing level/NOVA.
- Official Nutri-Score may be unavailable when strict required fields are missing.
- Text search uses simple substring matching and needs stronger relevance/indexing at larger scale.
- Photo search uses OCR text extraction rather than general package-image recognition.
- The Admin submission list/detail authentication integration needs correction and full end-to-end verification.
- Submission approval and related state changes are not yet a single database transaction.
- File storage currently has a local provider; production object/blob storage is not implemented.
- There is no deployed production environment, operational monitoring, backup/restore proof, or CI pipeline in this repository.
- Android scanner, gallery, camera, OCR, and submission workflows still need final real-device testing; iOS has not been release-built in this environment.
- Android and iOS still use the placeholder native identifier `kz.project.project`; release signing and final store identifiers are not configured.
- Consumer RU/KK localization exists, but legal wording needs review and the Admin UI remains mostly English.
- Halal Check has limited real certification coverage and must not be interpreted as a religious ruling.

## Roadmap

Planned work includes:

- expand and manually verify the Kazakhstan product dataset;
- improve search ranking and database indexing;
- obtain external methodology review for TazaScore and continue real-product validation;
- fix and automate submission moderation end-to-end tests;
- add API/database integration and authorization tests;
- deploy the API behind HTTPS with managed PostgreSQL, backups, monitoring, and durable object storage;
- complete Android device QA, release signing, and store configuration;
- improve Russian/Kazakh copy and legal review;
- add visible Open Food Facts attribution and production data-governance procedures;
- validate the product with real users and university/startup reviewers.

These items are planned and are not represented as implemented features.

## Graduation / Research Context

TazaScan is being prepared as a candidate graduation/startup project within the Software Engineering program at Astana IT University. The repository is intended to demonstrate full-stack software engineering, data-quality controls, explainable scoring, mobile UX, and responsible communication of uncertain product data. This statement does not imply formal endorsement or approval by AITU.

## Disclaimer

TazaScore and all product insights are provided for informational purposes only. They are not medical advice, a diagnosis, or a substitute for a qualified professional. Nutrition, ingredient, image, and certification information may originate from product labels, community submissions, or external sources and can be incomplete; users should verify the current package and seek professional guidance where appropriate.

## Documentation

- [TazaScore v1.1 methodology](docs/taza-score-methodology.md)
- [TazaScore validation report](docs/taza-score-validation-report.md)
- [Nutri-Score methodology foundation](docs/nutri-score-methodology.md)
- [Halal Check v1.2 methodology](docs/halal-check-methodology.md)
- [Product data normalization](docs/product-data-normalization.md)
- [Unknown-barcode submission flow](docs/unknown-barcode-submission-flow.md)
- [Image storage](docs/image-storage.md)
- [Consumer localization policy](docs/consumer-localization-policy.md)
- [Production-readiness review](docs/production-readiness.md)
- [MVP gap audit](docs/mvp-gap-audit.md)
- [Privacy policy](docs/privacy-policy.md)
- [Terms of use](docs/terms-of-use.md)

## License

The backend package is currently marked `UNLICENSED`. No open-source license has been granted by this repository.
