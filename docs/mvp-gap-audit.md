# TazaScan MVP Gap Audit

Current-state note (2026-09-18): this is a historical audit, not the latest demo checklist. All 10 local migrations are now applied. Admin submission authentication, atomic approval and search relevance have been addressed; Flutter tooling requires the Windows path workaround documented in [AITU demo verification](aitu-demo-readiness.md). The original findings below are retained for context.

Date: 2026-08-28

Scope: audit only. This document reflects the current repository and local
database state inspected during the audit. No product/scoring/backend/mobile
behavior was changed.

## Executive Decision

Final recommendation: `FREEZE_FEATURES_AND_FIX_GAPS`

TazaScan is no longer a raw student-style prototype. Backend, Admin, product
search, product details, TazaScore, Halal Check, submission/OCR paths, imports,
image normalization, and release documentation all exist. The project is close
to a closed beta setup, but it is not ready for public beta or store release.

The main blockers are operational and verification gaps:

- Flutter tooling hangs on this Windows/OneDrive environment, so mobile checks
  cannot currently be trusted.
- Local database is missing the latest halal certification migration.
- Production API/storage/database/backup/HTTPS setup is not yet done.
- Object storage provider is not implemented; local storage is safe only with a
  persistent disk.
- Android release signing still falls back to debug signing.
- Data set is small: 29 local products, 25 TazaScore-calculable, only 2 high
  confidence, 7 Halal Check `insufficient_data`.

## Readiness Scores

| Area | Score | Reason |
| --- | ---: | --- |
| Consumer feature completeness | 78% | Main flows exist, but scanner/photo/OCR need device QA and Flutter tooling is blocked. |
| Backend completeness | 86% | Tests/typecheck/lint/build pass; main API and safety guards exist. |
| Admin completeness | 78% | CRUD, score preview, submissions, halal certification exist; UI is internal-English and needs workflow QA. |
| Data readiness | 48% | Useful validation set exists but is too small and mostly low/medium confidence. |
| Infrastructure readiness | 42% | Local dev works; hosted API/DB/storage/backups/monitoring are not set up. |
| Security/privacy readiness | 62% | Basic auth, JWT, rate limits, upload validation exist; legal/contact/monitoring remain. |
| Android release readiness | 38% | Config exists; signing, API guard, device QA and AAB validation remain. |
| Closed beta overall | 64% | Possible after fixing Flutter toolchain and applying migrations, with local/persistent infra. |
| Public beta overall | 50% | Needs hosted durable infra, stronger monitoring, attribution/legal review, larger data. |
| Store release overall | 35% | Needs signing, production config guard, legal/store forms, final QA, and iOS/Android release work. |

## Verification Performed

Backend:

