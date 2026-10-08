# AITU demo readiness — 2026-09-18

Scope: current project only, for a 3–5 minute informal demonstration. No features, redesign, architecture rewrite, scoring changes, credentials, migrations, or permanent demo products were added. No commit was made.

## A. Files changed

Demo preparation changed these files (paths relative to the repository):

```text
README.md
apps/admin/src/features/submissions/api/submissions-api.ts
apps/admin/src/features/submissions/api/submissions-api.test.ts
apps/admin/src/features/submissions/pages/SubmissionsListPage.tsx
apps/admin/src/features/submissions/pages/SubmissionDetailsPage.tsx
apps/mobile/android/app/build.gradle.kts
apps/mobile/android/app/src/main/AndroidManifest.xml
apps/mobile/lib/src/features/scanner/presentation/screens/scanner_screen.dart
apps/mobile/lib/src/features/photo_search/presentation/screens/photo_search_screen.dart
apps/mobile/lib/src/features/profile/domain/legal_texts.dart
apps/mobile/test/core/network/asset_url_resolver_test.dart
apps/mobile/test/features/favorites/presentation/favorites_screen_test.dart
apps/mobile/test/features/photo_search/presentation/photo_search_screen_test.dart
apps/mobile/test/features/product/data/repositories/http_product_repository_test.dart
apps/mobile/test/features/product/presentation/halal_check_card_test.dart
apps/mobile/test/features/product/presentation/product_details_screen_test.dart
apps/mobile/test/features/product/presentation/product_lookup_error_screen_test.dart
apps/mobile/test/features/product_submission/presentation/product_submission_screen_test.dart
backend/api/package.json
backend/api/README.md
backend/api/src/repositories/product.repository.ts
backend/api/src/repositories/product-submission.repository.ts
backend/api/src/repositories/product-search.ts
backend/api/src/repositories/product-search.test.ts
backend/api/src/repositories/demo-readiness.integration.test.ts
backend/api/src/services/product.service.ts
backend/api/src/services/product-submission.service.ts
backend/api/src/services/product-submission.service.test.ts
docs/architecture.md
docs/scoring-methodology.md
docs/privacy-policy.md
docs/halal-check-validation-report.md
docs/mvp-gap-audit.md
docs/aitu-demo-readiness.md
```

## B. Confirmed bugs and minimal fixes

- Admin list/details had protected API routes but sent no bearer token. Both now receive the existing auth-context token; effects refresh when it changes. Fetch regression tests assert the Authorization header. Auth storage and login architecture are unchanged.
- Approval inserted a product and then separately marked its submission approved. Both writes now use the same Prisma interactive transaction. A status predicate prevents a competing approval from committing a second product for an already approved submission. Scoring, provenance, moderation note and reviewer behavior are preserved. A real PostgreSQL test forces the update to fail after insertion and verifies that no product survives.
- `contains: 'cola'` really matched the existing `Dark Chocolate` product. Search now matches name/brand prefixes at the start or after common separators, retaining partial typing and case-insensitivity. Filtering occurs in PostgreSQL before pagination, with the same count filter. No new ranking engine/index/schema was introduced. Tests cover cola/chocolate, Cyrillic, partial words, wildcard escaping and pagination wiring. This remains a small prefix search, not fuzzy search or transliteration.
- Android release builds previously blocked the HTTP URL needed by a local phone demo. An explicit Dart build define enables local-demo HTTP; normal release manifests still have `usesCleartextTraffic=false`. Existing `API_BASE_URL` already supports switching targets, so no IP address or new configuration system was added.
- Scanner error handling could use a disposed context after lookup; translations are now captured before awaiting. Photo-picker/error paths now check `mounted` before using context.
- Flutter's existing tests expected older localized strings, a desktop URL during Android-default widget tests, or tapped off-screen buttons. Expectations now match current UI; navigation tests scroll and settle before tapping. No UI redesign was made to satisfy old tests.
- Documentation now distinguishes existing Admin/TazaScore from old plans. Historical audits retain their original results with current-state notices. Legal contact/operator/date values explicitly require manual owner input.

## C. Verification