- `npm test`: passed, 29 test files, 275 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx prisma validate`: passed.
- `npx prisma migrate status`: failed because
  `20260822173500_add_halal_certifications` is not applied in local DB.

Admin:

- `npm test`: passed, 8 test files, 45 tests.
- `npm run lint`: passed.
- `npm run build`: passed.

Flutter:

- `flutter doctor -v`: hung with no output for 60 seconds, then stopped.
- `dart --version`: hung with no output for 30 seconds, then stopped.
- `flutter --version`: hung with no output for 30 seconds, then stopped.
- `flutter test`: hung with no output for 30 seconds, then stopped.
- `flutter analyze`: hung with no output for 30 seconds, then stopped.
- `flutter build apk --debug`: hung with no output for 30 seconds, then stopped.

Repository:

- `git status --short` before this document showed existing pending changes in
  backend missing-ingredients backfill files and docs.

## Local Data Snapshot

From the local PostgreSQL database:

- total products: 29
- products with at least one nutrition value: 26
- products with ingredient data/text: 22
- products with imageUrl: 25
- data status: 24 `community`, 5 `verified`
- source: 24 `Open Food Facts`, 1 `seed`, 4 physical/product-label variants
- products missing `officialNutriScoreCategory`: 4
- TazaScore calculated: 25
- TazaScore insufficient data: 4
- confidence: 2 high, 10 medium, 17 low
- Halal Check without certification table: 22 `screening_clear`, 7
  `insufficient_data`

Important local DB issue: the code has a halal certification model and routes,
but the inspected local database has not applied the halal certification
migration. Repository code falls back for some product reads, but admin
certification management cannot be considered locally verified until migration
is applied.

## Consumer App Audit

### Home

Labels: `DONE`, `PARTIALLY_DONE`

Home uses the approved premium dark layout and routes to scanner, photo search,
product search, history, favorites, and profile. The floating navigation exists.
The root app now uses `MaterialApp` with Material/Cupertino/Widgets localization
delegates, so the earlier `No MaterialLocalizations found` bug is fixed in code.

Remaining risks: mobile rendering could not be re-verified because Flutter
tooling hangs.

### Barcode Scanner

Labels: `PARTIALLY_DONE`, `UNTESTED`

Scanner uses `mobile_scanner`, limits formats to EAN/UPC, prevents duplicate
processing with `_isProcessing`, validates GS1 check digits, handles not found,
network, timeout, and server errors, and routes unknown barcodes to the
submission flow.

Remaining risks: Android camera permission/device behavior is not manually
verified in this audit. Windows cannot validate the real scanner path.

### Product Search

Labels: `DONE`, `UNTESTED`

Search screen supports debounce, min length, cancellation by generation counter,
loading indicator inside the field, empty state, retry, product cards, product
details navigation, and submission link on no results. Backend `GET /products`
supports `q`, `name`, `brand`, and `barcode`.

Remaining risks: no cursor/next-page UI in Flutter search despite paginated API;
acceptable for MVP data size, but not complete for larger catalog.

### Photo Search

Labels: `PARTIALLY_DONE`, `UNTESTED`, `OPTIONAL_POST_BETA`

Photo search supports camera on mobile, gallery/file picker on desktop,
uploading to `/products/photo-search`, errors, no-match fallback, and product
details navigation.

Quality limitation: backend OCR chooses a probable product-name line and then
searches name/brand. This is technically usable for small beta tests, but not a
robust computer-vision product matcher. Also, `PhotoSearchService` maps matches
with `toProductDto(product)` without passing a calculated TazaScore result, so
photo-search result DTOs may lack the same TazaScore richness as normal product
list/details responses.

### Product Details

Labels: `DONE`, `PARTIALLY_DONE`

The screen has image/name/brand, TazaScore consumer presentation, nutrition,
ingredients, Halal Check, certification semantics, source/data reliability,
favorites, technical details, and Russian/Kazakh localization support.

Legacy score remains available as fallback/default where the feature flag or
data path requires it. Normal search/history/favorites tests expect TazaScore
labels, so consumer UI has mostly moved to the new score.

Remaining risks: device overflow/long-text QA could not be re-run because the
Flutter toolchain hangs.

### Favorites

Labels: `DONE`, `PARTIALLY_DONE`

Favorites persist locally via `shared_preferences`, support add/remove, empty
state, cached product cards, and details navigation.

Known limitation: cached summaries can become stale when backend score/image
data changes. This is acceptable for closed beta but should be refreshed before
public beta if users rely on favorites.

### History

Labels: `DONE`, `PARTIALLY_DONE`

History persists locally, stores scanned/viewed product summaries, renders
TazaScore summary labels, supports empty state and navigation.

Known limitation: history entries are cached snapshots and can show stale
product score/image/category until reopened/refreshed.

### Unknown Barcode Submission

Labels: `PARTIALLY_DONE`, `UNTESTED`

Consumer submission flow exists with barcode prefill, image fields, OCR-assisted
nutrition/ingredient extraction, user edit protection, validation, submit, and
success state. Backend requires front photo for barcode submissions and prevents
duplicate pending/product barcode submissions.

Gap: mobile image picking for submission currently uses `ImageSource.camera` in
the shared `_pickImage` helper. That is good for phone capture but weak for
desktop testing and may not allow gallery/file selection for every submission
photo.

## OCR Audit

Labels: `PARTIALLY_DONE`, `UNTESTED`

OCR exists using Tesseract.js. Nutrition parser handles per-100g/per-100ml
detection, decimal commas, kcal and kJ-to-kcal conversion, RU/KZ/EN field
aliases, missing values as null, and explicit zero as zero. Ingredients parser
extracts text after common markers and detects RU/KZ/EN language.

Beta realism: usable as an assisted draft feature, not reliable enough to be
fully trusted without user/admin review. The parser intentionally refuses
serving-only or unknown-basis nutrition. Synchronous OCR may be CPU-heavy and
requires host monitoring.

## TazaScore Audit

Labels: `DONE`, `PARTIALLY_DONE`

Current backend has TazaScore v1.1 style partial-data behavior, confidence
metadata, coverage, missing critical fields, score caps/safeguards, beverage
specific metadata caps, canonical family resolution, and tests.

Important: production legacy `calculatedScore`/`calculatedGrade` still exists in
Prisma and is not overwritten by TazaScore. Consumer DTO includes `tazaScore`.

Readiness: good enough for beta UI with disclosure and confidence, but not
official health certification. Only 2/29 local products have high confidence.

## Halal Check Audit

Labels: `PARTIALLY_DONE`, `BLOCKER_PUBLIC_BETA`

Halal Check v1.2 exists with separate ingredient screening and certification
status. It does not equate `screening_clear` with certified halal. Admin
certification management exists in code.

Local data limitation: certification table is not applied in local DB, so the
audit ran ingredient-only. Current data gives 22 `screening_clear`, 7
`insufficient_data`, 0 confirmed halal certifications. This is useful as a
composition screen, but not yet strong enough to market as halal certification.

Required disclosure: `screening_clear != certified halal`; certification must be
shown separately.

## Product Data Audit

Labels: `PARTIALLY_DONE`, `BLOCKER_PUBLIC_BETA`

The local dataset is sufficient for development and demo validation, not enough
for public beta discovery. OFF importers, repair scripts, duplicate audits,
family audits, image audits, ingredient translation fallback, and validation
docs exist.

Current duplicate/family audit finds one Coca-Cola-like group. Family audit
recommends manual review for three Coca-Cola rows. This is expected and not a
closed-beta blocker, but it should be resolved before wider beta so scores and
search results do not feel inconsistent.

## Admin Audit

Labels: `DONE`, `PARTIALLY_DONE`

Admin supports login, protected routes, product list/create/edit/details,
image upload/remove, official Nutri-Score preview, TazaScore preview with
partial-data metadata, submissions list/details/review/approve/reject, and halal
certification management.

Gaps:

- Admin UI text remains mostly English; acceptable for one-person operations.
- No refresh token/session revocation.
- Destructive actions are present; product delete exists and should be used
  carefully.
- Local halal certification workflow cannot be verified until DB migration is
  applied.

Admin is functional enough for one-person closed beta operations after local DB
migrations and production API configuration are correct.

## Submission End-To-End Audit

Labels: `PARTIALLY_DONE`, `UNTESTED`

Backend path exists:

`unknown barcode -> submission -> photos persist -> OCR data preserved -> admin review -> edit -> approve -> ProductService.create -> product returned by barcode -> TazaScore/Halal Check in DTO`

Known gap: approval creates Product through legacy scoring flow and then DTO
calculates TazaScore dynamically. That is intentional today, but it means
persisted `calculatedScore` remains legacy while consumer `tazaScore` is dynamic.

Risk: submission image lifecycle/deletion after approval is not fully audited for
orphan cleanup.

## Image Pipeline Audit

Labels: `DONE`, `PARTIALLY_DONE`

Backend upload middleware accepts JPEG, PNG, WebP, HEIC/HEIF, AVIF, and generic
binary fallback for decoder validation. Sharp normalizes images, rotates/resizes
and converts to JPEG. Storage abstraction exists with local provider. Product
image evaluator selects primary image and can reject unsuitable external images.

Current product image audit: 24 OFF images audited, 24 usable as primary, 0
fallback recommended.

Storage status:

- safe local development: yes
- safe closed beta with persistent disk: yes, if disk is truly persistent
- object storage readiness: abstraction exists, S3 driver intentionally not
  implemented

Gaps: product static serving still uses local file storage path; object storage
provider must be added before ephemeral hosting.

## Flutter Toolchain Diagnosis

Labels: `PARTIALLY_DONE`, `NEEDS_FIX_BEFORE_CLOSED_BETA`

Follow-up diagnosis on 2026-08-28:

- `where flutter` resolves to `C:\src\flutter\bin\flutter` and
  `C:\src\flutter\bin\flutter.bat`.
- `where dart` resolves to `C:\src\flutter\bin\dart` and
  `C:\src\flutter\bin\dart.bat`.
- PATH also contains an older/missing Flutter entry under
  `C:\Users\aidos\OneDrive\Рабочий стол\Cross-Platform\flutter\bin`; that path
  currently does not contain `flutter.bat`, while `C:\src\flutter\bin` is the
  active SDK.
- Flutter SDK is not inside OneDrive: active SDK is `C:\src\flutter`.
- The repository is inside OneDrive and contains Cyrillic path segments:
  `C:\Users\aidos\OneDrive\Рабочий стол\Startap_Project`.
- Several stale Flutter/Dart processes from `C:\src\flutter\bin\cache` were
  running and were terminated.
- Stale zero-byte lock files `C:\src\flutter\bin\cache\lockfile` and
  `C:\src\flutter\bin\cache\flutter.bat.lock` were removed after confirming no
  Flutter/Dart process was running.

Strongest diagnosis:

- The silent hang in this Codex session was caused by Flutter CLI needing
  read/write access to `C:\src\flutter\bin\cache` outside the normal workspace
  sandbox. Running Flutter with elevated filesystem access made the CLI work
  immediately.
- The original OneDrive/Cyrillic repository path is still risky: in that path,
  `flutter analyze` no longer hangs, but the analysis server crashes with
  `FormatException: Unterminated string` while reading an LSP message that
  includes the project path. The copied path `C:\dev\TazaScan` does not show
  that analyzer crash.

Verification after repair:

| Command | Location | Result |
| --- | --- | --- |
| `flutter --version` | `C:\` | PASSED: Flutter 3.44.8, Dart 3.12.2 |
| `dart --version` | `C:\` | PASSED: Dart 3.12.2 |
| `flutter doctor -v` | `C:\` | PASSED, no issues found |
| `flutter --version` | `C:\dev\TazaScan` | PASSED |
| `flutter doctor -v` | `C:\dev\TazaScan` | PASSED, no issues found |
| `flutter clean` | `C:\dev\TazaScan\apps\mobile` | PASSED |
| `flutter pub get` | `C:\dev\TazaScan\apps\mobile` | PASSED |
| `flutter analyze` | `C:\dev\TazaScan\apps\mobile` | FAILED_WITH_REAL_ERROR: 11 `use_build_context_synchronously` info-level issues |
| `flutter test` | `C:\dev\TazaScan\apps\mobile` | FAILED_WITH_REAL_ERROR: 113 passed, 15 failed |
| `flutter build apk --debug` | `C:\dev\TazaScan\apps\mobile` | PASSED |
| `flutter pub get` | original OneDrive repo | PASSED |
| `flutter analyze` | original OneDrive repo | FAILED_WITH_REAL_ERROR: analysis server LSP JSON parse crash |
| `flutter test` | original OneDrive repo | FAILED_WITH_REAL_ERROR: 113 passed, 15 failed |

Generated debug APK in the safe copy:

`C:\dev\TazaScan\apps\mobile\build\app\outputs\flutter-apk\app-debug.apk`

Current recommendation:

Use `C:\dev\TazaScan` for Flutter development and testing. The Flutter SDK at
`C:\src\flutter` is valid. Clean the obsolete PATH entry pointing to the old
OneDrive Flutter folder manually later; do not change PATH blindly from project
scripts. The toolchain is no longer silently hanging, but mobile checks are not
green because real analyzer/test failures remain.

## Android Audit

Labels: `PARTIALLY_DONE`, `BLOCKER_STORE_RELEASE`

Current:

- applicationId/namespace: `kz.project.project`
- app label: `TazaScan`
- version: `1.0.0+1`
- INTERNET permission: present
- CAMERA permission: present, hardware camera not required
- release cleartext traffic disabled; debug can use local HTTP
- release signing falls back to debug signing when `key.properties` is missing

Blockers:

- final package id decision before store release
- release upload keystore
- remove/guard debug signing fallback for store builds
- production HTTPS `API_BASE_URL` guard
- actual Android device camera/gallery/OCR smoke test

## iOS Audit

Labels: `PARTIALLY_DONE`, `OPTIONAL_POST_BETA`, `BLOCKER_STORE_RELEASE`

iOS project exists. Camera/photo permission strings exist but are English.
Windows-only development cannot build or sign iOS. iOS is not a blocker if the
first closed beta target is Android/Windows dev, but it is a store-release
blocker for iPhone.

Required later: Apple Developer account, macOS/Xcode, bundle id, signing,
localized permission strings, App Store privacy forms.

## Production Backend Audit

Labels: `PARTIALLY_DONE`, `BLOCKER_PUBLIC_BETA`

Strengths:

- Express app uses Helmet, CORS, JSON limit, request logging and error handler.
- production env guard requires key secrets/config.
- graceful shutdown exists.
- `/health` routes exist.
- upload/image limits exist.

Gaps:

- no explicit `trust proxy`, so IP rate limits may be wrong behind proxy.
- readiness health does not verify DB connectivity.
- no monitoring/alerts configured.
- object storage not implemented.
- production host/HTTPS/database/backups not configured in repo state.

## Database Audit

Labels: `PARTIALLY_DONE`, `BLOCKER_CLOSED_BETA`

Prisma schema validates and migrations exist. Barcode is unique and indexed.
Canonical families, halal certifications, submissions, ingredient translation
fields, official Nutri-Score inputs and scoring fields exist in schema.

Local database migration status is not clean:

- pending migration: `20260822173500_add_halal_certifications`

This must be applied before closed beta testing of halal certification/admin
flows.

## Storage Audit

Labels: `PARTIALLY_DONE`, `BLOCKER_PUBLIC_BETA`

Storage abstraction exists and local provider is tested. Persistent file
operations are mostly routed through `LocalFileStorage`. Approved local usage
still includes `fs.writeFile`, `fs.rename`, `fs.rm` inside the local provider
and `sendFile` for authenticated submission image serving.

Gap: `STORAGE_DRIVER=s3` intentionally throws because the provider is reserved
for future implementation. Public beta on ephemeral hosts needs object storage.

## Security Audit

Labels: `PARTIALLY_DONE`

Good MVP controls:

- admin auth with bcrypt
- JWT expiration
- admin role middleware
- login rate limit
- OCR/submission rate limits
- upload size limits and decode validation
- UUID filenames and path traversal checks
- Prisma for DB queries
- production error handler hides stack traces

Remaining risks:

- no session revocation/refresh
- proxy IP handling not configured
- no production monitoring/alerting
- no `npm audit --omit=dev` result captured in this audit
- delete endpoints exist and should be operationally protected

## Privacy And Legal Audit

Labels: `PARTIALLY_DONE`, `BLOCKER_STORE_RELEASE`

Docs/app include privacy policy, terms, data deletion draft, scoring disclaimers,
and Halal Check methodology/disclosure direction. These are not final legal
documents.

Closed beta: acceptable with controlled testers and clear disclosure.
Public beta: needs final contact/delete-data channel and OFF attribution.
Store release: needs legal review, privacy forms, localized permission text,
medical/non-medical scoring language, and photo upload disclosure.

## UX Consistency Audit

Labels: `PARTIALLY_DONE`

Consumer UI is mostly Russian/Kazakh through `TazaLocalizations` and presentation
mapping layers. Product Details and Halal Check have specific tests for raw enum
avoidance.

Remaining concrete leftovers:

- `About` still shows `Version 1.0.0 (Beta)` in English/Russian mixed wording.
- Admin product/submission UI is mostly English.
- Some technical strings intentionally remain in debug/admin preview.
- Flutter tests could not be rerun, so overflow/localization regressions are not
  ruled out.

## Dead Code / Cleanup Candidates

Labels: `OPTIONAL_POST_BETA`

- legacy scoring engine and persisted `calculatedScore` remain by design, but
  should be clearly named as legacy after production TazaScore switch.
- beta flags and `TazaScoreBetaCard` naming may become stale if TazaScore is now
  consumer-primary.
- photo-search result path may need a single DTO enrichment path to avoid
  missing TazaScore.
- historical docs should be cross-linked to the current readiness source.

Do not delete these before beta unless they actively confuse production UI.

## Performance Audit

| Area | Status | Notes |
| --- | --- | --- |
| Barcode lookup | acceptable_beta | Unique lookup is efficient. |
| Text search | acceptable_beta | `contains` search is fine for 29 products; needs indexing later. |
| Photo search OCR | needs_monitoring | Synchronous Tesseract is CPU-heavy and quality is weak. |
| Image normalization | acceptable_beta | Sharp bounded by 5 MB limits. |
| Admin queries | acceptable_beta | Low-volume one-person operations. |
| Startup | needs_monitoring | Backend starts/builds; Flutter tool startup hangs locally. |

## Reliability / Failure Recovery

Labels: `PARTIALLY_DONE`

Handled:

- product search network/timeout/server/empty states
- scanner not found/network/timeout/server states
- photo search upload/network/timeout/no-match states
- duplicate barcode and duplicate pending submission protections
- invalid upload handling

Gaps:

- DB unavailable behavior depends on generic error handling and host restart.
- OFF unavailable affects import/repair scripts, not normal runtime.
- OCR failure degrades to error state, but no async retry queue.
- submission image orphan cleanup is not fully verified.
- local cached favorites/history can become stale.

## Classification Summary

### DONE

- Backend tests/typecheck/lint/build.
- Express API basics, products, search, barcode lookup.
- Product Search UI behavior in code/tests.
- Product Details sections and TazaScore/Halal presentation in code.
- Admin auth/Product CRUD/submission review/score previews in code.
- TazaScore partial-data backend and tests.
- Halal Check v1.2 engine and tests.
- OFF import/repair/audit scripts.
- Image upload normalization and local storage abstraction.
- Privacy/terms/data-deletion drafts.

### PARTIALLY_DONE

- Scanner: code exists, device QA missing.
- Photo Search: implemented but algorithm quality is MVP-basic.
- OCR: assisted extraction exists, not production-grade automation.
- Dataset: enough for dev, not public beta.
- Admin: functional but local DB migration not applied and UI is internal.
- Storage: abstraction exists, object provider not implemented.
- Android/iOS release config: skeleton exists, release work remains.

### BROKEN

- Flutter/Dart toolchain hangs before producing output in this environment.
- Local DB is missing the halal certification migration.

### UNTESTED

- Mobile checks in this audit due Flutter toolchain hang.
- Android physical camera/gallery/scanner/OCR flow.
- Release APK/AAB.
- iOS build/signing.
- Production deployment smoke test.

## Beta And Release Blockers

### MUST BEFORE CLOSED BETA

1. Fix Flutter/Dart toolchain hang and run `flutter test`, `flutter analyze`,
   and debug APK build.
2. Apply pending Prisma migration locally and in any beta database.
3. Configure one real backend URL reachable from test devices.
4. Run smoke test: search, barcode scan, photo search, unknown barcode
   submission, admin approval, product details.
5. Confirm persistent storage strategy for beta uploads.

### SHOULD BEFORE PUBLIC BETA

1. Deploy backend behind HTTPS with managed PostgreSQL.
2. Enable database backups.
3. Add object/blob storage provider or guaranteed persistent disk with backup.
4. Configure `trust proxy` for the selected host.
5. Add uptime/error monitoring.
6. Add visible Open Food Facts attribution.
7. Grow and clean the product dataset.
8. Resolve canonical family duplicates that affect search confidence.
9. Improve Photo Search quality expectations/disclosure.
10. Finalize public privacy/delete-data contact.

### MUST BEFORE STORE RELEASE

1. Android release signing with real upload keystore.
2. Remove debug-signing fallback or enforce release guard.
3. Add Flutter production API URL guard for HTTPS/non-local URL.
4. Decide final Android applicationId and iOS bundle id.
5. Build and test release AAB/APK.
6. iOS build/signing on macOS/Xcode if iPhone release is planned.
7. Final legal/privacy/terms review in RU/KZ.
8. Store privacy/data safety forms.
9. Final app icon/splash/brand review.
10. Production monitoring, backup restore plan, and incident procedure.

### OPTIONAL POST-BETA

- Full-text/trigram product search.
- OCR worker queue.
- Refresh strategy for cached history/favorites.
- Hosted Admin polish/localization.
- Session refresh/revocation.
- Object storage delete/orphan cleanup dashboards.
- More advanced image quality scoring.

## Top 10 Next Tasks

1. Task: Fix Flutter toolchain hang.
   Why: no mobile code can be trusted until tests/analyze/build run.
   Estimated complexity: M.
   Blocks: closed beta.

2. Task: Apply pending Prisma migration and re-run halal/admin certification QA.
   Why: local DB lacks `product_halal_certifications`.
   Estimated complexity: XS.
   Blocks: closed beta.

3. Task: Run full device smoke test on Android with local backend.
   Why: scanner/camera/gallery/OCR cannot be proven by unit tests alone.
   Estimated complexity: S.
   Blocks: closed beta.

4. Task: Configure beta backend URL and Flutter `API_BASE_URL`.
   Why: recurring "network unavailable" UX usually means app cannot reach API.
   Estimated complexity: S.
   Blocks: closed beta.

5. Task: Decide beta upload storage strategy.
   Why: user submissions/photos must survive deploy restarts.
   Estimated complexity: M.
   Blocks: closed beta/public beta depending host.

6. Task: Fix Photo Search result DTO enrichment if TazaScore is missing there.
   Why: product cards should be consistent across search modes.
   Estimated complexity: S.
   Blocks: public beta.

7. Task: Resolve Coca-Cola canonical family/duplicate review.
   Why: duplicate variants can confuse score/search consistency.
   Estimated complexity: S.
   Blocks: public beta.

8. Task: Add production Flutter API URL guard.
   Why: release builds must not silently use localhost/emulator URLs.
   Estimated complexity: S.
   Blocks: store.

9. Task: Add hosted monitoring and DB backup checklist.
   Why: public users need recovery and alerting.
   Estimated complexity: S.
   Blocks: public beta.

10. Task: Finalize legal/contact/OFF attribution copy.
    Why: required for public/store trust.
    Estimated complexity: M.
    Blocks: public beta/store.