| Check | Result |
| --- | --- |
| Backend `npm test` | 279 tests passed, 30 files |
| Backend `npm run typecheck` / `npm run build` | Passed |
| PostgreSQL rollback/search integration | Passed; temporary inserted test products rolled back |
| Admin `npm test` | 45 tests passed, 8 files |
| Admin `npm run build` | TypeScript and Vite passed |
| `flutter analyze` | No issues, using ASCII workspace alias |
| `flutter test` | 128 tests passed |
| `flutter build apk --release` | Built with the Windows workaround below; about 66.2 MB |
| Packaged demo APK | Signature verified with `apksigner`; Internet/camera permissions and `usesCleartextTraffic=true` verified with `aapt2` |
| Secure/default release manifest | `usesCleartextTraffic=false`, verified without demo opt-in |
| Prisma migration status | All 10 migrations applied; no migration performed |
| Actual dataset | 29 products; no permanent data changes |
| Real DB-backed HTTP requests | Search, barcode, details and preview return 200 for all three selected products |
| Admin submissions HTTP | 401 without token; 200 with a valid existing Admin token |
| Unknown barcode | 404, handled by the existing consumer fallback |
| Coca-Cola local image | HTTP 200 |

The tests cover launch/navigation, search/results/detail routing, nutrition, ingredients, TazaScore, incomplete-data presentation, score retry, and barcode validation. Barcode scanning accepts EAN-8/EAN-13/UPC-A/UPC-E; camera permission and error views exist. EAN/UPC-A validation includes check digits. These checks do not substitute for a physical-camera test.

Initial Flutter analysis and AOT compilation failed on the Cyrillic checkout path. An ASCII `T:` alias resolved that; Kotlin incremental compilation then hit cross-drive cache failures. Per-command Gradle properties for non-incremental, in-process Kotlin compilation produced the APK. SDK files and global Gradle configuration were not modified.

## D. Still unverified

- `adb devices` reported no connected device. APK installation, phone rendering/performance, camera focus/detection/permissions and actual phone-to-laptop connectivity remain unverified.
- The live database has zero submissions. A populated Admin review page and a successful live approval were not exercised with real user data. API token tests, service success/failure tests and the real database rollback check cover the changed code.
- University Wi-Fi isolation/firewall behavior is unknown. External Open Food Facts images require internet; product text/scores come from the local database. Missing images have UI fallbacks.
- Public hosting, production HTTPS, store signing and legal publication readiness are outside this informal-demo task.

## E. Exact live-demo sequence

Before leaving for AITU:

1. Keep the existing database and uploads; do not reseed or run import/repair scripts. Keep a private database/upload backup separately from Git.
2. From `backend/api`, run `npm run dev`. Keep that terminal running. Confirm `http://localhost:4000/health` and `http://localhost:4000/health/ready` succeed.
3. Connect/install/rehearse on the phone using section F. Open each of the three products once. Do not assume cached favorites are a complete offline substitute for the backend.
4. If showing Admin, run `npm run dev` in `apps/admin`, open its printed Vite URL and log in shortly before presenting. Default tokens expire after 15 minutes; log in again if a 401 appears. The submissions page is currently empty, not broken.
5. Keep laptop power/sleep settings and the cable connection stable during the demo.

Suggested 3–5 minutes:

1. Launch TazaScan, open product search and enter `woto`. Open **WOTO Drinking Water**. Show TazaScore 100 and high confidence. Water is a simple high-score example, not evidence that every product has complete label data.
2. Return to search and enter `cola`. Select **Coca-Cola Original Taste**. Show 27, sugars 10.6 g per 100 ml, ingredients and the explanation. Chocolate should not appear among cola results.
3. Search `творог` and open **творог 9%**. Show 28, low confidence and approximately 31% coverage. Explain that missing sugar/saturated-fat/salt values constrain the estimate; the pre-safeguard estimate of 90 is capped at 28. Do not present this incomplete score as a definitive judgment of the product.
4. If camera scanning was rehearsed, scan a package whose barcode exactly matches the database. Regional/package variants can have different barcodes. If scanning is slow, return to the already-tested text search.

## F. Connect a physical Android phone

### Windows tooling workaround for this checkout

From the repository root, use a free drive letter. `T:` was created during verification and points to this workspace; reuse it while it remains available. Run `subst` to inspect existing mappings before creating one. Do not replace a mapping belonging to another project.

```powershell
# Only if T: is not already mapped/occupied:
subst T: "$((Get-Location).Path)"
Set-Location T:\apps\mobile
flutter analyze
flutter test

# Per-terminal build workaround; no global SDK/Gradle changes:
$env:DEBUG = ''
$env:GRADLE_OPTS = '-Dorg.gradle.project.kotlin.incremental=false -Dorg.gradle.project.kotlin.compiler.execution.strategy=in-process'
flutter build apk --release --dart-define=API_BASE_URL=http://127.0.0.1:4000 --dart-define=TAZASCAN_DEMO_HTTP=true
```

The final demo APK is `apps/mobile/build/app/outputs/flutter-apk/app-release.apk`, configured for USB reverse forwarding. That APK was built while release builds could still fall back to the debug key.

Release builds no longer fall back to the debug key: `flutter build apk --release` now requires `apps/mobile/android/key.properties` and a release keystore (see [Android release signing](android-release.md#signing)) and fails clearly otherwise. Keep both files out of git. An APK signed with a different key cannot be installed over the earlier debug-signed demo APK (`adb install -r` reports a signing mismatch); use a separate demo device or uninstall the old app only if its local data is not needed.

The packaged APK manifest and signing are checked after building; rebuilding can change its fingerprint.

### Recommended: USB reverse forwarding

This avoids dependence on university Wi-Fi and changing LAN addresses. Android documents [reverse port forwarding](https://developer.android.com/develop/ui/views/layout/webapps/access-local-server) and [USB debugging setup](https://developer.android.com/tools/adb).

1. Enable Developer options → USB debugging on the phone. Connect a data-capable USB cable and accept the laptop's debugging prompt.
2. Start the backend as described above.
3. In PowerShell, from `apps/mobile` (or `T:\apps\mobile`):

```powershell
$adb = Join-Path $env:LOCALAPPDATA 'Android\sdk\platform-tools\adb.exe'
& $adb devices
# Continue only when the intended phone says 'device', not 'unauthorized'.
& $adb reverse tcp:4000 tcp:4000
& $adb install -r .\build\app\outputs\flutter-apk\app-release.apk
```

4. Open `http://127.0.0.1:4000/health/ready` in the phone browser, then launch TazaScan. Grant camera permission when testing scanning.
5. Keep the cable connected. Repeat `adb reverse` after reconnect/reboot. With multiple devices use `& $adb -s <serial> ...` for reverse/install. If installation reports a signing mismatch, use the matching existing key or a separate demo device; do not uninstall and lose user data automatically.

### Wireless alternative: your own hotspot/private Wi-Fi

1. Connect laptop and phone to the same personal hotspot/private network. Find the laptop's IPv4 address for that adapter with `ipconfig` (not VPN, emulator, loopback or another adapter).
2. Keep the API running on port 4000. The existing Express `listen(PORT)` accepts network connections. If Windows Firewall blocks it, allow Node/TCP 4000 only on the trusted private network. Do not disable the firewall globally. No firewall changes were made by this task.
3. Open `http://<laptop-ip>:4000/health/ready` in the phone browser. If it fails, solve network isolation/firewall first or use USB.
4. Rebuild/reinstall with that address supplied at build time, keeping the local-demo HTTP opt-in:

```powershell
$demoApi = Read-Host 'Laptop API origin, e.g. http://<laptop IPv4>:4000'
flutter build apk --release "--dart-define=API_BASE_URL=$demoApi" --dart-define=TAZASCAN_DEMO_HTTP=true
& $adb install -r .\build\app\outputs\flutter-apk\app-release.apk
```

No LAN address is committed to source. `10.0.2.2` is only for the Android emulator; ordinary phone `localhost` points at the phone unless USB reverse forwarding is active. For emulator use `--dart-define=API_BASE_URL=http://10.0.2.2:4000`.

For a future public backend, remove the local HTTP opt-in and supply the real HTTPS origin:

```powershell
$publicApi = Read-Host 'Actual public HTTPS API origin'
flutter build apk --release "--dart-define=API_BASE_URL=$publicApi" --dart-define=TAZASCAN_PRODUCTION=true
```

`API_BASE_URL` is compile-time configuration; an installed APK does not read your laptop `.env`. When finished using the alias, close tools using `T:`, return to the original path and run `subst T: /d`. This removes only the alias, not files.

## G. Existing products recommended for the demo

Scores below were calculated by the current service from the actual local database, not copied from legacy stored score fields.

| Product | Barcode | TazaScore | Demo value |
| --- | --- | --- | --- |
| WOTO Drinking Water | `4870207510444` | 100 | High confidence; simple water example; source is physical product label. No product image is present, so the normal placeholder is expected. |
| Coca-Cola Original Taste | `5449000000996` | 27 | High confidence, full scoring coverage, familiar sugary drink, six ingredients and a working locally stored image. Existing seed record, not newly fabricated. |
| творог 9% | `4600605029329` | 28 | Existing Open Food Facts record; low confidence, 30.9% coverage, missing sugars/saturated fat/salt/fiber/FVL percentage. Safeguards cap the pre-safeguard 90 estimate at 28. Three ingredients are present. |

If you specifically want to show a withheld score instead, existing **Kascha**, barcode `4607016243160`, has no TazaScore (`insufficient_data`), low confidence and 0% coverage. Do not describe unavailable scores as zero.

## H. Remaining risks

- **BLOCKER for an unconditional phone-demo sign-off:** no physical-device rehearsal has occurred. Install the APK, verify the health endpoint and run all three lookups plus one camera scan before relying on it live. No known remaining code/build blocker was found for the tested consumer flow.
- **IMPORTANT:** use the tested Windows build workaround; direct Flutter analysis/AOT builds in this Cyrillic path failed. Use USB or a tested private hotspot, not untested university Wi-Fi. Keep PostgreSQL/API running and preserve the database/uploads. An APK built for USB will not work wirelessly without a different URL/rebuild.
- **IMPORTANT:** this is an informational prototype with a small, partly incomplete dataset. Public deployment/store signing/legal publication remain unfinished and are not required for a private informal demonstration.
- **MINOR:** external images can fail offline; WOTO has no image; Admin token expiry may require re-login; the moderation queue is empty; `mobile_scanner` emits a future Kotlin-plugin compatibility warning. No dependency upgrade was made during demo preparation.
- **MINOR:** search intentionally supports word prefixes/common separators only; no typo correction, transliteration or general relevance ranking was added.

## Working-tree hygiene

The tree was already dirty before this task:

- Modified `backend/api/package.json` added `repair:missing-ingredients` and its test.
- Untracked `backend/api/src/importers/missing-ingredients-backfill.ts`, its `.test.ts`, and `backend/api/src/scripts/repair-missing-ingredients.ts` are real source/test/script work, not generated files. Their existing tests pass. They were not run against the database or discarded.
- Modified `docs/product-data-normalization.md` and `docs/halal-check-validation-report.md` contained ingredient-backfill validation notes. Those additions were preserved.
- Untracked `docs/mvp-gap-audit.md` is a real historical audit; it was preserved with a small current-state note.

Commit the intended ingredient-repair source/test/script changes together with their package script and documentation, and commit the demo fixes/tests/runbook as a separate reviewable change if practical. The package file and two historical documents contain both pre-existing work and this task's changes, so review/stage those hunks deliberately. Do not blindly use `git add .`. No automatic commit/reset/clean was performed.

Generated/unnecessary-to-commit files include `node_modules`, `dist`, Flutter `build`, `.dart_tool`, Android `.gradle` caches and verification `*.log` files. These are ignored. `.env`, `android/local.properties`, `android/key.properties` and keystores must remain private/ignored. The already tracked `backend/api/uploads/products/051ed0ac-b925-4549-b9c7-e0f5587fad67.webp` is the image actually used by the Coca-Cola record, so it was retained rather than treated as disposable output. The APK can be distributed privately for the demo without committing it to source.

**Verdict:** the repository is suitable for a short informal demo on the tested code/data path, conditional on one successful rehearsal on the actual phone. It is not yet justified to call the physical-device demo unconditionally verified.
